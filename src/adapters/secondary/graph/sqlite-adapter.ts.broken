/**
 * @fileoverview SQLite adapter for graph storage and vector search
 * @module adapters/secondary/graph/sqlite-adapter
 * @author Cappy Team
 * @since 3.0.0
 * 
 * Features:
 * - Graph storage with recursive CTEs for traversal
 * - Vector similarity search with manual distance calculation
 * - Single database for all data (nodes, edges, vectors)
 * - Uses sql.js (WASM) for compatibility with VS Code Extension Host
 */

import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import * as fs from "fs";
import * as path from "path";

import type { GraphStorePort } from "../../../domains/graph/ports/indexing-port";
import type { DocumentChunk } from "../../../types/chunk";

/**
 * SQLite adapter implementing GraphStorePort using sql.js
 * Supports graph traversal using recursive CTEs
 */
export class SQLiteAdapter implements GraphStorePort {
  private readonly dbPath: string;
  private db: SqlJsDatabase | null = null;
  private initialized = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initializes the SQLite database connection and creates schema
   */
  async initialize(): Promise<void> {
    console.log(`📊 Initializing SQLite database: ${this.dbPath}`);

    // Resolve and create directory
    let dbFilePath = this.dbPath;
    if (!path.isAbsolute(dbFilePath)) {
      dbFilePath = path.resolve(dbFilePath);
    }

    // If path is directory, use graph.db filename
    if (fs.existsSync(dbFilePath) && fs.statSync(dbFilePath).isDirectory()) {
      dbFilePath = path.join(dbFilePath, "graph.db");
    } else if (!path.extname(dbFilePath)) {
      dbFilePath = path.join(dbFilePath, "graph.db");
    }

    // Create parent directory
    const parentDir = path.dirname(dbFilePath);
    if (!fs.existsSync(parentDir)) {
      console.log(`📁 Creating directory: ${parentDir}`);
      fs.mkdirSync(parentDir, { recursive: true });
    }

    console.log(`📁 SQLite: Using database file: ${dbFilePath}`);

    try {
      // Initialize sql.js
      const SQL = await initSqlJs({
        locateFile: (file) => {
          // Use bundled WASM file
          return `https://sql.js.org/dist/${file}`;
        },
      });
      console.log(`✅ sql.js initialized`);

      // Load existing database or create new
      let buffer: Uint8Array | undefined;
      if (fs.existsSync(dbFilePath)) {
        buffer = fs.readFileSync(dbFilePath);
        console.log(`📁 Loaded existing database from ${dbFilePath}`);
      }

      this.db = new SQL.Database(buffer);
      console.log(`✅ SQLite database opened`);

      // Enable foreign keys
      this.db.run("PRAGMA foreign_keys = ON");

      // Create schema
      this.createSchema();

      // Save database to file
      this.saveToFile(dbFilePath);

      this.initialized = true;
      console.log("✅ SQLite: Database initialized with schema");
    } catch (error) {
      console.error("❌ SQLite initialization error:", error);
      throw new Error(`Failed to initialize SQLite: ${error}`);
    }
  }

  /**
   * Saves database to file
   */
  private saveToFile(filePath: string): void {
    if (!this.db) {
      return;
    }

    try {
      const data = this.db.export();
      fs.writeFileSync(filePath, Buffer.from(data));
      console.log(`💾 Database saved to ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to save database: ${error}`);
    }
  }

  /**
   * Creates the database schema for nodes, relationships, and vectors
   */
  private createSchema(): void {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    // Load sqlite-vss extension
    try {
      sqlite_vss.load(this.db);
      console.log(`✅ Loaded sqlite-vss extension`);
    } catch (error) {
      console.warn(`⚠️ Failed to load sqlite-vss extension: ${error}`);
    }

    // Create nodes table (unified for File, Chunk, Workspace)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('file', 'chunk', 'workspace')),
        label TEXT NOT NULL,
        properties TEXT, -- JSON string for additional properties
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
    `);
    console.log(`✅ Created nodes table`);

    // Create edges table (relationships)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('CONTAINS', 'DOCUMENTS', 'BELONGS_TO')),
        properties TEXT, -- JSON string for additional properties (e.g., order)
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (to_id) REFERENCES nodes(id) ON DELETE CASCADE,
        UNIQUE(from_id, to_id, type) -- Prevent duplicate edges
      );
      
      CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);
      CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
      CREATE INDEX IF NOT EXISTS idx_edges_from_type ON edges(from_id, type);
    `);
    console.log(`✅ Created edges table`);

    // Create vectors table for embeddings
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        chunk_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL, -- Binary embedding vector
        content TEXT NOT NULL, -- Original text content
        metadata TEXT, -- JSON string for chunk metadata
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (chunk_id) REFERENCES nodes(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_vectors_chunk ON vectors(chunk_id);
    `);
    console.log(`✅ Created vectors table`);

    // Create virtual table for vector similarity search (if sqlite-vss loaded)
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vss_vectors USING vss0(
          embedding(384) -- 384 dimensions for all-MiniLM-L6-v2
        );
      `);
      console.log(`✅ Created vss_vectors virtual table`);
    } catch (error) {
      console.warn(`⚠️ Could not create vss_vectors table: ${error}`);
    }
  }

  /**
   * Stores chunk embeddings for vector search
   */
  async storeEmbeddings(
    chunks: Array<{
      id: string;
      content: string;
      embedding: number[];
      metadata?: Record<string, unknown>;
    }>
  ): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      const vectorStmt = this.db.prepare(`
        INSERT OR REPLACE INTO vectors (chunk_id, embedding, content, metadata)
        VALUES (?, ?, ?, ?)
      `);

      const vssStmt = this.db.prepare(`
        INSERT OR REPLACE INTO vss_vectors (rowid, embedding)
        VALUES (?, ?)
      `);

      const transaction = this.db.transaction(
        (
          chunks: Array<{
            id: string;
            content: string;
            embedding: number[];
            metadata?: Record<string, unknown>;
          }>
        ) => {
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embeddingBlob = Buffer.from(
              new Float32Array(chunk.embedding).buffer
            );
            const metadata = chunk.metadata ? JSON.stringify(chunk.metadata) : null;

            // Store in vectors table
            vectorStmt.run(chunk.id, embeddingBlob, chunk.content, metadata);

            // Store in vss virtual table (rowid = i+1 for simplicity)
            try {
              vssStmt.run(i + 1, embeddingBlob);
            } catch (error) {
              console.warn(`⚠️ Could not insert into vss_vectors: ${error}`);
            }
          }
        }
      );

      transaction(chunks);
      console.log(`✅ SQLite: Stored ${chunks.length} embeddings`);
    } catch (error) {
      console.error("❌ SQLite storeEmbeddings error:", error);
      throw new Error(`Failed to store embeddings: ${error}`);
    }
  }

  /**
   * Searches for similar chunks using vector similarity
   */
  async searchSimilar(
    queryEmbedding: number[],
    limit = 10
  ): Promise<
    Array<{
      id: string;
      content: string;
      score: number;
      metadata?: Record<string, unknown>;
    }>
  > {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      const queryBlob = Buffer.from(new Float32Array(queryEmbedding).buffer);

      // Try using vss first
      try {
        const rows = this.db
          .prepare(
            `
          SELECT 
            v.chunk_id as id,
            v.content,
            v.metadata,
            vss.distance as score
          FROM vss_vectors vss
          JOIN vectors v ON vss.rowid = (
            SELECT rowid FROM vectors WHERE chunk_id = v.chunk_id LIMIT 1
          )
          WHERE vss_search(vss.embedding, ?)
          ORDER BY vss.distance ASC
          LIMIT ?
        `
          )
          .all(queryBlob, limit) as Array<{
          id: string;
          content: string;
          metadata: string | null;
          score: number;
        }>;

        return rows.map((row) => ({
          id: row.id,
          content: row.content,
          score: row.score,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));
      } catch (vssError) {
        console.warn(`⚠️ VSS search failed, falling back to simple query: ${vssError}`);

        // Fallback: return all vectors (not ideal for production)
        const rows = this.db
          .prepare(
            `
          SELECT chunk_id as id, content, metadata
          FROM vectors
          LIMIT ?
        `
          )
          .all(limit) as Array<{
          id: string;
          content: string;
          metadata: string | null;
        }>;

        return rows.map((row) => ({
          id: row.id,
          content: row.content,
          score: 0, // No score available in fallback
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));
      }
    } catch (error) {
      console.error("❌ SQLite searchSimilar error:", error);
      return [];
    }
  }

  /**
   * Gets embeddings for specific chunks
   */
  async getEmbeddings(
    chunkIds: string[]
  ): Promise<
    Array<{
      id: string;
      embedding: number[];
      content: string;
    }>
  > {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      const placeholders = chunkIds.map(() => "?").join(",");
      const rows = this.db
        .prepare(
          `
        SELECT chunk_id as id, embedding, content
        FROM vectors
        WHERE chunk_id IN (${placeholders})
      `
        )
        .all(...chunkIds) as Array<{
        id: string;
        embedding: Buffer;
        content: string;
      }>;

      return rows.map((row) => ({
        id: row.id,
        embedding: Array.from(new Float32Array(row.embedding.buffer)),
        content: row.content,
      }));
    } catch (error) {
      console.error("❌ SQLite getEmbeddings error:", error);
      return [];
    }
  }

  /**
   * Returns a subgraph expanded from seed nodes up to a given depth
   * Uses recursive CTE for graph traversal
   */
  async getSubgraph(
    seeds: string[] | undefined,
    depth: number,
    maxNodes = 1000
  ): Promise<{
    nodes: Array<{
      id: string;
      label: string;
      type: "file" | "chunk" | "workspace";
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
      type: string;
    }>;
  }> {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      let nodeQuery: string;
      let nodeParams: unknown[] = [];

      if (seeds && seeds.length > 0) {
        // Expand from seed nodes using recursive CTE
        const placeholders = seeds.map(() => "?").join(",");
        nodeQuery = `
          WITH RECURSIVE graph_traversal(node_id, level) AS (
            -- Base case: seed nodes at level 0
            SELECT id, 0 FROM nodes WHERE id IN (${placeholders})
            
            UNION
            
            -- Recursive case: traverse edges up to depth
            SELECT DISTINCT 
              CASE 
                WHEN e.from_id = gt.node_id THEN e.to_id
                ELSE e.from_id
              END as node_id,
              gt.level + 1
            FROM graph_traversal gt
            JOIN edges e ON (e.from_id = gt.node_id OR e.to_id = gt.node_id)
            WHERE gt.level < ?
          )
          SELECT DISTINCT n.id, n.type, n.label, n.properties
          FROM nodes n
          JOIN graph_traversal gt ON n.id = gt.node_id
          LIMIT ?
        `;
        nodeParams = [...seeds, depth, maxNodes];
      } else {
        // No seeds: return all nodes (limited)
        nodeQuery = `
          SELECT id, type, label, properties
          FROM nodes
          LIMIT ?
        `;
        nodeParams = [maxNodes];
      }

      const nodeRows = this.db.prepare(nodeQuery).all(...nodeParams) as Array<{
        id: string;
        type: string;
        label: string;
        properties: string | null;
      }>;

      console.log(`📊 SQLite: Found ${nodeRows.length} nodes`);

      const nodes = nodeRows.map((row) => ({
        id: row.id,
        label: row.label,
        type: row.type as "file" | "chunk" | "workspace",
      }));

      // Get edges between returned nodes
      const nodeIds = nodes.map((n) => n.id);
      if (nodeIds.length === 0) {
        return { nodes: [], edges: [] };
      }

      const placeholders = nodeIds.map(() => "?").join(",");
      const edgeQuery = `
        SELECT id, from_id, to_id, type, properties
        FROM edges
        WHERE from_id IN (${placeholders}) AND to_id IN (${placeholders})
      `;

      const edgeRows = this.db.prepare(edgeQuery).all(...nodeIds, ...nodeIds) as Array<{
        id: number;
        from_id: string;
        to_id: string;
        type: string;
        properties: string | null;
      }>;

      console.log(`📊 SQLite: Found ${edgeRows.length} edges`);

      const edges = edgeRows.map((row) => ({
        id: `edge-${row.id}`,
        source: row.from_id,
        target: row.to_id,
        label: row.type,
        type: row.type,
      }));

      console.log(
        `✅ SQLite: Loaded subgraph with ${nodes.length} nodes and ${edges.length} edges`
      );
      return { nodes, edges };
    } catch (error) {
      console.error("❌ SQLite getSubgraph error:", error);
      throw new Error(`Failed to get subgraph: ${error}`);
    }
  }

  /**
   * Creates a file node
   */
  async createFileNode(
    filePath: string,
    language: string,
    linesOfCode: number
  ): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      const properties = JSON.stringify({ language, linesOfCode });
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO nodes (id, type, label, properties)
        VALUES (?, 'file', ?, ?)
      `);

      stmt.run(filePath, path.basename(filePath), properties);
      console.log(`✅ SQLite: Created file node for ${filePath}`);
    } catch (error) {
      console.error("❌ SQLite createFileNode error:", error);
      throw new Error(`Failed to create file node: ${error}`);
    }
  }

  /**
   * Creates chunk nodes in batch
   */
  async createChunkNodes(chunks: DocumentChunk[]): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO nodes (id, type, label, properties)
        VALUES (?, 'chunk', ?, ?)
      `);

      const transaction = this.db.transaction((chunks: DocumentChunk[]) => {
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

          stmt.run(chunk.id, label, properties);
        }
      });

      transaction(chunks);
      console.log(`✅ SQLite: Created ${chunks.length} chunk nodes`);
    } catch (error) {
      console.error("❌ SQLite createChunkNodes error:", error);
      throw new Error(`Failed to create chunk nodes: ${error}`);
    }
  }

  /**
   * Creates relationships between nodes
   */
  async createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, string | number | boolean>;
    }>
  ): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO edges (from_id, to_id, type, properties)
        VALUES (?, ?, ?, ?)
      `);

      const transaction = this.db.transaction(
        (
          rels: Array<{
            from: string;
            to: string;
            type: string;
            properties?: Record<string, string | number | boolean>;
          }>
        ) => {
          for (const rel of rels) {
            const properties = rel.properties ? JSON.stringify(rel.properties) : null;
            stmt.run(rel.from, rel.to, rel.type, properties);
          }
        }
      );

      transaction(relationships);
      console.log(`✅ SQLite: Created ${relationships.length} relationships`);
    } catch (error) {
      console.error("❌ SQLite createRelationships error:", error);
      throw new Error(`Failed to create relationships: ${error}`);
    }
  }

  /**
   * Gets related chunks using recursive traversal
   */
  async getRelatedChunks(chunkIds: string[], depth = 2): Promise<string[]> {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      const placeholders = chunkIds.map(() => "?").join(",");

      const query = `
        WITH RECURSIVE chunk_traversal(chunk_id, level) AS (
          -- Base case: starting chunks
          SELECT id, 0 
          FROM nodes 
          WHERE id IN (${placeholders}) AND type = 'chunk'
          
          UNION
          
          -- Recursive case: traverse relationships
          SELECT DISTINCT 
            CASE 
              WHEN e.from_id = ct.chunk_id THEN e.to_id
              ELSE e.from_id
            END as chunk_id,
            ct.level + 1
          FROM chunk_traversal ct
          JOIN edges e ON (e.from_id = ct.chunk_id OR e.to_id = ct.chunk_id)
          JOIN nodes n ON (
            n.id = CASE 
              WHEN e.from_id = ct.chunk_id THEN e.to_id
              ELSE e.from_id
            END
          )
          WHERE ct.level < ? AND n.type = 'chunk'
        )
        SELECT DISTINCT chunk_id
        FROM chunk_traversal
        WHERE chunk_id NOT IN (${placeholders})
      `;

      const rows = this.db.prepare(query).all(...chunkIds, depth, ...chunkIds) as Array<{
        chunk_id: string;
      }>;

      const related = rows.map((row) => row.chunk_id);
      console.log(`✅ SQLite: Found ${related.length} related chunks`);
      return related;
    } catch (error) {
      console.error("❌ SQLite getRelatedChunks error:", error);
      return [];
    }
  }

  /**
   * Deletes file node and all related chunks
   */
  async deleteFileNodes(filePath: string): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      const transaction = this.db.transaction(() => {
        // Delete chunks that belong to this file
        this.db!.prepare(`
          DELETE FROM nodes
          WHERE id IN (
            SELECT n.id
            FROM nodes n
            WHERE n.type = 'chunk' 
            AND json_extract(n.properties, '$.filePath') = ?
          )
        `).run(filePath);

        // Delete file node (CASCADE will handle edges)
        this.db!.prepare(`DELETE FROM nodes WHERE id = ? AND type = 'file'`).run(
          filePath
        );
      });

      transaction();
      console.log(`✅ SQLite: Deleted nodes for ${filePath}`);
    } catch (error) {
      console.error("❌ SQLite deleteFileNodes error:", error);
      throw new Error(`Failed to delete file nodes: ${error}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    return this.deleteFileNodes(filePath);
  }

  /**
   * Lists all files in the database
   */
  async listAllFiles(): Promise<
    Array<{ path: string; language: string; linesOfCode: number }>
  > {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      const rows = this.db.prepare(`
        SELECT id, properties
        FROM nodes
        WHERE type = 'file'
        ORDER BY id
      `).all() as Array<{ id: string; properties: string }>;

      return rows.map((row) => {
        const props = JSON.parse(row.properties || "{}");
        return {
          path: row.id,
          language: props.language || "",
          linesOfCode: props.linesOfCode || 0,
        };
      });
    } catch (error) {
      console.error("❌ SQLite listAllFiles error:", error);
      return [];
    }
  }

  /**
   * Closes database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
    console.log("✅ SQLite: Connection closed");
  }

  /**
   * Gets database statistics
   */
  getStats() {
    if (!this.initialized || !this.db) {
      return { fileNodes: 0, chunkNodes: 0, relationships: 0 };
    }

    try {
      const fileNodes = (
        this.db.prepare(`SELECT COUNT(*) as count FROM nodes WHERE type = 'file'`).get() as {
          count: number;
        }
      ).count;

      const chunkNodes = (
        this.db.prepare(`SELECT COUNT(*) as count FROM nodes WHERE type = 'chunk'`).get() as {
          count: number;
        }
      ).count;

      const relationships = (
        this.db.prepare(`SELECT COUNT(*) as count FROM edges`).get() as { count: number }
      ).count;

      return { fileNodes, chunkNodes, relationships };
    } catch (error) {
      console.error("❌ SQLite getStats error:", error);
      return { fileNodes: 0, chunkNodes: 0, relationships: 0 };
    }
  }

  /**
   * Ensures workspace node exists
   */
  async ensureWorkspaceNode(name: string): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new Error("SQLite not initialized");
    }

    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO nodes (id, type, label, properties)
        VALUES (?, 'workspace', ?, NULL)
      `).run(`workspace:${name}`, name);

      console.log(`✅ SQLite: Ensured workspace node: ${name}`);
    } catch (error) {
      console.error("❌ SQLite ensureWorkspaceNode error:", error);
      throw new Error(`Failed to ensure workspace node: ${error}`);
    }
  }
}

/**
 * Factory function to create SQLite adapter
 */
export function createSQLiteAdapter(dbPath: string): GraphStorePort {
  return new SQLiteAdapter(dbPath);
}
