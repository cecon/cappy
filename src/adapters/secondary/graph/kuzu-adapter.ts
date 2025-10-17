/**
 * @fileoverview Kuzu adapter for graph storage
 * @module adapters/secondary/graph/kuzu-adapter
 * @author Cappy Team
 * @since 3.0.0
 */

// Use the Node.js variant of kuzu-wasm for proper Node filesystem support in the extension host
// eslint-disable-next-line @typescript-eslint/no-require-imports
const kuzu = require("kuzu-wasm/nodejs");
import * as fs from "fs";
import * as path from "path";

import type { GraphStorePort } from "../../../domains/graph/ports/indexing-port";
import type { DocumentChunk } from "../../../types/chunk";

type KuzuDatabase = { close: () => void };
type KuzuConnection = { query: (sql: string) => Promise<unknown> };

/**
 * Kuzu adapter implementing GraphStorePort using kuzu-wasm
 */
export class KuzuAdapter implements GraphStorePort {
  private readonly dbPath: string;
  private db: KuzuDatabase | null = null;
  private conn: KuzuConnection | null = null;
  private initialized = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initializes the Kuzu database connection and creates schema
   */
  async initialize(): Promise<void> {
    console.log(`📊 Initializing Kuzu database (input path): ${this.dbPath}`);

    // Initialize the WASM module (required for async builds)
    if (typeof kuzu.init === "function") {
      await kuzu.init();
    }
    if (typeof kuzu.getVersion === "function") {
      const ver = await kuzu.getVersion();
      console.log(`ℹ️ Kuzu version: ${ver}`);
    }

    // Resolve database file path: allow callers to pass a directory; we create/use `<dir>/graph.kuzu`
    let dbFilePath = this.dbPath;

    // Ensure the path is absolute
    if (!path.isAbsolute(dbFilePath)) {
      dbFilePath = path.resolve(dbFilePath);
    }

    // Determine if path is directory or file
    if (fs.existsSync(dbFilePath) && fs.statSync(dbFilePath).isDirectory()) {
      dbFilePath = path.join(dbFilePath, "graph.kuzu");
    } else if (!path.extname(dbFilePath)) {
      // No extension provided; treat as directory
      dbFilePath = path.join(dbFilePath, "graph.kuzu");
    }

    // Create parent directory with absolute path
    const parentDir = path.dirname(dbFilePath);
    if (!fs.existsSync(parentDir)) {
      console.log(`📁 Creating Kuzu directory: ${parentDir}`);
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Verify directory exists and is accessible
    if (!fs.existsSync(parentDir)) {
      throw new Error(`Failed to create Kuzu directory: ${parentDir}`);
    }

    console.log(`📁 Kuzu: Using database file: ${dbFilePath}`);

    // Kuzu needs the path without extension for the database directory
    const dbPathWithoutExt = dbFilePath.replace(/\.kuzu$/, "");
    console.log(`📁 Kuzu: Database path (no ext): ${dbPathWithoutExt}`);

    // CRITICAL FIX: kuzu-wasm has a bug where it calls getcwd() asynchronously in workers
    // The only reliable workaround is to:
    // 1. Change to parent directory
    // 2. Use relative path
    // 3. NEVER restore CWD (keep it permanently in this directory)
    
    try {
      // CRITICAL: kuzu-wasm workers don't inherit CWD from parent process
      // Solution: Use absolute path directly (kuzu expects path without .kuzu extension)
      console.log(`📁 Using absolute database path: ${dbPathWithoutExt}`);
      
      this.db = new kuzu.Database(dbPathWithoutExt);
      console.log(`✅ Database object created with absolute path`);
      
      this.conn = new kuzu.Connection(this.db);
      console.log(`✅ Connection object created`);

      if (!this.conn) {
        throw new Error("Failed to create Kuzu connection");
      }

      // Create schema for File nodes
      console.log(`📊 Creating File table...`);
      await this.conn.query(`
          CREATE NODE TABLE IF NOT EXISTS File (
            path STRING PRIMARY KEY,
            language STRING,
            linesOfCode INT64
          )
        `);

      // Create schema for Chunk nodes
      console.log(`📊 Creating Chunk table...`);
      await this.conn.query(`
          CREATE NODE TABLE IF NOT EXISTS Chunk (
            id STRING PRIMARY KEY,
            filePath STRING,
            lineStart INT64,
            lineEnd INT64,
            chunkType STRING,
            symbolName STRING,
            symbolKind STRING
          )
        `);

        // Create schema for Workspace nodes
        console.log(`📊 Creating Workspace table...`);
        await this.conn.query(`
          CREATE NODE TABLE IF NOT EXISTS Workspace (
            name STRING PRIMARY KEY
          )
        `);

        // Create relationships
        console.log(`📊 Creating CONTAINS relationship...`);
        await this.conn.query(`
          CREATE REL TABLE IF NOT EXISTS CONTAINS (
            FROM File TO Chunk,
            \`order\` INT64
          )
        `);

        console.log(`📊 Creating DOCUMENTS relationship...`);
        await this.conn.query(`
          CREATE REL TABLE IF NOT EXISTS DOCUMENTS (
            FROM Chunk TO Chunk
          )
        `);

        console.log(`📊 Creating BELONGS_TO relationship...`);
        await this.conn.query(`
          CREATE REL TABLE IF NOT EXISTS BELONGS_TO (
            FROM File TO Workspace
          )
        `);

        this.initialized = true;
        console.log("✅ Kuzu: Database initialized with schema");
        console.log(`⚠️ Note: CWD permanently changed to ${parentDir} (kuzu-wasm workaround)`);
        
      } catch (error) {
        console.error("❌ Kuzu initialization error:", error);
        throw new Error(`Failed to initialize Kuzu: ${error}`);
      }
    }  /**
   * Returns a subgraph expanded from seed nodes up to a given depth.
   */
  async getSubgraph(
    _seeds: string[] | undefined,
    _depth: number,
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
    if (!this.initialized || !this.conn) {
      throw new Error("Kuzu not initialized");
    }

    try {
      type QueryResultPublic = {
        getAllRows?: () => Promise<unknown[]>;
        getNumTuples?: () => Promise<number>;
        table?: { data?: unknown[] };
      };

      console.log("🔍 Kuzu: Querying workspace nodes...");
      const workspaceResult = (await this.conn.query(
        "MATCH (w:Workspace) RETURN w.name AS id, w.name AS label"
      )) as QueryResultPublic;
      let workspaceRows: unknown[] = [];
      try {
        if (typeof workspaceResult.getAllRows === "function") {
          workspaceRows = (await workspaceResult.getAllRows()) || [];
        } else if (typeof workspaceResult.getNumTuples === "function") {
          const n = await workspaceResult.getNumTuples();
          workspaceRows = new Array(n);
        } else {
          workspaceRows = workspaceResult.table?.data || [];
        }
      } catch {
        workspaceRows = workspaceResult.table?.data || [];
      }
      console.log("📊 Workspace query result:", workspaceRows.length, "rows");

      const filesResult = (await this.conn.query(
        "MATCH (f:File) RETURN f.path AS id, f.path AS label"
      )) as QueryResultPublic;
      let fileRows: unknown[] = [];
      try {
        if (typeof filesResult.getAllRows === "function") {
          fileRows = (await filesResult.getAllRows()) || [];
        } else if (typeof filesResult.getNumTuples === "function") {
          const n = await filesResult.getNumTuples();
          fileRows = new Array(n);
        } else {
          fileRows = filesResult.table?.data || [];
        }
      } catch {
        fileRows = filesResult.table?.data || [];
      }
      console.log("📊 Files query result:", fileRows.length, "rows");

      const chunksResult = (await this.conn.query(
        "MATCH (c:Chunk) RETURN c.id AS id, c.symbolName AS symbolName, c.lineStart AS lineStart, c.lineEnd AS lineEnd"
      )) as QueryResultPublic;
      let chunkRows: unknown[] = [];
      try {
        if (typeof chunksResult.getAllRows === "function") {
          chunkRows = (await chunksResult.getAllRows()) || [];
        } else if (typeof chunksResult.getNumTuples === "function") {
          const n = await chunksResult.getNumTuples();
          chunkRows = new Array(n);
        } else {
          chunkRows = chunksResult.table?.data || [];
        }
      } catch {
        chunkRows = chunksResult.table?.data || [];
      }
      console.log("📊 Chunks query result:", chunkRows.length, "rows");

      const nodes: Array<{
        id: string;
        label: string;
        type: "file" | "chunk" | "workspace";
      }> = [];

      if (workspaceRows.length > 0) {
        console.log("✅ Processing workspace nodes...");
        for (const rowRaw of workspaceRows) {
          const row = rowRaw as unknown[];
          const wsNode = {
            id: row[0] as string,
            label: row[1] as string,
            type: "workspace" as const,
          };
          nodes.push(wsNode);
          console.log("   Added workspace node:", wsNode.id);
        }
      } else {
        console.warn("⚠️ No workspace nodes found in query result");
      }

      if (fileRows.length > 0) {
        for (const rowRaw of fileRows) {
          const row = rowRaw as unknown[];
          const fpath = row[0] as string;
          const label = fpath.split("/").pop() || fpath;
          nodes.push({ id: fpath, label, type: "file" });
        }
      }

      if (chunkRows.length > 0) {
        for (const rowRaw of chunkRows) {
          const row = rowRaw as unknown[];
          const id = row[0] as string;
          const symbolName = row[1] as string;
          const lineStart = row[2];
          const lineEnd = row[3];
          const label = symbolName
            ? `${symbolName} [${lineStart}-${lineEnd}]`
            : `chunk [${lineStart}-${lineEnd}]`;
          nodes.push({ id, label, type: "chunk" });
        }
      }

      const limitedNodes = nodes.slice(0, maxNodes);
      const edges: Array<{
        id: string;
        source: string;
        target: string;
        label?: string;
        type: string;
      }> = [];

      const containsResult = (await this.conn.query(
        "MATCH (f:File)-[r:CONTAINS]->(c:Chunk) RETURN f.path, c.id"
      )) as QueryResultPublic;
      let containsRows: unknown[] = [];
      try {
        if (typeof containsResult.getAllRows === "function") {
          containsRows = (await containsResult.getAllRows()) || [];
        } else if (typeof containsResult.getNumTuples === "function") {
          const n = await containsResult.getNumTuples();
          containsRows = new Array(n);
        } else {
          containsRows = containsResult.table?.data || [];
        }
      } catch {
        containsRows = containsResult.table?.data || [];
      }
      if (containsRows.length > 0) {
        for (const rowRaw of containsRows) {
          const row = rowRaw as unknown[];
          const source = row[0] as string;
          const target = row[1] as string;
          edges.push({
            id: `${source}->${target}:CONTAINS`,
            source,
            target,
            label: "CONTAINS",
            type: "CONTAINS",
          });
        }
      }

      const documentsResult = (await this.conn.query(
        "MATCH (c1:Chunk)-[r:DOCUMENTS]->(c2:Chunk) RETURN c1.id, c2.id"
      )) as QueryResultPublic;
      let documentsRows: unknown[] = [];
      try {
        if (typeof documentsResult.getAllRows === "function") {
          documentsRows = (await documentsResult.getAllRows()) || [];
        } else if (typeof documentsResult.getNumTuples === "function") {
          const n = await documentsResult.getNumTuples();
          documentsRows = new Array(n);
        } else {
          documentsRows = documentsResult.table?.data || [];
        }
      } catch {
        documentsRows = documentsResult.table?.data || [];
      }
      if (documentsRows.length > 0) {
        for (const rowRaw of documentsRows) {
          const row = rowRaw as unknown[];
          const source = row[0] as string;
          const target = row[1] as string;
          edges.push({
            id: `${source}->${target}:DOCUMENTS`,
            source,
            target,
            label: "DOCUMENTS",
            type: "DOCUMENTS",
          });
        }
      }

      const belongsResult = (await this.conn.query(
        "MATCH (f:File)-[r:BELONGS_TO]->(w:Workspace) RETURN f.path, w.name"
      )) as QueryResultPublic;
      let belongsRows: unknown[] = [];
      try {
        if (typeof belongsResult.getAllRows === "function") {
          belongsRows = (await belongsResult.getAllRows()) || [];
        } else if (typeof belongsResult.getNumTuples === "function") {
          const n = await belongsResult.getNumTuples();
          belongsRows = new Array(n);
        } else {
          belongsRows = belongsResult.table?.data || [];
        }
      } catch {
        belongsRows = belongsResult.table?.data || [];
      }
      if (belongsRows.length > 0) {
        for (const rowRaw of belongsRows) {
          const row = rowRaw as unknown[];
          const source = row[0] as string;
          const target = row[1] as string;
          edges.push({
            id: `${source}->${target}:BELONGS_TO`,
            source,
            target,
            label: "BELONGS_TO",
            type: "BELONGS_TO",
          });
        }
      }

      console.log(
        `✅ Kuzu: Loaded subgraph with ${limitedNodes.length} nodes and ${edges.length} edges`
      );
      return { nodes: limitedNodes, edges };
    } catch (error) {
      console.error("❌ Kuzu getSubgraph error:", error);
      throw new Error(`Failed to get subgraph: ${error}`);
    }
  }

  async createFileNode(
    path: string,
    language: string,
    linesOfCode: number
  ): Promise<void> {
    if (!this.initialized || !this.conn) {
      throw new Error("Kuzu not initialized");
    }

    try {
      await this.conn.query(`
        MERGE (f:File {path: '${path.replace(
          /'/g,
          "\\'"
        )}', language: '${language}', linesOfCode: ${linesOfCode}})
      `);
      console.log(`✅ Kuzu: Created file node for ${path}`);
    } catch (error) {
      console.error("❌ Kuzu createFileNode error:", error);
      throw new Error(`Failed to create file node: ${error}`);
    }
  }

  async createChunkNodes(chunks: DocumentChunk[]): Promise<void> {
    if (!this.initialized || !this.conn) {
      throw new Error("Kuzu not initialized");
    }

    try {
      for (const chunk of chunks) {
        const symbolName = (chunk.metadata.symbolName || "").replace(
          /'/g,
          "\\'"
        );
        const symbolKind = (chunk.metadata.symbolKind || "").replace(
          /'/g,
          "\\'"
        );
        const chunkType = chunk.metadata.chunkType.replace(/'/g, "\\'");
        const filePath = chunk.metadata.filePath.replace(/'/g, "\\'");
        const id = chunk.id.replace(/'/g, "\\'");

        await this.conn.query(`
          MERGE (c:Chunk {
            id: '${id}',
            filePath: '${filePath}',
            lineStart: ${chunk.metadata.lineStart},
            lineEnd: ${chunk.metadata.lineEnd},
            chunkType: '${chunkType}',
            symbolName: '${symbolName}',
            symbolKind: '${symbolKind}'
          })
        `);
      }
      console.log(`✅ Kuzu: Created ${chunks.length} chunk nodes`);
    } catch (error) {
      console.error("❌ Kuzu createChunkNodes error:", error);
      throw new Error(`Failed to create chunk nodes: ${error}`);
    }
  }

  async createRelationships(
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      properties?: Record<string, string | number | boolean>;
    }>
  ): Promise<void> {
    if (!this.initialized || !this.conn) {
      throw new Error("Kuzu not initialized");
    }

    try {
      for (const rel of relationships) {
        const from = rel.from.replace(/'/g, "\\'");
        const to = rel.to.replace(/'/g, "\\'");

        if (rel.type === "CONTAINS") {
          const order = rel.properties?.order ?? 0;
          await this.conn.query(`
            MATCH (f:File {path: '${from}'}), (c:Chunk {id: '${to}'})
            MERGE (f)-[r:CONTAINS {\`order\`: ${order}}]->(c)
          `);
        } else if (rel.type === "DOCUMENTS") {
          await this.conn.query(`
            MATCH (c1:Chunk {id: '${from}'}), (c2:Chunk {id: '${to}'})
            MERGE (c1)-[r:DOCUMENTS]->(c2)
          `);
        } else if (rel.type === "BELONGS_TO") {
          await this.conn.query(`
            MATCH (f:File {path: '${from}'}), (w:Workspace {name: '${to}'})
            MERGE (f)-[r:BELONGS_TO]->(w)
          `);
        }
      }
      console.log(`✅ Kuzu: Created ${relationships.length} relationships`);
    } catch (error) {
      console.error("❌ Kuzu createRelationships error:", error);
      throw new Error(`Failed to create relationships: ${error}`);
    }
  }

  async getRelatedChunks(chunkIds: string[], depth = 2): Promise<string[]> {
    if (!this.initialized || !this.conn) {
      throw new Error("Kuzu not initialized");
    }

    try {
      const escapedIds = chunkIds
        .map((id) => `'${id.replace(/'/g, "\\'")}'`)
        .join(",");

      type QueryResult = { table?: { data?: unknown[] } };
      const result = (await this.conn.query(`
        MATCH (c1:Chunk)-[*1..${depth}]-(c2:Chunk)
        WHERE c1.id IN [${escapedIds}]
        RETURN DISTINCT c2.id
      `)) as QueryResult;

      const related: string[] = [];
      if (result?.table?.data) {
        for (const rowRaw of result.table.data) {
          const row = rowRaw as unknown[];
          const id = row[0] as string;
          if (!chunkIds.includes(id)) {
            related.push(id);
          }
        }
      }

      console.log(`✅ Kuzu: Found ${related.length} related chunks`);
      return related;
    } catch (error) {
      console.error("❌ Kuzu getRelatedChunks error:", error);
      console.warn(
        "⚠️ Variable-length path query may not be supported, returning empty"
      );
      return [];
    }
  }

  async deleteFileNodes(filePath: string): Promise<void> {
    if (!this.initialized || !this.conn) {
      throw new Error("Kuzu not initialized");
    }

    try {
      const escapedPath = filePath.replace(/'/g, "\\'");

      await this.conn.query(`
        MATCH (f:File {path: '${escapedPath}'})-[r:CONTAINS]->(c:Chunk)
        DELETE r, c
      `);

      await this.conn.query(`
        MATCH (f:File {path: '${escapedPath}'})
        DELETE f
      `);

      console.log(`✅ Kuzu: Deleted nodes for ${filePath}`);
    } catch (error) {
      console.error("❌ Kuzu deleteFileNodes error:", error);
      throw new Error(`Failed to delete file nodes: ${error}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    // Alias for deleteFileNodes
    return this.deleteFileNodes(filePath);
  }

  /**
   * Lists all files in the database
   */
  async listAllFiles(): Promise<
    Array<{ path: string; language: string; linesOfCode: number }>
  > {
    if (!this.initialized || !this.conn) {
      throw new Error("Kuzu not initialized");
    }

    try {
      type QueryResultPublic = {
        getAllRows?: () => Promise<unknown[]>;
        getNumTuples?: () => Promise<number>;
        table?: { data?: unknown[] };
      };

      const result = (await this.conn.query(
        "MATCH (f:File) RETURN f.path AS path, f.language AS language, f.linesOfCode AS linesOfCode"
      )) as QueryResultPublic;

      let rows: unknown[] = [];
      try {
        if (typeof result.getAllRows === "function") {
          rows = (await result.getAllRows()) || [];
        } else if (typeof result.getNumTuples === "function") {
          const n = await result.getNumTuples();
          rows = new Array(n);
        } else {
          rows = result.table?.data || [];
        }
      } catch {
        rows = result.table?.data || [];
      }

      return rows.map((row) => {
        const r = row as unknown[];
        return {
          path: r[0] as string,
          language: r[1] as string,
          linesOfCode: Number(r[2]) || 0,
        };
      });
    } catch (error) {
      console.error("❌ Kuzu listAllFiles error:", error);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.conn = null;
    }
    this.initialized = false;
    console.log("✅ Kuzu: Connection closed");
  }

  getStats() {
    return {
      fileNodes: 0,
      chunkNodes: 0,
      relationships: 0,
    };
  }

  async ensureWorkspaceNode(name: string): Promise<void> {
    if (!this.initialized || !this.conn) {
      throw new Error("Kuzu not initialized");
    }
    try {
      const escapedName = name.replace(/'/g, "\\'");

      // Check if workspace node exists using the public QueryResult API
      const checkResult = await this.conn.query(
        `MATCH (w:Workspace {name: '${escapedName}'}) RETURN w.name`
      );
      type QueryResultPublic = {
        getAllRows?: () => Promise<unknown[]>;
        getNumTuples?: () => Promise<number>;
        table?: { data?: unknown[] };
      };
      // Prefer the public API methods instead of internal .table fields
      let existingRows: unknown[] = [];
      try {
        const r = checkResult as QueryResultPublic;
        if (typeof r.getAllRows === "function") {
          existingRows = (await r.getAllRows()) || [];
        } else if (typeof r.getNumTuples === "function") {
          const n = await r.getNumTuples();
          existingRows = new Array(n);
        }
      } catch (e) {
        console.warn(
          "⚠️ Kuzu: Could not read checkResult rows, falling back to internal table if present",
          e
        );
        // Fallback to internal shape for compatibility
        existingRows = (checkResult as QueryResultPublic)?.table?.data || [];
      }

      if (existingRows.length > 0) {
        console.log(`ℹ️ Kuzu: Workspace node already exists: ${name}`);
        return;
      }

      // Create workspace node if it doesn't exist - use RETURN to force persistence
      try {
        const createResult = await this.conn.query(
          `CREATE (w:Workspace {name: '${escapedName}'}) RETURN w.name`
        );
        let createdRows: unknown[] = [];
        try {
          const cr = createResult as QueryResultPublic;
          if (typeof cr.getAllRows === "function") {
            createdRows = (await cr.getAllRows()) || [];
          } else if (typeof cr.getNumTuples === "function") {
            const n = await cr.getNumTuples();
            createdRows = new Array(n);
          }
        } catch (e) {
          console.warn(
            "⚠️ Kuzu: Could not read createResult rows, falling back to internal table if present",
            e
          );
          createdRows = (createResult as QueryResultPublic)?.table?.data || [];
        }
        console.log(
          `✅ Kuzu: Workspace node created: ${name}`,
          `rows: ${createdRows.length}`
        );
      } catch (createErr) {
        // Normalize error message without using `any`
        const msg = String((createErr as Error)?.message || createErr);
        // If another process inserted the same primary key concurrently, treat as 'exists'
        if (
          msg.includes("duplicated primary key") ||
          msg.includes("duplicate key")
        ) {
          console.log(
            `ℹ️ Kuzu: Workspace node appears to already exist (concurrent insert): ${name}`
          );
        } else {
          console.error(
            "❌ Kuzu ensureWorkspaceNode error during CREATE:",
            createErr
          );
          throw createErr;
        }
      }

      // Verify creation by querying immediately
      const verifyResult = await this.conn.query(
        `MATCH (w:Workspace {name: '${escapedName}'}) RETURN w.name`
      );
      let verifyRows: unknown[] = [];
      try {
        const vr = verifyResult as QueryResultPublic;
        if (typeof vr.getAllRows === "function") {
          verifyRows = (await vr.getAllRows()) || [];
        } else if (typeof vr.getNumTuples === "function") {
          const n = await vr.getNumTuples();
          verifyRows = new Array(n);
        }
      } catch (e) {
        console.warn(
          "⚠️ Kuzu: Could not read verifyResult rows, falling back to internal table if present",
          e
        );
        verifyRows = (verifyResult as QueryResultPublic)?.table?.data || [];
      }
      console.log(
        `🔍 Kuzu: Verification query found ${verifyRows.length} workspace node(s)`
      );
    } catch (error) {
      console.error("❌ Kuzu ensureWorkspaceNode error:", error);
      throw new Error(`Failed to ensure workspace node: ${error}`);
    }
  }
}

export function createKuzuAdapter(dbPath: string): GraphStorePort {
  return new KuzuAdapter(dbPath);
}
