/**
 * @fileoverview Simplified SQLite adapter for graph storage using sql.js
 * @module adapters/secondary/graph/sqlite-simple-adapter
 * @author Cappy Team
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

    // Resolve path
    let dbFilePath = this.dbPath;
    if (!path.isAbsolute(dbFilePath)) {
      dbFilePath = path.resolve(dbFilePath);
    }

    // If path is directory, append graph-store.db filename
    if (fs.existsSync(dbFilePath) && fs.statSync(dbFilePath).isDirectory()) {
      dbFilePath = path.join(dbFilePath, "graph-store.db");
    } else if (!path.extname(dbFilePath)) {
      dbFilePath = path.join(dbFilePath, "graph-store.db");
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
      this.SQL = SQL;

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

  /**
   * Reloads the SQLite database from disk to pick up external changes
   */
  async reloadFromDisk(): Promise<void> {
    if (!this.SQL) return; // Not initialized yet
    try {
      let buffer: Uint8Array | undefined;
      if (fs.existsSync(this.dbFilePath)) {
        buffer = fs.readFileSync(this.dbFilePath);
      }
      // Close previous connection if any
      if (this.db) {
        this.db.close();
      }
      this.db = new this.SQL.Database(buffer);
      this.db.run("PRAGMA foreign_keys = ON");
      // Ensure schema exists (noop if already created)
      this.createSchema();
      console.log('🔄 SQLite: Reloaded database from disk');
    } catch (error) {
      console.error('❌ SQLite reloadFromDisk error:', error);
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
        // Usar Set para detectar IDs duplicados
        const seenIds = new Set<string>();
        let duplicateCount = 0;
        
        for (const row of result[0].values) {
          const nodeId = row[0] as string;
          
          // Detectar duplicatas
          if (seenIds.has(nodeId)) {
            duplicateCount++;
            console.warn(`⚠️ SQLite: Duplicate node ID detected: ${nodeId}`);
            continue; // Pular duplicatas
          }
          
          seenIds.add(nodeId);
          nodes.push({
            id: nodeId,
            type: row[1] as "file" | "chunk" | "workspace",
            label: row[2] as string,
          });
        }
        
        if (duplicateCount > 0) {
          console.warn(`⚠️ SQLite: Found ${duplicateCount} duplicate nodes in query result`);
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

      console.log(`✅ SQLite: Loaded ${nodes.length} unique nodes (deduplicated), ${edges.length} edges`);
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

  /**
   * Creates or updates a package node
   */
  async createPackageNode(pkgId: string, name: string, version: string | null, metadata: Record<string, unknown>): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");

    const label = version ? `${name}@${version}` : name;
    const properties = JSON.stringify({
      name,
      version,
      ...metadata
    });

    this.db.run(`INSERT OR REPLACE INTO nodes (id, type, label, properties) VALUES (?, ?, ?, ?)`, [
      pkgId,
      "package",
      label,
      properties
    ]);

    this.saveToFile();
  }

  async createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, string | number | boolean | string[] | null>;
    }>
  ): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");

    let pkgNodesCreated = 0;

    for (const rel of relationships) {
      // Auto-create package nodes for IMPORTS_PKG relationships
      if (rel.type === 'IMPORTS_PKG' && rel.to.startsWith('pkg:')) {
        const props = rel.properties || {};
        const name = (props.specifier as string)?.split('/')[0] || 'unknown';
        const version = (props.resolved as string | null) ?? (props.range as string | null);
        
        await this.createPackageNode(rel.to, name, version, {
          manager: props.manager,
          lockfile: props.lockfile,
          integrity: props.integrity,
          workspace: props.workspace,
          source: props.source,
          confidence: props.confidence
        });
        pkgNodesCreated++;
      }

      const properties = rel.properties ? JSON.stringify(rel.properties) : null;
      this.db.run(`INSERT OR IGNORE INTO edges (from_id, to_id, type, properties) VALUES (?, ?, ?, ?)`, [
        rel.from,
        rel.to,
        rel.type,
        properties,
      ]);
    }

    this.saveToFile();
    
    if (pkgNodesCreated > 0) {
      console.log(`✅ SQLite: Created ${relationships.length} relationships (${pkgNodesCreated} package nodes auto-created)`);
    } else {
      console.log(`✅ SQLite: Created ${relationships.length} relationships`);
    }
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
    if (!this.db) return { fileNodes: 0, chunkNodes: 0, relationships: 0, duplicates: 0 };

    try {
      const fileResult = this.db.exec(`SELECT COUNT(*) FROM nodes WHERE type = 'file'`);
      const chunkResult = this.db.exec(`SELECT COUNT(*) FROM nodes WHERE type = 'chunk'`);
      const edgeResult = this.db.exec(`SELECT COUNT(*) FROM edges`);
      
      // Verificar duplicatas (não deveria haver, mas vamos checar)
      const dupResult = this.db.exec(`
        SELECT COUNT(*) as dup_count 
        FROM (
          SELECT id, COUNT(*) as count 
          FROM nodes 
          GROUP BY id 
          HAVING count > 1
        )
      `);
      
      const duplicates = dupResult[0]?.values[0]?.[0] as number || 0;
      
      if (duplicates > 0) {
        console.warn(`⚠️ SQLite: Database contains ${duplicates} duplicate IDs!`);
        // Log quais são os IDs duplicados
        const dupIds = this.db.exec(`
          SELECT id, COUNT(*) as count 
          FROM nodes 
          GROUP BY id 
          HAVING count > 1
        `);
        console.warn('⚠️ Duplicate IDs:', dupIds[0]?.values);
      }

      return {
        fileNodes: fileResult[0]?.values[0][0] as number || 0,
        chunkNodes: chunkResult[0]?.values[0][0] as number || 0,
        relationships: edgeResult[0]?.values[0][0] as number || 0,
        duplicates: duplicates,
      };
    } catch (error) {
      console.error('❌ SQLite getStats error:', error);
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
