/**
 * @fileoverview Simplified SQLite adapter for graph storage using sql.js
 * @module adapters/secondary/graph/sqlite-simple-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
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

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    console.log(`📊 Initializing SQLite database: ${this.dbPath}`);

    // Resolve path
    let dbFilePath = this.dbPath;
    if (!path.isAbsolute(dbFilePath)) {
      dbFilePath = path.resolve(dbFilePath);
    }

    if (fs.existsSync(dbFilePath) && fs.statSync(dbFilePath).isDirectory()) {
      dbFilePath = path.join(dbFilePath, "graph.db");
    } else if (!path.extname(dbFilePath)) {
      dbFilePath = path.join(dbFilePath, "graph.db");
    }

    const parentDir = path.dirname(dbFilePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    this.dbFilePath = dbFilePath;
    console.log(`📁 SQLite: Using database file: ${dbFilePath}`);

    try {
      // Get extension path for WASM file
      const extensionPath = path.dirname(path.dirname(path.dirname(path.dirname(__dirname))));
      const wasmPath = path.join(extensionPath, "resources", "wasm", "sql-wasm.wasm");
      
      console.log(`📁 WASM path: ${wasmPath}`);

      const SQL = await initSqlJs({
        locateFile: (file) => {
          console.log(`📁 Locating file: ${file}`);
          if (file.endsWith('.wasm')) {
            return wasmPath;
          }
          return file;
        },
      });
      console.log(`✅ sql.js initialized`);

      let buffer: Uint8Array | undefined;
      if (fs.existsSync(dbFilePath)) {
        buffer = fs.readFileSync(dbFilePath);
        console.log(`📁 Loaded existing database`);
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

    console.log(`✅ Created schema`);
  }

  private saveToFile(): void {
    if (!this.db) return;
    const data = this.db.export();
    fs.writeFileSync(this.dbFilePath, Buffer.from(data));
  }

  async getSubgraph(
    _seeds: string[] | undefined,
    _depth: number,
    maxNodes = 1000
  ): Promise<{
    nodes: Array<{ id: string; label: string; type: "file" | "chunk" | "workspace" }>;
    edges: Array<{ id: string; source: string; target: string; label?: string; type: string }>;
  }> {
    if (!this.db) throw new Error("SQLite not initialized");

    const nodes: Array<{ id: string; label: string; type: "file" | "chunk" | "workspace" }> = [];
    const edges: Array<{ id: string; source: string; target: string; label?: string; type: string }> = [];

    try {
      const result = this.db.exec(`SELECT id, type, label FROM nodes LIMIT ${maxNodes}`);
      if (result.length > 0 && result[0].values) {
        for (const row of result[0].values) {
          nodes.push({
            id: row[0] as string,
            type: row[1] as "file" | "chunk" | "workspace",
            label: row[2] as string,
          });
        }
      }

      const edgeResult = this.db.exec(`SELECT id, from_id, to_id, type FROM edges`);
      if (edgeResult.length > 0 && edgeResult[0].values) {
        for (const row of edgeResult[0].values) {
          edges.push({
            id: `edge-${row[0]}`,
            source: row[1] as string,
            target: row[2] as string,
            type: row[3] as string,
            label: row[3] as string,
          });
        }
      }

      console.log(`✅ SQLite: Loaded ${nodes.length} nodes, ${edges.length} edges`);
      return { nodes, edges };
    } catch (error) {
      console.error("❌ SQLite getSubgraph error:", error);
      return { nodes: [], edges: [] };
    }
  }

  async createFileNode(filePath: string, language: string, linesOfCode: number): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");

    const properties = JSON.stringify({ language, linesOfCode });
    this.db.run(
      `INSERT OR REPLACE INTO nodes (id, type, label, properties) VALUES (?, ?, ?, ?)`,
      [filePath, "file", path.basename(filePath), properties]
    );
    this.saveToFile();
    console.log(`✅ SQLite: Created file node for ${filePath}`);
  }

  async createChunkNodes(chunks: DocumentChunk[]): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");

    for (const chunk of chunks) {
      const label =
        chunk.metadata.symbolName ||
        `${chunk.metadata.chunkType} [${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}]`;

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
    console.log(`✅ SQLite: Created ${chunks.length} chunk nodes`);
  }

  async createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, string | number | boolean>;
    }>
  ): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");

    for (const rel of relationships) {
      const properties = rel.properties ? JSON.stringify(rel.properties) : null;
      this.db.run(`INSERT OR IGNORE INTO edges (from_id, to_id, type, properties) VALUES (?, ?, ?, ?)`, [
        rel.from,
        rel.to,
        rel.type,
        properties,
      ]);
    }

    this.saveToFile();
    console.log(`✅ SQLite: Created ${relationships.length} relationships`);
  }

  async getRelatedChunks(_: string[]): Promise<string[]> {
    // Mark param as intentionally unused
    void _;
    // Simplified: return empty for now
    return [];
  }

  async deleteFileNodes(filePath: string): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");

    this.db.run(`DELETE FROM nodes WHERE id = ?`, [filePath]);
    this.db.run(`DELETE FROM nodes WHERE type = 'chunk' AND json_extract(properties, '$.filePath') = ?`, [
      filePath,
    ]);

    this.saveToFile();
    console.log(`✅ SQLite: Deleted nodes for ${filePath}`);
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
      return {
        path: row[0] as string,
        language: props.language || "",
        linesOfCode: props.linesOfCode || 0,
      };
    });
  }

  async getFileChunks(filePath: string): Promise<Array<{ id: string; type: string; label: string }>> {
    if (!this.db) return [];

    // Get all chunks that are connected to this file via CONTAINS relationship
    const result = this.db.exec(`
      SELECT DISTINCT n.id, n.type, n.label
      FROM nodes n
      INNER JOIN edges e ON e.to_id = n.id
      WHERE e.from_id = ? AND e.type = 'CONTAINS' AND n.type = 'chunk'
    `, [filePath]);

    if (result.length === 0 || !result[0].values) return [];

    return result[0].values.map((row) => ({
      id: row[0] as string,
      type: row[1] as string,
      label: row[2] as string,
    }));
  }

  async close(): Promise<void> {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
    console.log("✅ SQLite: Connection closed");
  }

  getStats() {
    if (!this.db) return { fileNodes: 0, chunkNodes: 0, relationships: 0 };

    try {
      const fileResult = this.db.exec(`SELECT COUNT(*) FROM nodes WHERE type = 'file'`);
      const chunkResult = this.db.exec(`SELECT COUNT(*) FROM nodes WHERE type = 'chunk'`);
      const edgeResult = this.db.exec(`SELECT COUNT(*) FROM edges`);

      return {
        fileNodes: fileResult[0]?.values[0][0] as number || 0,
        chunkNodes: chunkResult[0]?.values[0][0] as number || 0,
        relationships: edgeResult[0]?.values[0][0] as number || 0,
      };
    } catch {
      return { fileNodes: 0, chunkNodes: 0, relationships: 0 };
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
    console.log(`✅ SQLite: Ensured workspace node: ${name}`);
  }

  // Vector store methods (simplified - no VSS for now)
  async storeEmbeddings(chunks: Array<{ id: string; content: string; embedding: number[]; metadata?: Record<string, unknown> }>): Promise<void> {
    // Store in a simple vectors table
    if (!this.db) return;

    // Create table if not exists
    this.db.run(`
      CREATE TABLE IF NOT EXISTS vectors (
        chunk_id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        metadata TEXT
      )
    `);

    for (const chunk of chunks) {
      this.db.run(
        `INSERT OR REPLACE INTO vectors (chunk_id, content, embedding_json, metadata) VALUES (?, ?, ?, ?)`,
        [
          chunk.id,
          chunk.content,
          JSON.stringify(chunk.embedding),
          chunk.metadata ? JSON.stringify(chunk.metadata) : null,
        ]
      );
    }

    this.saveToFile();
    console.log(`✅ SQLite: Stored ${chunks.length} embeddings`);
  }

  async searchSimilar(
    _queryEmbedding: number[],
    limit = 10
  ): Promise<Array<{ id: string; content: string; score: number; metadata?: Record<string, unknown> }>> {
    // Simplified: return all vectors (no similarity calculation for now)
    if (!this.db) return [];

    try {
      const result = this.db.exec(`SELECT chunk_id, content, metadata FROM vectors LIMIT ${limit}`);
      if (result.length === 0 || !result[0].values) return [];

      return result[0].values.map((row) => ({
        id: row[0] as string,
        content: row[1] as string,
        score: 1.0,
        metadata: row[2] ? JSON.parse(row[2] as string) : undefined,
      }));
    } catch {
      return [];
    }
  }
}

export function createSQLiteAdapter(dbPath: string): GraphStorePort {
  return new SQLiteAdapter(dbPath);
}
