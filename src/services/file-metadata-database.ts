/**
 * @fileoverview SQLite database for file metadata and processing queue management
 * @module services/file-metadata-database
 * @author Cappy Team
 * @since 3.0.5
 * 
 * Using sql.js for cross-platform compatibility (pure JavaScript SQLite)
 */

import initSqlJs, { type Database, type SqlJsStatic, type QueryExecResult } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * File processing status
 */
export type FileProcessingStatus = 
  | 'pending'      // Waiting to be processed
  | 'processing'   // Currently being processed
  | 'completed'    // Successfully processed
  | 'failed'       // Processing failed
  | 'cancelled';   // Processing cancelled

/**
 * File metadata record
 */
export interface FileMetadata {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  status: FileProcessingStatus;
  progress: number;
  currentStep?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  chunksCount?: number;
  nodesCount?: number;
  relationshipsCount?: number;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

type SqlValue = string | number | null | Uint8Array;

/**
 * SQLite database for file metadata management (using sql.js)
 */
export class FileMetadataDatabase {
  private db: Database | null = null;
  private dbPath: string;
  private SQL: SqlJsStatic | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initializes database and creates tables
   */
  async initialize(): Promise<void> {
    this.SQL = await initSqlJs();
    
    // Try to load existing database file
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      // Create new database
      this.db = new this.SQL.Database();
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    this.createTables();
    this.save();
    console.log('✅ File metadata database initialized');
  }

  /**
   * Saves database to disk
   */
  private save(): void {
    if (!this.db) throw new Error('Database not initialized');
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, data);
  }

  /**
   * Creates database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(`
      CREATE TABLE IF NOT EXISTS file_metadata (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
        progress INTEGER DEFAULT 0,
        current_step TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        processing_started_at TEXT,
        processing_completed_at TEXT,
        chunks_count INTEGER,
        nodes_count INTEGER,
        relationships_count INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_status ON file_metadata(status);
      CREATE INDEX IF NOT EXISTS idx_file_path ON file_metadata(file_path);
      CREATE INDEX IF NOT EXISTS idx_created_at ON file_metadata(created_at);
      CREATE INDEX IF NOT EXISTS idx_updated_at ON file_metadata(updated_at);
    `);
  }

  /**
   * Inserts a new file record
   */
  insertFile(metadata: Omit<FileMetadata, 'createdAt' | 'updatedAt'>): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    
    this.db.run(
      `INSERT INTO file_metadata (
        id, file_path, file_name, file_size, file_hash, status, progress,
        current_step, error_message, retry_count, max_retries,
        created_at, updated_at, processing_started_at, processing_completed_at,
        chunks_count, nodes_count, relationships_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        metadata.id,
        metadata.filePath,
        metadata.fileName,
        metadata.fileSize,
        metadata.fileHash,
        metadata.status,
        metadata.progress || 0,
        metadata.currentStep || null,
        metadata.errorMessage || null,
        metadata.retryCount || 0,
        metadata.maxRetries || 3,
        now,
        now,
        metadata.processingStartedAt || null,
        metadata.processingCompletedAt || null,
        metadata.chunksCount || null,
        metadata.nodesCount || null,
        metadata.relationshipsCount || null
      ]
    );
    
    this.save();
  }

  /**
   * Updates file status and metadata
   */
  updateFile(
    id: string,
    updates: Partial<Omit<FileMetadata, 'id' | 'createdAt'>>
  ): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: SqlValue[] = [];

    // Build dynamic UPDATE query
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.progress !== undefined) {
      fields.push('progress = ?');
      values.push(updates.progress);
    }
    if (updates.currentStep !== undefined) {
      fields.push('current_step = ?');
      values.push(updates.currentStep);
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }
    if (updates.retryCount !== undefined) {
      fields.push('retry_count = ?');
      values.push(updates.retryCount);
    }
    if (updates.processingStartedAt !== undefined) {
      fields.push('processing_started_at = ?');
      values.push(updates.processingStartedAt || null);
    }
    if (updates.processingCompletedAt !== undefined) {
      fields.push('processing_completed_at = ?');
      values.push(updates.processingCompletedAt || null);
    }
    if (updates.chunksCount !== undefined) {
      fields.push('chunks_count = ?');
      values.push(updates.chunksCount);
    }
    if (updates.nodesCount !== undefined) {
      fields.push('nodes_count = ?');
      values.push(updates.nodesCount);
    }
    if (updates.relationshipsCount !== undefined) {
      fields.push('relationships_count = ?');
      values.push(updates.relationshipsCount);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const sql = `UPDATE file_metadata SET ${fields.join(', ')} WHERE id = ?`;
    this.db.run(sql, values);
    this.save();
  }

  /**
   * Gets file by ID
   */
  getFile(id: string): FileMetadata | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM file_metadata WHERE id = ?', [id]);
    return this.mapFirstRow(result);
  }

  /**
   * Gets file by numeric ID (alias for API compatibility)
   */
  getFileMetadata(id: number): FileMetadata | null {
    return this.getFile(String(id));
  }

  /**
   * Gets all file metadata records
   */
  getAllFileMetadata(): FileMetadata[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM file_metadata ORDER BY created_at DESC');
    return this.mapRows(result);
  }

  /**
   * Gets file by path
   */
  getFileByPath(filePath: string): FileMetadata | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM file_metadata WHERE file_path = ?', [filePath]);
    return this.mapFirstRow(result);
  }

  /**
   * Gets all files with specific status
   */
  getFilesByStatus(status: FileProcessingStatus): FileMetadata[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec(
      'SELECT * FROM file_metadata WHERE status = ? ORDER BY created_at ASC',
      [status]
    );
    return this.mapRows(result);
  }

  /**
   * Gets all pending files (for queue processing)
   */
  getPendingFiles(limit?: number): FileMetadata[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const sql = limit
      ? 'SELECT * FROM file_metadata WHERE status = "pending" ORDER BY created_at ASC LIMIT ?'
      : 'SELECT * FROM file_metadata WHERE status = "pending" ORDER BY created_at ASC';
    
    const result = this.db.exec(sql, limit ? [limit] : []);
    return this.mapRows(result);
  }

  /**
   * Gets database statistics
   */
  getStats(): DatabaseStats {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM file_metadata
    `);

    if (result.length === 0 || result[0].values.length === 0) {
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
    }

    const row = result[0].values[0];
    return {
      total: Number(row[0]) || 0,
      pending: Number(row[1]) || 0,
      processing: Number(row[2]) || 0,
      completed: Number(row[3]) || 0,
      failed: Number(row[4]) || 0,
      cancelled: Number(row[5]) || 0
    };
  }

  /**
   * Deletes a file record
   */
  deleteFile(id: string): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run('DELETE FROM file_metadata WHERE id = ?', [id]);
    this.save();
  }

  /**
   * Deletes all files with specific status
   */
  deleteFilesByStatus(status: FileProcessingStatus): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run('DELETE FROM file_metadata WHERE status = ?', [status]);
    this.save();
  }

  /**
   * Clears all records
   */
  clearAll(): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run('DELETE FROM file_metadata');
    this.save();
  }

  /**
   * Resets failed files for retry (sets status back to pending)
   */
  resetFailedFiles(): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    this.db.run(`
      UPDATE file_metadata 
      SET status = 'pending', 
          error_message = NULL, 
          updated_at = ?,
          processing_started_at = NULL,
          processing_completed_at = NULL
      WHERE status = 'failed' AND retry_count < max_retries
    `, [now]);
    
    this.save();
  }

  /**
   * Closes database connection
   */
  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Maps QueryExecResult to FileMetadata array
   */
  private mapRows(result: QueryExecResult[]): FileMetadata[] {
    if (result.length === 0) return [];
    
    const { columns, values } = result[0];
    return values.map(row => this.rowToMetadata(columns, row));
  }

  /**
   * Maps first row of QueryExecResult to FileMetadata
   */
  private mapFirstRow(result: QueryExecResult[]): FileMetadata | null {
    if (result.length === 0 || result[0].values.length === 0) return null;
    
    const { columns, values } = result[0];
    return this.rowToMetadata(columns, values[0]);
  }

  /**
   * Converts a row array to FileMetadata object
   */
  private rowToMetadata(columns: string[], row: SqlValue[]): FileMetadata {
    const obj: Record<string, SqlValue> = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });

    return {
      id: String(obj.id),
      filePath: String(obj.file_path),
      fileName: String(obj.file_name),
      fileSize: Number(obj.file_size),
      fileHash: String(obj.file_hash),
      status: String(obj.status) as FileProcessingStatus,
      progress: Number(obj.progress),
      currentStep: obj.current_step ? String(obj.current_step) : undefined,
      errorMessage: obj.error_message ? String(obj.error_message) : undefined,
      retryCount: Number(obj.retry_count),
      maxRetries: Number(obj.max_retries),
      createdAt: String(obj.created_at),
      updatedAt: String(obj.updated_at),
      processingStartedAt: obj.processing_started_at ? String(obj.processing_started_at) : undefined,
      processingCompletedAt: obj.processing_completed_at ? String(obj.processing_completed_at) : undefined,
      chunksCount: obj.chunks_count ? Number(obj.chunks_count) : undefined,
      nodesCount: obj.nodes_count ? Number(obj.nodes_count) : undefined,
      relationshipsCount: obj.relationships_count ? Number(obj.relationships_count) : undefined
    };
  }
}
