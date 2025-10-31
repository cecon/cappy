/**
 * @fileoverview Simplified SQLite adapter for graph storage using sqlite3
 * @module adapters/secondary/graph/sqlite-simple-adapter
 * @since 3.0.0
 */

import sqlite3 from "sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import * as sqliteVec from "sqlite-vec";

import type { GraphStorePort } from "../../../domains/dashboard/ports/indexing-port";
import type { DocumentChunk } from "../../../shared/types/chunk";

/**
 * Simplified SQLite adapter using sqlite3
 * Compatible with VS Code Extension Host
 */
export class SQLiteAdapter implements GraphStorePort {
  private readonly dbPath: string;
  private db: sqlite3.Database | null = null;
  private dbFilePath = "";
  private vecExtensionLoaded = false;

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
      await new Promise<void>((resolve, reject) => {
        this.db = new sqlite3.Database(dbFilePath, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      await this.run("PRAGMA foreign_keys = ON");
      
      // Carregar extensão sqlite-vec
      try {
        const vecPath = sqliteVec.getLoadablePath();
        await new Promise<void>((resolve, reject) => {
          this.db!.loadExtension(vecPath, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        this.vecExtensionLoaded = true;
        console.log("✅ SQLite: sqlite-vec extension loaded");
      } catch (error) {
        console.warn("⚠️ SQLite: Failed to load sqlite-vec extension:", error);
        console.warn("   Vector search will use fallback method");
      }
      
      await this.createSchema();
      console.log("✅ SQLite: Database initialized");
    } catch (error) {
      console.error("❌ SQLite initialization error:", error);
      throw new Error(`Failed to initialize SQLite: ${error}`);
    }
  }

  async reloadFromDisk(): Promise<void> {
    try {
      if (this.db) {
        await new Promise<void>((resolve) => {
          this.db!.close(() => resolve());
        });
      }
      
      await new Promise<void>((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbFilePath, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      await this.run("PRAGMA foreign_keys = ON");
      await this.createSchema();
      console.log("🔄 SQLite: Reloaded database from disk");
    } catch (error) {
      console.error("❌ SQLite reloadFromDisk error:", error);
    }
  }

  private async run(sql: string, params: unknown[] = []): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.db) throw new Error("Database not initialized");
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  private async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    if (!this.db) throw new Error("Database not initialized");
    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  private async createSchema(): Promise<void> {
    if (!this.db) return;
    
    // Nodes table - Hybrid schema with structured + dynamic discovery fields
    await this.run(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        
        -- Dynamic Discovery (LightRAG-inspired)
        discovered_type TEXT,
        discovered_properties TEXT,
        entity_confidence REAL,
        
        -- Quality & versioning
        quality_score REAL DEFAULT 1.0,
        content_hash TEXT,
        version INTEGER DEFAULT 1,
        
        -- Timestamps
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        
        -- Database sphere
        db_type TEXT,
        host TEXT,
        port INTEGER,
        db_name TEXT,
        db_user TEXT,
        
        -- DB Entity sphere
        entity_type TEXT,
        entity_name TEXT,
        entity_schema TEXT,
        db_id TEXT,
        
        -- Code sphere
        project_path TEXT,
        file_path TEXT,
        line_start INTEGER,
        line_end INTEGER,
        chunk_type TEXT,
        symbol_name TEXT,
        symbol_kind TEXT,
        language TEXT,
        
        -- Documentation sphere
        doc_type TEXT,
        doc_url TEXT,
        doc_format TEXT,
        
        -- Issue sphere
        issue_source TEXT,
        issue_url TEXT,
        issue_status TEXT,
        issue_priority TEXT,
        
        -- Person sphere
        person_role TEXT,
        person_email TEXT,
        person_external_id TEXT,
        
        -- Cappy Task sphere
        cappy_task_status TEXT,
        cappy_task_type TEXT,
        
        -- Extensibility
        extra_metadata TEXT
      )
    `);
    
    // Edges table - Hybrid with dynamic relationship discovery
    await this.run(`
      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL,
        
        -- Dynamic Discovery
        discovered_relationship_type TEXT,
        semantic_context TEXT,
        relationship_confidence REAL,
        
        -- Metadata
        context TEXT,
        confidence REAL DEFAULT 1.0,
        quality_score REAL DEFAULT 1.0,
        status TEXT DEFAULT 'active',
        
        -- Timestamps
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        
        -- Extensibility
        extra_metadata TEXT,
        
        UNIQUE(tenant_id, from_id, to_id, type)
      )
    `);
    
    // Vectors table - for semantic search
    await this.run(`
      CREATE TABLE IF NOT EXISTS vectors (
        chunk_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        content TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        embedding_model TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create vec0 virtual table for efficient vector search (if extension loaded)
    if (this.vecExtensionLoaded) {
      try {
        // Check dimensionality from first vector (assuming 1536 for text-embedding-3-small)
        const sample = await this.get<{ embedding_json: string }>(
          `SELECT embedding_json FROM vectors LIMIT 1`
        );
        
        const dimensions = sample ? JSON.parse(sample.embedding_json).length : 1536;
        
        await this.run(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_vectors USING vec0(
            chunk_id TEXT PRIMARY KEY,
            embedding float[${dimensions}]
          )
        `);
        console.log(`✅ SQLite: vec_vectors table created with ${dimensions} dimensions`);
      } catch (error) {
        console.warn("⚠️ SQLite: Failed to create vec_vectors table:", error);
      }
    }
    
    // Create indices for performance
    await this.run(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_nodes_tenant_type ON nodes(tenant_id, type)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_nodes_discovered_type ON nodes(discovered_type)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_nodes_file_path ON nodes(file_path)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_nodes_symbol_name ON nodes(symbol_name)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_edges_from_id ON edges(from_id)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_edges_to_id ON edges(to_id)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_vectors_tenant ON vectors(tenant_id)`);
  }

  async getSubgraph(
    seeds: string[] | undefined,
    depth: number,
    maxNodes = 1000
  ): Promise<{
    nodes: Array<{ 
      id: string; 
      label: string; 
      type: "file" | "chunk" | "workspace";
      metadata?: {
        file_path?: string;
        line_start?: number;
        line_end?: number;
        chunk_type?: string;
        language?: string;
      };
    }>;
    edges: Array<{ id: string; source: string; target: string; label?: string; type: string }>;
  }> {
    if (!this.db) throw new Error("SQLite not initialized");

    const nodes: Array<{ 
      id: string; 
      label: string; 
      type: "file" | "chunk" | "workspace";
      metadata?: {
        file_path?: string;
        line_start?: number;
        line_end?: number;
        chunk_type?: string;
        language?: string;
      };
    }> = [];
    const edges: Array<{ id: string; source: string; target: string; label?: string; type: string }> = [];
    const visited = new Set<string>();

    // Se não há seeds, buscar todos os nós até o limite
    if (!seeds || seeds.length === 0) {
      console.log(`[SQLiteAdapter] getSubgraph: No seeds provided, fetching up to ${maxNodes} nodes`);
      
      // Buscar nós limitados (priorizando arquivos e workspace)
      const allNodes = await this.all<{ 
        id: string; 
        label: string; 
        type: string;
        file_path?: string;
        line_start?: number;
        line_end?: number;
        chunk_type?: string;
        language?: string;
      }>(
        `SELECT id, label, type, file_path, line_start, line_end, chunk_type, language FROM nodes 
         ORDER BY 
           CASE type 
             WHEN 'workspace' THEN 1 
             WHEN 'file' THEN 2 
             WHEN 'entity' THEN 3
             ELSE 4 
           END,
           id 
         LIMIT ?`,
        [maxNodes]
      );
      
      console.log(`[SQLiteAdapter] getSubgraph: Found ${allNodes.length} nodes`);
      
      for (const node of allNodes) {
        nodes.push({
          id: node.id,
          label: node.label,
          type: (node.type === 'file' || node.type === 'chunk' || node.type === 'workspace') 
            ? node.type 
            : 'chunk',
          metadata: {
            file_path: node.file_path,
            line_start: node.line_start,
            line_end: node.line_end,
            chunk_type: node.chunk_type,
            language: node.language
          }
        });
        visited.add(node.id);
      }
      
      // Buscar todas as arestas conectando esses nós
      if (nodes.length > 0) {
        const nodeIds = nodes.map(n => n.id);
        const placeholders = nodeIds.map(() => '?').join(',');
        
        const allEdges = await this.all<{ 
          id: number; 
          from_id: string; 
          to_id: string; 
          type: string;
        }>(
          `SELECT id, from_id, to_id, type FROM edges 
           WHERE from_id IN (${placeholders}) OR to_id IN (${placeholders})`,
          [...nodeIds, ...nodeIds]
        );
        
        console.log(`[SQLiteAdapter] getSubgraph: Found ${allEdges.length} edges`);
        
        for (const edge of allEdges) {
          edges.push({
            id: edge.id.toString(),
            source: edge.from_id,
            target: edge.to_id,
            label: edge.type,
            type: edge.type
          });
        }
      }
      
      return { nodes, edges };
    }
    
    // Se há seeds, buscar a partir deles com profundidade
    console.log(`[SQLiteAdapter] getSubgraph: Starting from ${seeds.length} seeds with depth ${depth}`);
    
    for (let currentDepth = 0; currentDepth <= depth && nodes.length < maxNodes; currentDepth++) {
      const currentSeeds = currentDepth === 0 ? seeds : nodes.slice(-100).map(n => n.id);
      
      for (const seed of currentSeeds) {
        if (visited.has(seed)) continue;
        visited.add(seed);
        
        // Buscar nó com metadata relevante
        const node = await this.get<{ 
          id: string; 
          label: string; 
          type: "file" | "chunk" | "workspace";
          file_path?: string;
          line_start?: number;
          line_end?: number;
          chunk_type?: string;
          language?: string;
        }>(
          `SELECT id, label, type, file_path, line_start, line_end, chunk_type, language FROM nodes WHERE id = ?`,
          [seed]
        );
        
        if (node) {
          nodes.push({
            id: node.id,
            label: node.label,
            type: node.type,
            metadata: {
              file_path: node.file_path,
              line_start: node.line_start,
              line_end: node.line_end,
              chunk_type: node.chunk_type,
              language: node.language
            }
          });
          
          // Buscar arestas
          const nodeEdges = await this.all<{ 
            id: number; 
            from_id: string; 
            to_id: string; 
            type: string;
          }>(
            `SELECT * FROM edges WHERE from_id = ? OR to_id = ?`,
            [seed, seed]
          );
          
          for (const edge of nodeEdges) {
            edges.push({
              id: edge.id.toString(),
              source: edge.from_id,
              target: edge.to_id,
              label: edge.type,
              type: edge.type
            });
          }
        }
      }
    }
    
    console.log(`[SQLiteAdapter] getSubgraph: Returning ${nodes.length} nodes and ${edges.length} edges`);
    return { nodes, edges };
  }

  /**
   * Creates a database entity node (table, view, index, etc)
   * CORRIGIDO: Usando await com métodos assíncronos
   */
  async createDBEntityNode(params: {
    id: string;
    label: string;
    entityType: 'table' | 'view' | 'index' | 'stored_procedure' | 'function';
    entityName: string;
    schema?: string;
    dbId: string;
    discoveredType?: string;
    discoveredProperties?: Record<string, unknown>;
    confidence?: number;
  }): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `INSERT OR REPLACE INTO nodes 
       (id, type, label, entity_type, entity_name, entity_schema, db_id, discovered_type, discovered_properties, entity_confidence) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        'db_entity',
        params.label,
        params.entityType,
        params.entityName,
        params.schema || null,
        params.dbId,
        params.discoveredType || null,
        params.discoveredProperties ? JSON.stringify(params.discoveredProperties) : null,
        params.confidence || null
      ]
    );
  }

  /**
   * Creates an issue node (GitHub, Jira, local, etc.)
   */
  async createIssueNode(params: {
    id: string;
    label: string;
    source: 'github' | 'jira' | 'local' | 'linear';
    url?: string;
    status: string;
    priority?: string;
    discoveredProperties?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `INSERT OR REPLACE INTO nodes 
       (id, type, label, issue_source, issue_url, issue_status, issue_priority, discovered_properties) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        'issue',
        params.label,
        params.source,
        params.url || null,
        params.status,
        params.priority || null,
        params.discoveredProperties ? JSON.stringify(params.discoveredProperties) : null
      ]
    );
  }

  /**
   * Creates a person node (developer, analyst, manager, LLM agent)
   */
  async createPersonNode(params: {
    id: string;
    label: string;
    role: 'developer' | 'analyst' | 'manager' | 'llm_agent';
    email?: string;
    externalId?: string;
    discoveredProperties?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `INSERT OR REPLACE INTO nodes 
       (id, type, label, person_role, person_email, person_external_id, discovered_properties) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        'person',
        params.label,
        params.role,
        params.email || null,
        params.externalId || null,
        params.discoveredProperties ? JSON.stringify(params.discoveredProperties) : null
      ]
    );
  }

  /**
   * Creates a Cappy task node (history of Cappy tasks)
   */
  async createCappyTaskNode(params: {
    id: string;
    label: string;
    taskType: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    discoveredProperties?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `INSERT OR REPLACE INTO nodes 
       (id, type, label, cappy_task_type, cappy_task_status, discovered_properties) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        'cappy_task',
        params.label,
        params.taskType,
        params.status,
        params.discoveredProperties ? JSON.stringify(params.discoveredProperties) : null
      ]
    );
  }

  /**
   * Creates a documentation node
   */
  async createDocumentationNode(params: {
    id: string;
    label: string;
    docType: 'api_doc' | 'tutorial' | 'architecture' | 'manual';
    docUrl?: string;
    docFormat?: 'markdown' | 'pdf' | 'html' | 'docx';
    discoveredType?: string;
    discoveredProperties?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `INSERT OR REPLACE INTO nodes 
       (id, type, label, doc_type, doc_url, doc_format, discovered_type, discovered_properties) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        'documentation',
        params.label,
        params.docType,
        params.docUrl || null,
        params.docFormat || null,
        params.discoveredType || null,
        params.discoveredProperties ? JSON.stringify(params.discoveredProperties) : null
      ]
    );
  }

  /**
   * Updates a node with discovered entity information
   */
  async enrichNodeWithDiscovery(
    nodeId: string,
    discoveredType: string,
    discoveredProperties: Record<string, unknown>,
    confidence: number
  ): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `UPDATE nodes 
       SET discovered_type = ?, discovered_properties = ?, entity_confidence = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [discoveredType, JSON.stringify(discoveredProperties), confidence, nodeId]
    );
  }

  /**
   * Creates a dynamic relationship with semantic context
   */
  async createDynamicRelationship(params: {
    from: string;
    to: string;
    type: string;
    discoveredType: string;
    semanticContext: string;
    confidence: number;
  }): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `INSERT OR IGNORE INTO edges 
       (from_id, to_id, type, discovered_relationship_type, semantic_context, relationship_confidence, confidence) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [params.from, params.to, params.type, params.discoveredType, params.semanticContext, params.confidence, params.confidence]
    );
  }

  /**
   * Creates or updates an entity node in the graph
   */
  async createEntity(entity: {
    name: string;
    type: string;
    confidence: number;
    properties: Record<string, unknown>;
  }): Promise<string> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    const entityId = `entity:${entity.name.toLowerCase().replace(/\s+/g, '-')}`;
    
    await this.run(
      `INSERT OR REPLACE INTO nodes 
       (id, type, label, discovered_type, discovered_properties, entity_confidence, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entityId,
        'entity',
        entity.name,
        entity.type,
        JSON.stringify(entity.properties),
        entity.confidence,
        'active'
      ]
    );
    
    return entityId;
  }

  /**
   * Finds an entity by normalized name and type
   * CORRIGIDO: Usando get ao invés de exec
   */
  async findEntityByNameAndType(name: string, type: string | undefined): Promise<{ id: string } | null> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    const query = type 
      ? `SELECT id FROM nodes WHERE type = 'entity' AND LOWER(label) = ? AND discovered_type = ? LIMIT 1`
      : `SELECT id FROM nodes WHERE type = 'entity' AND LOWER(label) = ? LIMIT 1`;
    
    const params = type ? [name.toLowerCase(), type] : [name.toLowerCase()];
    const result = await this.get<{ id: string }>(query, params);
    
    return result || null;
  }

  /**
   * Links a chunk to an entity
   */
  async linkChunkToEntity(chunkId: string, entityId: string): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `INSERT OR IGNORE INTO edges 
       (from_id, to_id, type, confidence) 
       VALUES (?, ?, ?, ?)`,
      [chunkId, entityId, 'references', 1.0]
    );
  }

  /**
   * Creates a relationship between two entities
   */
  async createRelationship(rel: {
    from: string;
    to: string;
    type: string;
    properties?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    const confidence = rel.properties?.confidence as number || 1.0;
    const context = rel.properties?.context as string || '';
    
    await this.run(
      `INSERT OR IGNORE INTO edges 
       (from_id, to_id, type, semantic_context, confidence) 
       VALUES (?, ?, ?, ?, ?)`,
      [rel.from, rel.to, rel.type, context, confidence]
    );
  }

  // ============================================================
  // GraphStorePort Required Methods
  // ============================================================

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createFileNode(filePath: string, language: string, _linesOfCode: number): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    // _linesOfCode prefixado com _ para indicar que é intencionalmente não usado
    
    await this.run(
      `INSERT OR REPLACE INTO nodes (id, type, label, language, file_path) 
       VALUES (?, ?, ?, ?, ?)`,
      [filePath, "file", path.basename(filePath), language, filePath]
    );
  }

  async createChunkNodes(chunks: DocumentChunk[]): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    for (const chunk of chunks) {
      const label = chunk.metadata.symbolName || 
        `${chunk.metadata.chunkType} [${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}]`;
      
      await this.run(
        `INSERT OR REPLACE INTO nodes 
         (id, type, label, file_path, line_start, line_end, chunk_type, symbol_name, symbol_kind) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chunk.id,
          "chunk",
          label,
          chunk.metadata.filePath,
          chunk.metadata.lineStart,
          chunk.metadata.lineEnd,
          chunk.metadata.chunkType,
          chunk.metadata.symbolName || null,
          chunk.metadata.symbolKind || null
        ]
      );
    }
  }

  async createRelationships(
    relationships: Array<{ 
      from: string; 
      to: string; 
      type: string; 
      properties?: Record<string, string | number | boolean | string[] | null> 
    }>
  ): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    if (relationships.length === 0) return;
    
    for (const rel of relationships) {
      try {
        const confidence = typeof rel.properties?.confidence === 'number' ? rel.properties.confidence : 1;
        const context = typeof rel.properties?.context === 'string' ? rel.properties.context : null;
        const extraMetadata = rel.properties ? JSON.stringify(rel.properties) : null;
        
        await this.run(
          `INSERT OR IGNORE INTO edges (from_id, to_id, type, confidence, context, extra_metadata) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [rel.from, rel.to, rel.type, confidence, context, extraMetadata]
        );
      } catch (error) {
        console.error(`❌ Failed to create edge: ${rel.type} from ${rel.from} to ${rel.to}`, error);
      }
    }
  }

  async getRelatedChunks(ids: string[]): Promise<string[]> {
    if (!this.db || !ids || ids.length === 0) return [];
    
    try {
      const related = new Set<string>();
      
      // Buscar chunks relacionados via edges
      for (const id of ids) {
        const outgoing = await this.all<{ to_id: string }>(
          `SELECT to_id FROM edges WHERE from_id = ? AND type IN ('CONTAINS', 'REFERENCES', 'DOCUMENTS')`,
          [id]
        );
        for (const row of outgoing) {
          related.add(row.to_id);
        }
        
        const incoming = await this.all<{ from_id: string }>(
          `SELECT from_id FROM edges WHERE to_id = ? AND type IN ('CONTAINS', 'REFERENCES', 'DOCUMENTS')`,
          [id]
        );
        for (const row of incoming) {
          related.add(row.from_id);
        }
      }
      
      // Remover os IDs originais do resultado
      for (const id of ids) {
        related.delete(id);
      }
      
      return Array.from(related);
    } catch (error) {
      console.error("❌ SQLite getRelatedChunks error:", error);
      return [];
    }
  }

  async deleteFileNodes(filePath: string): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    // Buscar todos os chunk IDs do arquivo
    const chunks = await this.all<{ id: string }>(
      `SELECT id FROM nodes WHERE type = 'chunk' AND file_path = ?`,
      [filePath]
    );
    
    const chunkIds = chunks.map(c => c.id);
    
    // Deletar edges relacionadas aos chunks
    for (const chunkId of chunkIds) {
      await this.run(`DELETE FROM edges WHERE from_id = ? OR to_id = ?`, [chunkId, chunkId]);
    }
    
    // Deletar edges relacionadas ao arquivo
    await this.run(`DELETE FROM edges WHERE from_id = ? OR to_id = ?`, [filePath, filePath]);
    
    // Deletar nodes dos chunks
    await this.run(`DELETE FROM nodes WHERE type = 'chunk' AND file_path = ?`, [filePath]);
    
    // Deletar node do arquivo
    await this.run(`DELETE FROM nodes WHERE id = ? AND type = 'file'`, [filePath]);
  }

  async deleteFile(filePath: string): Promise<void> {
    return this.deleteFileNodes(filePath);
  }

  async listAllFiles(): Promise<Array<{ path: string; language: string; linesOfCode: number }>> {
    if (!this.db) return [];
    
    const files = await this.all<{ id: string; language: string | null }>(
      `SELECT id, language FROM nodes WHERE type = 'file'`
    );
    
    return files.map(file => ({
      path: file.id,
      language: file.language || "",
      linesOfCode: 0
    }));
  }

  async getFileChunks(filePath: string): Promise<Array<{ 
    id: string; 
    type: string; 
    label: string;
    content: string;
    embedding?: number[];
  }>> {
    if (!this.db) return [];
    
    const chunks = await this.all<{ 
      id: string; 
      type: string; 
      label: string;
    }>(
      `SELECT DISTINCT n.id, n.type, n.label 
       FROM nodes n 
       INNER JOIN edges e ON e.to_id = n.id 
       WHERE e.from_id = ? AND e.type = 'CONTAINS' AND n.type = 'chunk'`,
      [filePath]
    );
    
    // Get content and embeddings from vectors table
    const result = [];
    for (const chunk of chunks) {
      const vectorData = await this.get<{ content: string; embedding_json: string | null }>(
        `SELECT content, embedding_json FROM vectors WHERE chunk_id = ?`,
        [chunk.id]
      );
      
      result.push({
        id: chunk.id,
        type: chunk.type,
        label: chunk.label,
        content: vectorData?.content || '',
        embedding: vectorData?.embedding_json ? JSON.parse(vectorData.embedding_json) : undefined
      });
    }
    
    return result;
  }

  getStats(): { fileNodes: number; chunkNodes: number; relationships: number; duplicates?: number } {
    if (!this.db) return { fileNodes: 0, chunkNodes: 0, relationships: 0, duplicates: 0 };
    
    // getStats é síncrono por requisito da interface, mas sqlite3 é assíncrono
    // Retornamos valores zerados e logamos um aviso
    console.warn("⚠️ getStats called synchronously on async SQLite - returning zeros. Consider using async version.");
    
    return {
      fileNodes: 0,
      chunkNodes: 0,
      relationships: 0,
      duplicates: 0
    };
  }

  /**
   * Versão assíncrona de getStats (recomendada)
   */
  async getStatsAsync(): Promise<{ fileNodes: number; chunkNodes: number; relationships: number; duplicates?: number }> {
    if (!this.db) return { fileNodes: 0, chunkNodes: 0, relationships: 0, duplicates: 0 };
    
    try {
      const fileResult = await this.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM nodes WHERE type = 'file'`
      );
      
      const chunkResult = await this.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM nodes WHERE type = 'chunk'`
      );
      
      const edgeResult = await this.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM edges`
      );
      
      return {
        fileNodes: fileResult?.count || 0,
        chunkNodes: chunkResult?.count || 0,
        relationships: edgeResult?.count || 0,
        duplicates: 0
      };
    } catch (error) {
      console.error("❌ SQLite getStatsAsync error:", error);
      return { fileNodes: 0, chunkNodes: 0, relationships: 0, duplicates: 0 };
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
      const edges = await this.all<{
        id: number;
        from_id: string;
        to_id: string;
        type: string;
        extra_metadata: string | null;
      }>(
        `SELECT id, from_id, to_id, type, extra_metadata FROM edges LIMIT ?`,
        [limit]
      );
      
      return edges.map(edge => ({
        id: edge.id,
        from: edge.from_id,
        to: edge.to_id,
        type: edge.type,
        properties: edge.extra_metadata ? JSON.parse(edge.extra_metadata) : undefined
      }));
    } catch (error) {
      console.error("Error fetching sample relationships:", error);
      return [];
    }
  }

  /**
   * Gets a node by its ID
   */
  async getNode(nodeId: string): Promise<{
    id: string;
    type: string;
    properties: Record<string, unknown>;
  } | null> {
    if (!this.db) return null;
    
    try {
      const node = await this.get<Record<string, unknown>>(
        `SELECT * FROM nodes WHERE id = ?`,
        [nodeId]
      );
      
      if (!node) return null;
      
      return {
        id: node.id as string,
        type: node.type as string,
        properties: node
      };
    } catch (error) {
      console.error("Error fetching node:", error);
      return null;
    }
  }

  /**
   * Gets all relationships for a node (both incoming and outgoing)
   */
  async getRelationships(nodeId: string): Promise<Array<{
    from: string;
    to: string;
    type: string;
  }>> {
    if (!this.db) return [];
    
    try {
      const edges = await this.all<{
        from_id: string;
        to_id: string;
        type: string;
      }>(
        `SELECT from_id, to_id, type FROM edges 
         WHERE from_id = ? OR to_id = ?`,
        [nodeId, nodeId]
      );
      
      return edges.map(edge => ({
        from: edge.from_id,
        to: edge.to_id,
        type: edge.type
      }));
    } catch (error) {
      console.error("Error fetching relationships:", error);
      return [];
    }
  }

  async getRelationshipsByType(): Promise<Record<string, Array<{
    from: string;
    to: string;
    properties?: Record<string, unknown>;
  }>>> {
    if (!this.db) return {};
    
    try {
      const edges = await this.all<{
        type: string;
        from_id: string;
        to_id: string;
        extra_metadata: string | null;
      }>(
        `SELECT type, from_id, to_id, extra_metadata FROM edges ORDER BY type`
      );
      
      const grouped: Record<string, Array<{ from: string; to: string; properties?: Record<string, unknown> }>> = {};
      
      for (const edge of edges) {
        if (!grouped[edge.type]) {
          grouped[edge.type] = [];
        }
        
        grouped[edge.type].push({
          from: edge.from_id,
          to: edge.to_id,
          properties: edge.extra_metadata ? JSON.parse(edge.extra_metadata) : undefined
        });
      }
      
      return grouped;
    } catch (error) {
      console.error("Error fetching relationships by type:", error);
      return {};
    }
  }

  async clearAll(): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(`DELETE FROM edges`);
    await this.run(`DELETE FROM nodes`);
    await this.run(`DELETE FROM vectors`);
    
    console.log("✅ SQLite: All data cleared");
  }

  /**
   * Closes the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(new Error(`Failed to close database: ${err.message}`));
          else resolve();
        });
      });
      this.db = null;
    }
  }

  /**
   * Placeholder: Store document chunk (use createChunkNodes instead)
   */
  async storeDocumentChunk(): Promise<void> {
    // Este método pode ser implementado ou delegado para createChunkNodes
    console.warn("⚠️ storeDocumentChunk called - consider using createChunkNodes instead");
  }

  async storeVector(chunkId: string, embedding: number[], content: string): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `INSERT OR REPLACE INTO vectors 
       (chunk_id, content, embedding_json, embedding_model, created_at) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [chunkId, content, JSON.stringify(embedding), 'default']
    );
  }

  /**
   * Get chunk contents from vectors table
   */
  async getChunkContents(limit = 5000): Promise<Array<{ chunk_id: string; content: string }>> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    return await this.all<{ chunk_id: string; content: string }>(
      `SELECT chunk_id, content FROM vectors LIMIT ?`,
      [limit]
    );
  }

  /**
   * Ensures workspace node exists
   */
  async ensureWorkspaceNode(name: string): Promise<void> {
    if (!this.db) throw new Error("SQLite not initialized");
    
    await this.run(
      `INSERT OR IGNORE INTO nodes (id, type, label) VALUES (?, ?, ?)`,
      [`workspace:${name}`, "workspace", name]
    );
  }

  /**
   * Store embeddings for chunks
   */
  async storeEmbeddings(
    chunks: Array<{ 
      id: string; 
      content: string; 
      embedding: number[]; 
      metadata?: Record<string, unknown>;
    }>
  ): Promise<void> {
    if (!this.db) return;
    
    for (const chunk of chunks) {
      // Armazenar na tabela vectors (formato JSON)
      await this.run(
        `INSERT OR REPLACE INTO vectors (chunk_id, content, embedding_json, metadata) 
         VALUES (?, ?, ?, ?)`,
        [
          chunk.id, 
          chunk.content, 
          JSON.stringify(chunk.embedding), 
          chunk.metadata ? JSON.stringify(chunk.metadata) : null
        ]
      );
      
      // Se extensão vec está carregada, também armazenar na tabela virtual
      if (this.vecExtensionLoaded && chunk.embedding && chunk.embedding.length > 0) {
        try {
          const vecString = JSON.stringify(chunk.embedding);
          // Virtual tables não suportam INSERT OR REPLACE - precisamos deletar primeiro
          await this.run(
            `DELETE FROM vec_vectors WHERE chunk_id = ?`,
            [chunk.id]
          );
          await this.run(
            `INSERT INTO vec_vectors (chunk_id, embedding) VALUES (?, ?)`,
            [chunk.id, vecString]
          );
        } catch (error) {
          console.warn(`⚠️ Failed to store vector for chunk ${chunk.id}:`, error);
        }
      }
    }
  }

  /**
   * Search similar vectors using sqlite-vec
   */
  async searchSimilar(
    queryEmbedding: number[],
    limit = 10
  ): Promise<Array<{ 
    id: string; 
    content: string; 
    score: number; 
    metadata?: Record<string, unknown>;
  }>> {
    if (!this.db) return [];
    
    // Se a extensão vec está carregada e temos um embedding válido, usar busca vetorial
    if (this.vecExtensionLoaded && queryEmbedding && queryEmbedding.length > 0) {
      try {
        // Serializar vetor para formato do sqlite-vec
        const vecString = JSON.stringify(queryEmbedding);
        
        const rows = await this.all<{
          chunk_id: string;
          distance: number;
        }>(
          `
          SELECT 
            chunk_id,
            distance
          FROM vec_vectors
          WHERE embedding MATCH ?
          ORDER BY distance
          LIMIT ?
          `,
          [vecString, limit]
        );
        
        // Buscar conteúdo e metadata dos chunks
        if (rows.length === 0) return [];
        
        const ids = rows.map(r => r.chunk_id);
        const placeholders = ids.map(() => '?').join(',');
        const chunks = await this.all<{
          chunk_id: string;
          content: string;
          metadata: string | null;
        }>(
          `SELECT chunk_id, content, metadata FROM vectors WHERE chunk_id IN (${placeholders})`,
          ids
        );
        
        // Combinar resultados mantendo a ordem de similaridade
        const chunkMap = new Map(chunks.map(c => [c.chunk_id, c]));
        
        return rows
          .map(row => {
            const chunk = chunkMap.get(row.chunk_id);
            if (!chunk) return null;
            
            return {
              id: chunk.chunk_id,
              content: chunk.content,
              score: 1 - row.distance, // Converter distância para score (0-1)
              metadata: chunk.metadata ? JSON.parse(chunk.metadata) : undefined
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
      } catch (error) {
        console.error("❌ SQLite vector search error:", error);
        console.warn("   Falling back to simple search");
      }
    }
    
    // Fallback: implementação simples - retorna os últimos chunks
    console.log("ℹ️ Using fallback search (no vector similarity)");
    const rows = await this.all<{
      chunk_id: string;
      content: string;
      metadata: string | null;
    }>(
      `SELECT chunk_id, content, metadata FROM vectors LIMIT ?`,
      [limit]
    );
    
    return rows.map(row => ({
      id: row.chunk_id,
      content: row.content,
      score: 0.5, // Score dummy
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Get chunks by their IDs
   */
  async getChunksByIds(ids: string[]): Promise<DocumentChunk[]> {
    if (!this.db || !ids || ids.length === 0) return [];
    
    try {
      const placeholders = ids.map(() => '?').join(',');
      const rows = await this.all<{
        chunk_id: string;
        content: string;
        metadata: string | null;
      }>(
        `SELECT chunk_id, content, metadata FROM vectors WHERE chunk_id IN (${placeholders})`,
        ids
      );
      
      return rows.map(row => {
        const metadata = row.metadata ? JSON.parse(row.metadata) : {};
        return {
          id: row.chunk_id,
          content: row.content,
          metadata: {
            filePath: metadata.filePath || '',
            lineStart: metadata.lineStart || 0,
            lineEnd: metadata.lineEnd || 0,
            chunkType: metadata.chunkType || 'plain_text',
            symbolName: metadata.symbolName,
            symbolKind: metadata.symbolKind
          }
        } as DocumentChunk;
      });
    } catch (error) {
      console.error("❌ SQLite getChunksByIds error:", error);
      return [];
    }
  }
}

export function createSQLiteAdapter(dbPath: string): GraphStorePort {
  return new SQLiteAdapter(dbPath);
}