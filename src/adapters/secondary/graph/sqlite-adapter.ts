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
    seeds: string[] | undefined,
    depth: number,
    maxNodes = 1000
  ): Promise<{
    nodes: Array<{ id: string; label: string; type: "file" | "chunk" | "workspace" }>;
    edges: Array<{ id: string; source: string; target: string; label?: string; type: string }>;
  }> {
    if (!this.db) throw new Error("SQLite not initialized");

    console.log(`🔍 SQLite: getSubgraph called with depth=${depth}, seeds=${seeds?.length || 'all'}`);

    const nodes: Array<{ id: string; label: string; type: "file" | "chunk" | "workspace" }> = [];
    const edges: Array<{ id: string; source: string; target: string; label?: string; type: string }> = [];
    const visited = new Set<string>();

    try {
      // Se não há seeds, começar com todos os nós do tipo 'file' como raízes
      let currentLevel: string[] = [];
      
      if (!seeds || seeds.length === 0) {
        const rootResult = this.db.exec(`SELECT id FROM nodes WHERE type = 'file'`);
        if (rootResult.length > 0 && rootResult[0].values) {
          currentLevel = rootResult[0].values.map(row => row[0] as string);
        }
        console.log(`📂 Starting from ${currentLevel.length} file nodes as roots`);
      } else {
        currentLevel = seeds;
        console.log(`🌱 Starting from ${seeds.length} seed nodes`);
      }

      // Expandir por profundidade usando BFS (Breadth-First Search)
      for (let level = 0; level <= depth && currentLevel.length > 0; level++) {
        console.log(`🔄 Level ${level}: Processing ${currentLevel.length} nodes`);
        const nextLevel = new Set<string>();

        for (const nodeId of currentLevel) {
          if (visited.has(nodeId)) continue;
          visited.add(nodeId);

          // Adicionar o nó atual
          const nodeResult = this.db.exec(`SELECT id, type, label FROM nodes WHERE id = ?`, [nodeId]);
          if (nodeResult.length > 0 && nodeResult[0].values && nodeResult[0].values.length > 0) {
            const row = nodeResult[0].values[0];
            nodes.push({
              id: row[0] as string,
              type: row[1] as "file" | "chunk" | "workspace",
              label: row[2] as string,
            });
          }

          // Buscar arestas de saída (onde este nó é source)
          const outEdges = this.db.exec(`SELECT id, from_id, to_id, type FROM edges WHERE from_id = ?`, [nodeId]);
          if (outEdges.length > 0 && outEdges[0].values) {
            for (const edgeRow of outEdges[0].values) {
              const targetId = edgeRow[2] as string;
              edges.push({
                id: `edge-${edgeRow[0]}`,
                source: edgeRow[1] as string,
                target: targetId,
                type: edgeRow[3] as string,
                label: edgeRow[3] as string,
              });
              
              // Adicionar target ao próximo nível se não foi visitado
              if (!visited.has(targetId) && level < depth) {
                nextLevel.add(targetId);
              }
            }
          }

          // Buscar arestas de entrada (onde este nó é target) - opcional, para grafo bidirecional
          const inEdges = this.db.exec(`SELECT id, from_id, to_id, type FROM edges WHERE to_id = ?`, [nodeId]);
          if (inEdges.length > 0 && inEdges[0].values) {
            for (const edgeRow of inEdges[0].values) {
              const sourceId = edgeRow[1] as string;
              edges.push({
                id: `edge-${edgeRow[0]}`,
                source: sourceId,
                target: edgeRow[2] as string,
                type: edgeRow[3] as string,
                label: edgeRow[3] as string,
              });
              
              // Adicionar source ao próximo nível se não foi visitado
              if (!visited.has(sourceId) && level < depth) {
                nextLevel.add(sourceId);
              }
            }
          }

          // Verificar se atingimos o limite de nós
          if (nodes.length >= maxNodes) {
            console.warn(`⚠️ SQLite: Reached maxNodes limit (${maxNodes})`);
            break;
          }
        }

        currentLevel = Array.from(nextLevel);
        
        if (nodes.length >= maxNodes) break;
      }

      console.log(`✅ SQLite: Loaded ${nodes.length} nodes and ${edges.length} edges (depth=${depth})`);
      
      // Remover arestas duplicadas
      const uniqueEdges = new Map<string, typeof edges[0]>();
      edges.forEach(edge => {
        const key = `${edge.source}->${edge.target}:${edge.type}`;
        if (!uniqueEdges.has(key)) {
          uniqueEdges.set(key, edge);
        }
      });

      return { nodes, edges: Array.from(uniqueEdges.values()) };
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

    if (relationships.length === 0) {
      console.log(`⚠️ SQLite: createRelationships called with 0 relationships`);
      return;
    }

    console.log(`📊 SQLite: Creating ${relationships.length} relationships...`);
    
    // Log first few relationships for debugging
    if (relationships.length > 0) {
      console.log(`   Sample relationships:`);
      relationships.slice(0, 3).forEach((rel, i) => {
        console.log(`   ${i + 1}. ${rel.type}: ${rel.from} -> ${rel.to}`);
      });
    }

    let pkgNodesCreated = 0;
    let edgesCreated = 0;

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
      
      try {
        this.db.run(`INSERT OR IGNORE INTO edges (from_id, to_id, type, properties) VALUES (?, ?, ?, ?)`, [
          rel.from,
          rel.to,
          rel.type,
          properties,
        ]);
        edgesCreated++;
      } catch (error) {
        console.error(`❌ Failed to create edge: ${rel.type} from ${rel.from} to ${rel.to}`, error);
      }
    }

    this.saveToFile();
    
    if (pkgNodesCreated > 0) {
      console.log(`✅ SQLite: Created ${edgesCreated}/${relationships.length} relationships (${pkgNodesCreated} package nodes auto-created)`);
    } else {
      console.log(`✅ SQLite: Created ${edgesCreated}/${relationships.length} relationships`);
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

  /**
   * Fetches chunks by their IDs from the vectors table and maps them to DocumentChunk
   */
  async getChunksByIds(ids: string[]): Promise<DocumentChunk[]> {
    if (!this.db) return [];
    if (!ids || ids.length === 0) return [];

    try {
      // Ensure vectors table exists (noop if already created)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS vectors (
          chunk_id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          embedding_json TEXT NOT NULL,
          metadata TEXT
        )
      `);

      const placeholders = ids.map(() => '?').join(',');
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
            filePath: (meta.filePath as string) || '',
            lineStart: (meta.lineStart as number) ?? 0,
            lineEnd: (meta.lineEnd as number) ?? 0,
            chunkType: (meta.chunkType as DocumentChunk['metadata']['chunkType']) || 'plain_text',
            symbolName: meta.symbolName as string | undefined,
            symbolKind: meta.symbolKind as DocumentChunk['metadata']['symbolKind'] | undefined,
          },
        };
      });

      return chunks;
    } catch (error) {
      console.error('❌ SQLite getChunksByIds error:', error);
      return [];
    }
  }
}

export function createSQLiteAdapter(dbPath: string): GraphStorePort {
  return new SQLiteAdapter(dbPath);
}