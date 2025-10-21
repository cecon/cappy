/**
/**
 * @fileoverview Simplified SQLite adapter for graph storage using sql.js
 * @module adapters/secondary/graph/sqlite-simple-adapter
 * @since 3.0.0
 */

import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";
import * as fs from "fs";
import * as path from "path";

import type { GraphStorePort } from "../../../domains/graph/ports/indexing-port";
import type { DocumentChunk } from "../../../types/chunk";

/**
 * Simplified SQLite adapter using sql.js (WASM)
 * Compatible with VS Code Extension Host
 */
export class SQLiteAdapter implements GraphStorePort {
  private readonly dbPath: string;
  private db: SqlJsDatabase | null = null;
  private dbFilePath = "";
  private SQL: SqlJsStatic | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    console.log(`📊 Initializing SQLite database: ${this.dbPath}`);

    // Resolve file path
    let dbFilePath = this.dbPath;
    if (!path.isAbsolute(dbFilePath)) {
      dbFilePath = path.resolve(dbFilePath);
    }
    // If path is directory or missing extension, ensure graph-store.db
    if ((fs.existsSync(dbFilePath) && fs.statSync(dbFilePath).isDirectory()) || !path.extname(dbFilePath)) {
      dbFilePath = path.join(dbFilePath, "graph-store.db");
    }

    const parentDir = path.dirname(dbFilePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    this.dbFilePath = dbFilePath;
    console.log(`📁 SQLite: Using database file: ${dbFilePath}`);

    try {
      // Locate WASM
      const extensionPath = path.dirname(path.dirname(path.dirname(path.dirname(__dirname))));
      const wasmPath = path.join(extensionPath, "resources", "wasm", "sql-wasm.wasm");

      const SQL = await initSqlJs({
        locateFile: (file) => (file.endsWith(".wasm") ? wasmPath : file),
      });
      this.SQL = SQL;

      let buffer: Uint8Array | undefined;
      if (fs.existsSync(dbFilePath)) {
        buffer = fs.readFileSync(dbFilePath);
      }

      this.db = new SQL.Database(buffer);
      this.db.run("PRAGMA foreign_keys = ON");
      this.createSchema();
      this.saveToFile();
      console.log("✅ SQLite: Database initialized");
    } catch (error) {
      console.error("❌ SQLite initialization error:", error);
      throw new Error(`Failed to initialize SQLite: ${error}`);
    }
  }

  async reloadFromDisk(): Promise<void> {
    if (!this.SQL) return;
    try {
      let buffer: Uint8Array | undefined;
      if (fs.existsSync(this.dbFilePath)) {
        buffer = fs.readFileSync(this.dbFilePath);
      }
      if (this.db) this.db.close();
      this.db = new this.SQL.Database(buffer);
      this.db.run("PRAGMA foreign_keys = ON");
      this.createSchema();
      console.log("🔄 SQLite: Reloaded database from disk");
    } catch (error) {
      console.error("❌ SQLite reloadFromDisk error:", error);
    }
  }

  private createSchema(): void {
    if (!this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        properties TEXT
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT,
        UNIQUE(from_id, to_id, type)
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS vectors (
        chunk_id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        metadata TEXT
      )
    `);
  }

  private saveToFile(): void {
    if (!this.db) return;
    const data = this.db.export();
    fs.writeFileSync(this.dbFilePath, Buffer.from(data));
  }

  async getSubgraph(
    seeds: string[] | undefined,
    depth: number,
    maxNodes = 1000
  ): Promise<{
    nodes: Array<{ id: string; label: string; type: "file" | "chunk" | "workspace" }>;
    edges: Array<{ id: string; source: string; target: string; label?: string; type: string }>;
  }> {
    if (!this.db) throw new Error("SQLite not initialized");

    const nodes: Array<{ id: string; label: string; type: "file" | "chunk" | "workspace" }> = [];
    const edges: Array<{ id: string; source: string; target: string; label?: string; type: string }> = [];
    const visited = new Set<string>();

    try {
      let currentLevel: string[] = [];
      if (!seeds || seeds.length === 0) {
        const rootResult = this.db.exec(`SELECT id FROM nodes WHERE type = 'file'`);
        if (rootResult.length > 0 && rootResult[0].values) {
          currentLevel = rootResult[0].values.map((row) => row[0] as string);
        }
      } else {
        currentLevel = seeds;
      }

      for (let level = 0; level <= depth && currentLevel.length > 0; level++) {
        const nextLevel = new Set<string>();
        for (const nodeId of currentLevel) {
          if (visited.has(nodeId)) continue;
          visited.add(nodeId);

          const nodeResult = this.db.exec(`SELECT id, type, label FROM nodes WHERE id = ?`, [nodeId]);
          if (nodeResult.length > 0 && nodeResult[0].values && nodeResult[0].values.length > 0) {
            const row = nodeResult[0].values[0];
            nodes.push({ id: row[0] as string, type: row[1] as "file" | "chunk" | "workspace", label: row[2] as string });
          }

          const outEdges = this.db.exec(`SELECT id, from_id, to_id, type FROM edges WHERE from_id = ?`, [nodeId]);
          if (outEdges.length > 0 && outEdges[0].values) {
            for (const edgeRow of outEdges[0].values) {
              const targetId = edgeRow[2] as string;
              edges.push({ id: `edge-${edgeRow[0]}`, source: edgeRow[1] as string, target: targetId, type: edgeRow[3] as string, label: edgeRow[3] as string });
              if (!visited.has(targetId) && level < depth) nextLevel.add(targetId);
            }
          }

          const inEdges = this.db.exec(`SELECT id, from_id, to_id, type FROM edges WHERE to_id = ?`, [nodeId]);
          if (inEdges.length > 0 && inEdges[0].values) {
            for (const edgeRow of inEdges[0].values) {
              const sourceId = edgeRow[1] as string;
              edges.push({ id: `edge-${edgeRow[0]}`, source: sourceId, target: edgeRow[2] as string, type: edgeRow[3] as string, label: edgeRow[3] as string });
              if (!visited.has(sourceId) && level < depth) nextLevel.add(sourceId);
            }
          }

          if (nodes.length >= maxNodes) break;
        }

        currentLevel = Array.from(nextLevel);
        if (nodes.length >= maxNodes) break;
      }

      const uniqueEdges = new Map<string, (typeof edges)[number]>();
      for (const e of edges) {
        const key = `${e.source}->${e.target}:${e.type}`;
        if (!uniqueEdges.has(key)) uniqueEdges.set(key, e);
      }

      return { nodes, edges: Array.from(uniqueEdges.values()) };
    } catch (error) {
      console.error("❌ SQLite getSubgraph error:", error);
      return { nodes: [], edges: [] };
    }
  }

  async createFileNode(filePath: string, language: string, linesOfCode: number): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    const properties = JSON.stringify({ language, linesOfCode });
    this.db.run(`INSERT OR REPLACE INTO nodes (id, type, label, properties) VALUES (?, ?, ?, ?)`, [filePath, "file", path.basename(filePath), properties]);
    this.saveToFile();
  }

  async createChunkNodes(chunks: DocumentChunk[]): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    for (const chunk of chunks) {
      const label = chunk.metadata.symbolName || `${chunk.metadata.chunkType} [${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}]`;
      const properties = JSON.stringify({
        filePath: chunk.metadata.filePath,
        lineStart: chunk.metadata.lineStart,
        lineEnd: chunk.metadata.lineEnd,
        chunkType: chunk.metadata.chunkType,
        symbolName: chunk.metadata.symbolName,
        symbolKind: chunk.metadata.symbolKind,
      });
      this.db.run(`INSERT OR REPLACE INTO nodes (id, type, label, properties) VALUES (?, ?, ?, ?)`, [
        chunk.id,
        "chunk",
        label,
        properties,
      ]);
    }
    this.saveToFile();
  }

  async createRelationships(relationships: Array<{ from: string; to: string; type: string; properties?: Record<string, string | number | boolean | string[] | null> }>): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    if (relationships.length === 0) return;
    for (const rel of relationships) {
      const properties = rel.properties ? JSON.stringify(rel.properties) : null;
      try {
        this.db.run(`INSERT OR IGNORE INTO edges (from_id, to_id, type, properties) VALUES (?, ?, ?, ?)`, [rel.from, rel.to, rel.type, properties]);
      } catch (error) {
        console.error(`❌ Failed to create edge: ${rel.type} from ${rel.from} to ${rel.to}`, error);
      }
    }
    this.saveToFile();
  }

  async getRelatedChunks(ids: string[], depth = 1): Promise<string[]> {
    if (!this.db || !ids || ids.length === 0) return [];
    try {
      const related: Set<string> = new Set();
      const fileIds: Set<string> = new Set();
      const fileStmt = this.db.prepare(`SELECT from_id FROM edges WHERE to_id = ? AND type = 'CONTAINS' LIMIT 1`);
      for (const chunkId of ids) {
        fileStmt.bind([chunkId]);
        if (fileStmt.step()) {
          const row = fileStmt.getAsObject() as Record<string, unknown>;
          const fid = String(row["from_id"] ?? "");
          if (fid) fileIds.add(fid);
        }
        fileStmt.reset();
      }
      fileStmt.free();

      if (fileIds.size > 0) {
        const placeholders = Array.from(fileIds).map(() => "?").join(",");
        const sibStmt = this.db.prepare(`SELECT to_id FROM edges WHERE from_id IN (${placeholders}) AND type = 'CONTAINS'`);
        sibStmt.bind(Array.from(fileIds));
        while (sibStmt.step()) {
          const row = sibStmt.getAsObject() as Record<string, unknown>;
          const cid = String(row["to_id"] ?? "");
          if (cid && !ids.includes(cid)) related.add(cid);
        }
        sibStmt.free();
      }

      if (depth > 1) {
        const placeholders = ids.map(() => "?").join(",");
        const docsStmt = this.db.prepare(
          `SELECT to_id AS nid FROM edges WHERE from_id IN (${placeholders}) AND type = 'DOCUMENTS'
           UNION SELECT from_id AS nid FROM edges WHERE to_id IN (${placeholders}) AND type = 'DOCUMENTS'`
        );
        docsStmt.bind([...ids, ...ids]);
        while (docsStmt.step()) {
          const row = docsStmt.getAsObject() as Record<string, unknown>;
          const nid = String(row["nid"] ?? "");
          if (nid && !ids.includes(nid)) related.add(nid);
        }
        docsStmt.free();
      }

      return Array.from(related);
    } catch (error) {
      console.error("❌ SQLite getRelatedChunks error:", error);
      return [];
    }
  }

  async deleteFileNodes(filePath: string): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    this.db.run(`DELETE FROM nodes WHERE id = ?`, [filePath]);
    this.db.run(`DELETE FROM nodes WHERE type = 'chunk' AND json_extract(properties, '$.filePath') = ?`, [filePath]);
    this.saveToFile();
  }

  async deleteFile(filePath: string): Promise<void> {
    return this.deleteFileNodes(filePath);
  }

  async listAllFiles(): Promise<Array<{ path: string; language: string; linesOfCode: number }>> {
    if (!this.db) return [];
    const result = this.db.exec(`SELECT id, properties FROM nodes WHERE type = 'file'`);
    if (result.length === 0 || !result[0].values) return [];
    return result[0].values.map((row) => {
      const props = JSON.parse((row[1] as string) || "{}");
      return { path: row[0] as string, language: props.language || "", linesOfCode: props.linesOfCode || 0 };
    });
  }

  async getFileChunks(filePath: string): Promise<Array<{ id: string; type: string; label: string }>> {
    if (!this.db) return [];
    const result = this.db.exec(
      `SELECT DISTINCT n.id, n.type, n.label FROM nodes n INNER JOIN edges e ON e.to_id = n.id WHERE e.from_id = ? AND e.type = 'CONTAINS' AND n.type = 'chunk'`,
      [filePath]
    );
    if (result.length === 0 || !result[0].values) return [];
    return result[0].values.map((row) => ({ id: row[0] as string, type: row[1] as string, label: row[2] as string }));
  }

  async close(): Promise<void> {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }

  getStats() {
    if (!this.db) return { fileNodes: 0, chunkNodes: 0, relationships: 0, duplicates: 0 };
    try {
      const fileResult = this.db.exec(`SELECT COUNT(*) FROM nodes WHERE type = 'file'`);
      const chunkResult = this.db.exec(`SELECT COUNT(*) FROM nodes WHERE type = 'chunk'`);
      const edgeResult = this.db.exec(`SELECT COUNT(*) FROM edges`);
      const dupResult = this.db.exec(`
        SELECT COUNT(*) as dup_count FROM (
          SELECT id, COUNT(*) as count FROM nodes GROUP BY id HAVING count > 1
        )
      `);
      const duplicates = (dupResult[0]?.values[0]?.[0] as number) || 0;
      return {
        fileNodes: (fileResult[0]?.values[0][0] as number) || 0,
        chunkNodes: (chunkResult[0]?.values[0][0] as number) || 0,
        relationships: (edgeResult[0]?.values[0][0] as number) || 0,
        duplicates,
      };
    } catch (error) {
      console.error("❌ SQLite getStats error:", error);
      return { fileNodes: 0, chunkNodes: 0, relationships: 0, duplicates: 0 };
    }
  }

  async ensureWorkspaceNode(name: string): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    this.db.run(`INSERT OR IGNORE INTO nodes (id, type, label, properties) VALUES (?, ?, ?, NULL)`, [
      `workspace:${name}`,
      "workspace",
      name,
    ]);
    this.saveToFile();
  }

  async storeEmbeddings(chunks: Array<{ id: string; content: string; embedding: number[]; metadata?: Record<string, unknown> }>): Promise<void> {
    if (!this.db) return;
    for (const chunk of chunks) {
      this.db.run(
        `INSERT OR REPLACE INTO vectors (chunk_id, content, embedding_json, metadata) VALUES (?, ?, ?, ?)`,
        [chunk.id, chunk.content, JSON.stringify(chunk.embedding), chunk.metadata ? JSON.stringify(chunk.metadata) : null]
      );
    }
    this.saveToFile();
  }

  async searchSimilar(
    _queryEmbedding: number[],
    limit = 10
  ): Promise<Array<{ id: string; content: string; score: number; metadata?: Record<string, unknown> }>> {
    if (!this.db) return [];
    const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
    const norm = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    try {
      const result = this.db.exec(`SELECT chunk_id, content, embedding_json, metadata FROM vectors`);
      if (result.length === 0 || !result[0].values) return [];
      const qn = norm(_queryEmbedding) || 1e-9;
      const rows = result[0].values;
      const scored = rows.map((row) => {
        const id = row[0] as string;
        const content = row[1] as string;
        const emb = JSON.parse(row[2] as string) as number[];
        const metadata = row[3] ? JSON.parse(row[3] as string) : undefined;
        const score = dot(_queryEmbedding, emb) / (qn * (norm(emb) || 1e-9));
        return { id, content, score, metadata };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.max(0, limit));
    } catch (error) {
      console.error("❌ SQLite searchSimilar error:", error);
      return [];
    }
  }

  async getChunksByIds(ids: string[]): Promise<DocumentChunk[]> {
    if (!this.db) return [];
    if (!ids || ids.length === 0) return [];
    try {
      const placeholders = ids.map(() => "?").join(",");
      const query = `SELECT chunk_id, content, metadata FROM vectors WHERE chunk_id IN (${placeholders})`;
      const result = this.db.exec(query, ids as unknown as string[]);
      if (result.length === 0 || !result[0].values) return [];
      const rows = result[0].values;
      const chunks: DocumentChunk[] = rows.map((row) => {
        const id = row[0] as string;
        const content = row[1] as string;
        const metadataRaw = row[2] as string | null;
        const meta = metadataRaw ? (JSON.parse(metadataRaw) as Record<string, unknown>) : {};
        return {
          id,
          content,
          metadata: {
            filePath: (meta.filePath as string) || "",
            lineStart: (meta.lineStart as number) ?? 0,
            lineEnd: (meta.lineEnd as number) ?? 0,
            chunkType: (meta.chunkType as DocumentChunk["metadata"]["chunkType"]) || "plain_text",
            symbolName: meta.symbolName as string | undefined,
            symbolKind: meta.symbolKind as DocumentChunk["metadata"]["symbolKind"] | undefined,
          },
        };
      });
      return chunks;
    } catch (error) {
      console.error("❌ SQLite getChunksByIds error:", error);
      return [];
    }
  }

  async getSampleRelationships(limit = 20): Promise<Array<{
    id: number;
    from: string;
    to: string;
    type: string;
    properties?: Record<string, unknown>;
  }>> {
    if (!this.db) return [];
    try {
      const result = this.db.exec(`SELECT id, from_id, to_id, type, properties FROM edges LIMIT ${limit}`);
      if (result.length === 0 || !result[0].values) return [];
      return result[0].values.map((row) => ({
        id: row[0] as number,
        from: row[1] as string,
        to: row[2] as string,
        type: row[3] as string,
        properties: row[4] ? JSON.parse(row[4] as string) : undefined,
      }));
    } catch (error) {
      console.error("Error fetching sample relationships:", error);
      return [];
    }
  }

  async getRelationshipsByType(): Promise<Record<string, Array<{ from: string; to: string; properties?: Record<string, unknown> }>>> {
    if (!this.db) return {};
    try {
      const result = this.db.exec(`SELECT type, from_id, to_id, properties FROM edges ORDER BY type`);
      if (result.length === 0 || !result[0].values) return {};
      const grouped: Record<string, Array<{ from: string; to: string; properties?: Record<string, unknown> }>> = {};
      for (const row of result[0].values) {
        const type = row[0] as string;
        const from = row[1] as string;
        const to = row[2] as string;
        const properties = row[3] ? JSON.parse(row[3] as string) : undefined;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({ from, to, properties });
      }
      return grouped;
    } catch (error) {
      console.error("Error fetching relationships by type:", error);
      return {};
    }
  }
}

export function createSQLiteAdapter(dbPath: string): GraphStorePort {
  return new SQLiteAdapter(dbPath);
}

