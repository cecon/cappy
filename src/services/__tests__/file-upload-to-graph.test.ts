/**
 * @fileoverview Integration test: upload file via API -> queue -> worker -> graph
 * Verifies nodes and relationships are created in SQLite graph DB
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import { FileMetadataDatabase } from '../file-metadata-database';
import { FileProcessingQueue } from '../file-processing-queue';
import { FileProcessingWorker } from '../file-processing-worker';
import { ParserService } from '../parser-service';
import { FileHashService } from '../file-hash-service';
import { FileProcessingAPI } from '../file-processing-api';
import { SQLiteAdapter } from '../../adapters/secondary/graph/sqlite-adapter';
import { IndexingService } from '../indexing-service';

class MockEmbeddingService {
  async initialize(): Promise<void> { /* no-op */ }
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Return small fixed-size vectors to avoid heavy model loading
    return texts.map(() => [0.1, 0.2, 0.3, 0.4]);
  }
}

const SAMPLE_TS = `/**
 * Adds two numbers
 * @param a first
 * @param b second
 */
export function add(a: number, b: number): number { return a + b }
`;

interface TestEnv { root: string; dbPath: string; graphDir: string; apiPort: number; workspace: string }

function createEnv(): TestEnv {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cappy-upload-'));
  const dbPath = path.join(root, 'file-metadata.db');
  const graphDir = path.join(root, '.cappy', 'data');
  const apiPort = 4567; // test port
  return { root, dbPath, graphDir, apiPort, workspace: root };
}

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 20000, intervalMs = 200): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await condition();
    if (ok) return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout after ${timeoutMs}ms`);
}

describe('Upload -> Nodes/Relationships (API integration)', () => {
  let env: TestEnv;
  let db: FileMetadataDatabase;
  let queue: FileProcessingQueue;
  let api: FileProcessingAPI;
  let graph: SQLiteAdapter;

  beforeEach(async () => {
    env = createEnv();

    // Ensure folders
    fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });
    fs.mkdirSync(env.graphDir, { recursive: true });

    // Init DB
    db = new FileMetadataDatabase(env.dbPath);
    await db.initialize();

    // Worker deps
    const parser = new ParserService();
    const hasher = new FileHashService();

    // Graph + indexing (usando apenas SQLite, sem VectorStore)
    graph = new SQLiteAdapter(env.graphDir);
    await graph.initialize();
  const embed = new MockEmbeddingService() as unknown as import('../embedding-service').EmbeddingService;
  const indexing = new IndexingService(null, graph, embed, env.workspace);

    // Worker + queue
    const worker = new FileProcessingWorker(parser, hasher, env.workspace, indexing, graph);
    queue = new FileProcessingQueue(db, worker, { concurrency: 1, maxRetries: 1, autoStart: true });

    // API
    api = new FileProcessingAPI(queue, db, env.root, env.apiPort);
    await api.start();
  });

  afterEach(async () => {
    try { await api.stop(); } catch { /* ignore */ }
    try { queue.stop(); } catch { /* ignore */ }
    try { db.close(); } catch { /* ignore */ }
    try { if (fs.existsSync(env.root)) fs.rmSync(env.root, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('uploads a TS file and creates file/chunk nodes and CONTAINS relationships', async () => {
    // Upload via API
    const payload = JSON.stringify({
      fileName: 'add.ts',
      filePath: 'add.ts',
      content: Buffer.from(SAMPLE_TS, 'utf8').toString('base64')
    });

  type EnqueueResponse = { fileId: string } | { error: string };
  const res = await new Promise<{ status: number; body: EnqueueResponse }>((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: env.apiPort, path: '/files/enqueue', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (r) => {
        const chunks: Buffer[] = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => {
          const bodyStr = Buffer.concat(chunks).toString('utf8');
          try {
            resolve({ status: r.statusCode || 0, body: JSON.parse(bodyStr) as EnqueueResponse });
          } catch {
            resolve({ status: r.statusCode || 0, body: { error: bodyStr } });
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    expect(res.status).toBe(200);
    if ('error' in res.body) {
      throw new Error('Enqueue failed: ' + res.body.error);
    }
    const fileId = String(res.body.fileId);
    expect(fileId).toBeTruthy();

    // Wait for completion
    await waitFor(() => {
      const m = db.getFile(fileId);
      return !!m && (m.status === 'completed' || m.status === 'failed');
    }, 30000, 250);

    const meta = db.getFile(fileId)!;
    expect(meta.status).toBe('completed');
    expect((meta.chunksCount || 0)).toBeGreaterThan(0);

    // Verify graph stats (at least 1 file node, >=1 chunk node, and >=1 edge)
    const stats = graph.getStats();
    expect(stats.fileNodes).toBeGreaterThanOrEqual(1);
    expect(stats.chunkNodes).toBeGreaterThanOrEqual(1);
    expect(stats.relationships).toBeGreaterThanOrEqual(1);
  }, 60000);
});
