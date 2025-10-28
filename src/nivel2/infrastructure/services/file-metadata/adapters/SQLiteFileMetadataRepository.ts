/**
 * @fileoverview Adapter: SQLite implementation of File Metadata Repository
 * @module file-metadata/adapters
 */

import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import type { IFileMetadataRepository } from '../ports/IFileMetadataRepository';
import type { FileMetadata, FileProcessingStatus, DatabaseStats } from '../domain/FileMetadata';
import type { PaginationOptions, PaginatedResult, SQLiteFileRow, SQLiteCountRow, SQLiteAggregatedStatsRow } from '../types';

/**
 * SQLite adapter for file metadata repository
 */
export class SQLiteFileMetadataRepository implements IFileMetadataRepository {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to open database: ${err.message}`));
          return;
        }

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

          this.createIndexes()
            .then(() => {
              console.log('📋 File metadata table and indexes created');
              resolve();
            })
            .catch(reject);
        });
      });
    });
  }

  private async createIndexes(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_status ON file_metadata(status)',
        'CREATE INDEX IF NOT EXISTS idx_file_path ON file_metadata(file_path)',
        'CREATE INDEX IF NOT EXISTS idx_created_at ON file_metadata(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_updated_at ON file_metadata(updated_at)'
      ];

      let completed = 0;
      for (const indexSql of indexes) {
        this.db.run(indexSql, (err) => {
          if (err) {
            reject(new Error(`Failed to create index: ${err.message}`));
            return;
          }
          completed++;
          if (completed === indexes.length) {
            resolve();
          }
        });
      }
    });
  }

  async insertFile(metadata: Omit<FileMetadata, 'createdAt' | 'updatedAt'>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

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
            reject(new Error(`Failed to insert file: ${err.message}`));
          } else {
            resolve();
          }
        }
      );
    });
  }

  async updateFile(
    id: string,
    updates: Partial<Omit<FileMetadata, 'id' | 'createdAt'>>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: (string | number | null)[] = [];

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
          reject(new Error(`Failed to update file: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async getFile(id: string): Promise<FileMetadata | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get('SELECT * FROM file_metadata WHERE id = ?', [id], (err, row: SQLiteFileRow | undefined) => {
        if (err) {
          reject(new Error(`Failed to get file: ${err.message}`));
        } else if (row) {
          resolve(this.rowToMetadata(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  async getFileByPath(filePath: string): Promise<FileMetadata | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get('SELECT * FROM file_metadata WHERE file_path = ?', [filePath], (err, row: SQLiteFileRow | undefined) => {
        if (err) {
          reject(new Error(`Failed to get file by path: ${err.message}`));
        } else if (row) {
          resolve(this.rowToMetadata(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  async getAllFiles(): Promise<FileMetadata[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all('SELECT * FROM file_metadata ORDER BY created_at DESC', (err, rows: SQLiteFileRow[]) => {
        if (err) {
          reject(new Error(`Failed to get all files: ${err.message}`));
        } else {
          resolve(rows.map(row => this.rowToMetadata(row)));
        }
      });
    });
  }

  async getFilesPaginated(options: PaginationOptions): Promise<PaginatedResult> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const { page, limit, status, sortBy = 'updated_at', sortOrder = 'desc' } = options;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereClause = status ? 'WHERE status = ?' : '';
      const whereParams = status ? [status] : [];

      // Build ORDER BY clause
      const orderByClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM file_metadata ${whereClause}`;
      
      this.db.get(countSql, whereParams, (err, countRow: SQLiteCountRow) => {
        if (err) {
          reject(new Error(`Failed to count files: ${err.message}`));
          return;
        }

        const total = countRow.total;
        const totalPages = Math.ceil(total / limit);

        // Get paginated data
        const dataSql = `SELECT * FROM file_metadata ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`;
        const dataParams = [...whereParams, limit, offset];

        this.db!.all(dataSql, dataParams, (err, rows: SQLiteFileRow[]) => {
          if (err) {
            reject(new Error(`Failed to get paginated files: ${err.message}`));
          } else {
            resolve({
              files: rows.map(row => this.rowToMetadata(row)),
              total,
              page,
              limit,
              totalPages
            });
          }
        });
      });
    });
  }

  async getFilesByStatus(status: FileProcessingStatus): Promise<FileMetadata[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(
        'SELECT * FROM file_metadata WHERE status = ? ORDER BY created_at ASC',
        [status],
        (err, rows: SQLiteFileRow[]) => {
          if (err) {
            reject(new Error(`Failed to get files by status: ${err.message}`));
          } else {
            resolve(rows.map(row => this.rowToMetadata(row)));
          }
        }
      );
    });
  }

  async getPendingFiles(limit?: number): Promise<FileMetadata[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = limit
        ? 'SELECT * FROM file_metadata WHERE status = "pending" ORDER BY created_at ASC LIMIT ?'
        : 'SELECT * FROM file_metadata WHERE status = "pending" ORDER BY created_at ASC';

      const callback = (err: Error | null, rows: SQLiteFileRow[]) => {
        if (err) {
          reject(new Error(`Failed to get pending files: ${err.message}`));
        } else {
          resolve(rows.map(row => this.rowToMetadata(row)));
        }
      };

      if (limit) {
        this.db.all(sql, [limit], callback);
      } else {
        this.db.all(sql, callback);
      }
    });
  }

  async getStats(): Promise<DatabaseStats> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

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
        (err, row: SQLiteAggregatedStatsRow) => {
          if (err) {
            reject(new Error(`Failed to get stats: ${err.message}`));
          } else {
            resolve({
              total: row.total || 0,
              pending: row.pending || 0,
              processing: row.processing || 0,
              extractingEntities: row.extracting_entities || 0,
              creatingRelationships: row.creating_relationships || 0,
              entityDiscovery: row.entity_discovery || 0,
              processed: row.processed || 0,
              completed: row.completed || 0,
              error: row.error || 0,
              failed: row.error || 0,
              paused: row.paused || 0,
              cancelled: row.cancelled || 0
            });
          }
        }
      );
    });
  }

  async deleteFile(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run('DELETE FROM file_metadata WHERE id = ?', [id], (err) => {
        if (err) {
          reject(new Error(`Failed to delete file: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async deleteFilesByStatus(status: FileProcessingStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run('DELETE FROM file_metadata WHERE status = ?', [status], (err) => {
        if (err) {
          reject(new Error(`Failed to delete files by status: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async clearAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run('DELETE FROM file_metadata', (err) => {
        if (err) {
          reject(new Error(`Failed to clear all files: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async resetFailedFiles(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

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
            reject(new Error(`Failed to reset failed files: ${err.message}`));
          } else {
            resolve();
          }
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(new Error(`Failed to close database: ${err.message}`));
          } else {
            console.log('✅ Database closed');
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  private rowToMetadata(row: SQLiteFileRow): FileMetadata {
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
