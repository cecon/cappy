/**
 * @fileoverview SQLite database for file metadata and processing queue management
 * @module services/file-metadata-database
 * @author Cappy Team
 * @since 3.0.5
 * 
 * Using sqlite3 for native performance and stability
 */

import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

/**
 * File processing status
 */
export type FileProcessingStatus = 
  | 'pending'                  // Waiting to be processed
  | 'processing'               // Currently being processed
  | 'extracting_entities'      // Extracting entities from file
  | 'creating_relationships'   // Creating relationships in graph
  | 'entity_discovery'         // Running LLM entity discovery
  | 'processed'                // Successfully processed (replaces 'completed')
  | 'completed'                // Legacy status (backward compatibility)
  | 'error'                    // Processing error (replaces 'failed')
  | 'failed'                   // Legacy status (backward compatibility)
  | 'paused'                   // Paused manually by user
  | 'cancelled';               // Processing cancelled

/**
 * File metadata record
 */
export interface FileMetadata {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  fileContent?: string; // Base64 encoded content for uploaded files
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
  extractingEntities: number;
  creatingRelationships: number;
  entityDiscovery: number;
  processed: number;
  completed: number;      // Legacy
  error: number;
  failed: number;         // Legacy
  paused: number;
  cancelled: number;
}

/**
 * SQLite database for file metadata management (using sqlite3)
 */
export class FileMetadataDatabase {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initializes database and creates tables
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to open database: ${err.message}`));
          return;
        }

        // Enable foreign keys and set WAL mode for better concurrency
        this.db!.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) {
            reject(new Error(`Failed to enable foreign keys: ${err.message}`));
            return;
          }

          this.db!.run('PRAGMA journal_mode = WAL', (err) => {
            if (err) {
              reject(new Error(`Failed to set WAL mode: ${err.message}`));
              return;
            }

            this.createTables()
              .then(() => {
                console.log('✅ File metadata database initialized with sqlite3');
                resolve();
              })
              .catch(reject);
          });
        });
      });
    });
  }

  /**
   * Creates database tables
   */
  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.serialize(() => {
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS file_metadata (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL UNIQUE,
            file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            file_hash TEXT NOT NULL,
            file_content TEXT,
            status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'extracting_entities', 'creating_relationships', 'entity_discovery', 'processed', 'error', 'paused')),
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
          )
        `, (err) => {
          if (err) {
            reject(new Error(`Failed to create table: ${err.message}`));
            return;
          }

          // Create indexes
          this.db!.run(`CREATE INDEX IF NOT EXISTS idx_status ON file_metadata(status)`, (err) => {
            if (err) {
              reject(new Error(`Failed to create index: ${err.message}`));
              return;
            }

            this.db!.run(`CREATE INDEX IF NOT EXISTS idx_file_path ON file_metadata(file_path)`, (err) => {
              if (err) {
                reject(new Error(`Failed to create index: ${err.message}`));
                return;
              }

              this.db!.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON file_metadata(created_at)`, (err) => {
                if (err) {
                  reject(new Error(`Failed to create index: ${err.message}`));
                  return;
                }

                this.db!.run(`CREATE INDEX IF NOT EXISTS idx_updated_at ON file_metadata(updated_at)`, (err) => {
                  if (err) {
                    reject(new Error(`Failed to create index: ${err.message}`));
                    return;
                  }

                  console.log('📋 File metadata table and indexes created');
                  resolve();
                });
              });
            });
          });
        });
      });
    });
  }

  /**
   * Inserts a new file record
   */
  insertFile(metadata: Omit<FileMetadata, 'createdAt' | 'updatedAt'>): void {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO file_metadata (
        id, file_path, file_name, file_size, file_hash, file_content, status, progress,
        current_step, error_message, retry_count, max_retries,
        created_at, updated_at, processing_started_at, processing_completed_at,
        chunks_count, nodes_count, relationships_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        metadata.id,
        metadata.filePath,
        metadata.fileName,
        metadata.fileSize,
        metadata.fileHash,
        metadata.fileContent || null,
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
      ],
      (err) => {
        if (err) {
          console.error('❌ Failed to insert file:', err);
        }
      }
    );
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
    const values: (string | number | null)[] = [];

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
    if (updates.fileSize !== undefined) {
      fields.push('file_size = ?');
      values.push(updates.fileSize);
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

    this.db.run(sql, values, (err) => {
      if (err) {
        console.error('❌ Failed to update file:', err);
      }
    });
  }

  /**
   * Gets file by ID
   */
  getFile(id: string): FileMetadata | null {
    if (!this.db) throw new Error('Database not initialized');

    let result: FileMetadata | null = null;

    this.db.get('SELECT * FROM file_metadata WHERE id = ?', [id], (err, row: any) => {
      if (err) {
        console.error('❌ Failed to get file:', err);
        return;
      }
      if (row) {
        result = this.rowToMetadata(row);
      }
    });

    return result;
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

    let results: FileMetadata[] = [];

    this.db.all('SELECT * FROM file_metadata ORDER BY created_at DESC', (err, rows: any[]) => {
      if (err) {
        console.error('❌ Failed to get all files:', err);
        return;
      }
      if (rows) {
        results = rows.map(row => this.rowToMetadata(row));
      }
    });

    return results;
  }

  /**
   * Gets file by path
   */
  getFileByPath(filePath: string): FileMetadata | null {
    if (!this.db) throw new Error('Database not initialized');

    let result: FileMetadata | null = null;

    this.db.get('SELECT * FROM file_metadata WHERE file_path = ?', [filePath], (err, row: any) => {
      if (err) {
        console.error('❌ Failed to get file by path:', err);
        return;
      }
      if (row) {
        result = this.rowToMetadata(row);
      }
    });

    return result;
  }

  /**
   * Gets all files with specific status
   */
  getFilesByStatus(status: FileProcessingStatus): FileMetadata[] {
    if (!this.db) throw new Error('Database not initialized');

    let results: FileMetadata[] = [];

    this.db.all(
      'SELECT * FROM file_metadata WHERE status = ? ORDER BY created_at ASC',
      [status],
      (err, rows: any[]) => {
        if (err) {
          console.error('❌ Failed to get files by status:', err);
          return;
        }
        if (rows) {
          results = rows.map(row => this.rowToMetadata(row));
        }
      }
    );

    return results;
  }

  /**
   * Gets all pending files (for queue processing)
   */
  getPendingFiles(limit?: number): FileMetadata[] {
    if (!this.db) throw new Error('Database not initialized');

    let results: FileMetadata[] = [];

    const sql = limit
      ? 'SELECT * FROM file_metadata WHERE status = "pending" ORDER BY created_at ASC LIMIT ?'
      : 'SELECT * FROM file_metadata WHERE status = "pending" ORDER BY created_at ASC';

    const callback = (err: any, rows: any[]) => {
      if (err) {
        console.error('❌ Failed to get pending files:', err);
        return;
      }
      if (rows) {
        results = rows.map(row => this.rowToMetadata(row));
      }
    };

    if (limit) {
      this.db.all(sql, [limit], callback);
    } else {
      this.db.all(sql, callback);
    }

    return results;
  }

  /**
   * Gets database statistics
   */
  getStats(): DatabaseStats {
    if (!this.db) throw new Error('Database not initialized');

    let stats: DatabaseStats = {
      total: 0,
      pending: 0,
      processing: 0,
      extractingEntities: 0,
      creatingRelationships: 0,
      entityDiscovery: 0,
      processed: 0,
      completed: 0,
      error: 0,
      failed: 0,
      paused: 0,
      cancelled: 0
    };

    this.db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'extracting_entities' THEN 1 ELSE 0 END) as extracting_entities,
        SUM(CASE WHEN status = 'creating_relationships' THEN 1 ELSE 0 END) as creating_relationships,
        SUM(CASE WHEN status = 'entity_discovery' THEN 1 ELSE 0 END) as entity_discovery,
        SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'error' OR status = 'failed' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM file_metadata`,
      (err, row: any) => {
        if (err) {
          console.error('❌ Failed to get stats:', err);
          return;
        }
        if (row) {
          stats = {
            total: row.total || 0,
            pending: row.pending || 0,
            processing: row.processing || 0,
            extractingEntities: row.extracting_entities || 0,
            creatingRelationships: row.creating_relationships || 0,
            entityDiscovery: row.entity_discovery || 0,
            processed: row.processed || 0,
            completed: row.completed || 0,
            error: row.error || 0,
            failed: row.error || 0, // Same as error for backward compatibility
            paused: row.paused || 0,
            cancelled: row.cancelled || 0
          };
        }
      }
    );

    return stats;
  }

  /**
   * Deletes a file record
   */
  deleteFile(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('DELETE FROM file_metadata WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Failed to delete file:', err);
      }
    });
  }

  /**
   * Deletes all files with specific status
   */
  deleteFilesByStatus(status: FileProcessingStatus): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('DELETE FROM file_metadata WHERE status = ?', [status], (err) => {
      if (err) {
        console.error('❌ Failed to delete files by status:', err);
      }
    });
  }

  /**
   * Clears all records
   */
  clearAll(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('DELETE FROM file_metadata', (err) => {
      if (err) {
        console.error('❌ Failed to clear all files:', err);
      }
    });
  }

  /**
   * Resets failed files for retry (sets status back to pending)
   */
  resetFailedFiles(): void {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE file_metadata 
       SET status = 'pending', 
           error_message = NULL, 
           updated_at = ?,
           processing_started_at = NULL,
           processing_completed_at = NULL
       WHERE status = 'failed' AND retry_count < max_retries`,
      [now],
      (err) => {
        if (err) {
          console.error('❌ Failed to reset failed files:', err);
        }
      }
    );
  }

  /**
   * Closes database connection
   */
  close(): void {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('❌ Failed to close database:', err);
        } else {
          console.log('✅ Database closed');
        }
      });
      this.db = null;
    }
  }

  /**
   * Converts a database row to FileMetadata object
   */
  private rowToMetadata(row: any): FileMetadata {
    return {
      id: String(row.id),
      filePath: String(row.file_path),
      fileName: String(row.file_name),
      fileSize: Number(row.file_size),
      fileHash: String(row.file_hash),
      fileContent: row.file_content ? String(row.file_content) : undefined,
      status: String(row.status) as FileProcessingStatus,
      progress: Number(row.progress),
      currentStep: row.current_step ? String(row.current_step) : undefined,
      errorMessage: row.error_message ? String(row.error_message) : undefined,
      retryCount: Number(row.retry_count),
      maxRetries: Number(row.max_retries),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      processingStartedAt: row.processing_started_at ? String(row.processing_started_at) : undefined,
      processingCompletedAt: row.processing_completed_at ? String(row.processing_completed_at) : undefined,
      chunksCount: row.chunks_count ? Number(row.chunks_count) : undefined,
      nodesCount: row.nodes_count ? Number(row.nodes_count) : undefined,
      relationshipsCount: row.relationships_count ? Number(row.relationships_count) : undefined
    };
  }
}
