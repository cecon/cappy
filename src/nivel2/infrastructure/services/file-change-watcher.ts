/**
 * @fileoverview File change watcher for automatic reprocessing
 * @module services/file-change-watcher
 * @author Cappy Team
 * @since 3.1.0
 * 
 * Monitors file system changes and automatically marks changed files
 * for reprocessing by updating their status in the metadata database.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileMetadataDatabase } from './file-metadata-database';
import { FileHashService } from './file-hash-service';
import { IgnorePatternMatcher } from './ignore-pattern-matcher';

/**
 * File change watcher configuration
 */
export interface FileChangeWatcherConfig {
  workspaceRoot: string;
  autoAddNewFiles?: boolean;      // Automatically add new files to queue
  reprocessModified?: boolean;     // Reprocess files when modified
  removeDeleted?: boolean;         // Remove deleted files from queue
}

/**
 * File change watcher for automatic reprocessing
 */
export class FileChangeWatcher {
  private database: FileMetadataDatabase;
  private hashService: FileHashService;
  private ignorePatterns: IgnorePatternMatcher;
  private config: FileChangeWatcherConfig;
  private watcher: vscode.FileSystemWatcher | null = null;
  private isActive: boolean = false;

  constructor(
    database: FileMetadataDatabase,
    hashService: FileHashService,
    config: FileChangeWatcherConfig
  ) {
    this.database = database;
    this.hashService = hashService;
    this.ignorePatterns = new IgnorePatternMatcher(config.workspaceRoot);
    this.config = {
      autoAddNewFiles: config.autoAddNewFiles ?? true,
      reprocessModified: config.reprocessModified ?? true,
      removeDeleted: config.removeDeleted ?? true,
      ...config
    };
  }

  /**
   * Starts watching for file changes
   */
  async start(): Promise<void> {
    if (this.isActive) return;

    console.log('👁️  Starting FileChangeWatcher...');
    
    // Load ignore patterns
    await this.ignorePatterns.load();

    // Create file system watcher
    const pattern = new vscode.RelativePattern(
      this.config.workspaceRoot,
      '**/*'
    );

    this.watcher = vscode.workspace.createFileSystemWatcher(
      pattern,
      false, // don't ignore create
      false, // don't ignore change
      false  // don't ignore delete
    );

    // Register event handlers
    this.watcher.onDidCreate(uri => this.handleFileCreate(uri));
    this.watcher.onDidChange(uri => this.handleFileChange(uri));
    this.watcher.onDidDelete(uri => this.handleFileDelete(uri));

    this.isActive = true;
    console.log('✅ FileChangeWatcher started');
  }

  /**
   * Stops watching for file changes
   */
  stop(): void {
    if (!this.isActive) return;

    console.log('🛑 Stopping FileChangeWatcher...');
    
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }

    this.isActive = false;
    console.log('✅ FileChangeWatcher stopped');
  }

  /**
   * Disposes of the watcher
   */
  dispose(): void {
    this.stop();
  }

  /**
   * Handles file creation
   */
  private async handleFileCreate(uri: vscode.Uri): Promise<void> {
    if (!this.config.autoAddNewFiles) return;

    const filePath = uri.fsPath;
    
    try {
      // Check if file should be ignored
      const relPath = path.relative(this.config.workspaceRoot, filePath);
      if (this.shouldIgnore(relPath)) {
        return;
      }

      // Check if file already exists in database
      const existing = await this.database.getFileByPath(filePath);
      if (existing) {
        // File was recreated, mark for reprocessing
        const hash = await this.hashService.hashFile(filePath);
        await this.database.updateFile(existing.id, {
          status: 'pending',
          fileHash: hash,
          retryCount: 0,
          errorMessage: undefined,
          currentStep: 'File recreated, reprocessing',
          updatedAt: new Date().toISOString()
        });
        console.log(`🔄 File recreated, marked for reprocessing: ${relPath}`);
        return;
      }

      // Add new file to queue
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        console.log(`⚠️  Skipping empty file: ${relPath}`);
        return;
      }

      const hash = await this.hashService.hashFile(filePath);
      const fileName = path.basename(filePath);

      this.database.insertFile({
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        filePath,
        fileName,
        fileSize: stats.size,
        fileHash: hash,
        status: 'pending',
        progress: 0,
        retryCount: 0,
        maxRetries: 3
      });

      console.log(`➕ New file added to queue: ${relPath}`);
    } catch (error) {
      console.error(`❌ Error handling file create for ${filePath}:`, error);
    }
  }

  /**
   * Handles file changes
   */
  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    if (!this.config.reprocessModified) return;

    const filePath = uri.fsPath;

    try {
      // Check if file should be ignored
      const relPath = path.relative(this.config.workspaceRoot, filePath);
      if (this.shouldIgnore(relPath)) {
        return;
      }

      // Get existing metadata
      const existing = await this.database.getFileByPath(filePath);
      if (!existing) {
        // File not in database, add it
        await this.handleFileCreate(uri);
        return;
      }

      // Check if file actually changed (hash comparison)
      const newHash = await this.hashService.hashFile(filePath);
      
      if (newHash !== existing.fileHash) {
        // File changed, mark for reprocessing
        await this.database.updateFile(existing.id, {
          status: 'pending',
          fileHash: newHash,
          retryCount: 0,
          errorMessage: undefined,
          currentStep: 'File changed, reprocessing',
          updatedAt: new Date().toISOString()
        });

        console.log(`🔄 File changed, marked for reprocessing: ${relPath}`);
      } else {
        // Hash is the same, no need to reprocess
        console.log(`⏭️  File change detected but hash unchanged: ${relPath}`);
      }
    } catch (error) {
      console.error(`❌ Error handling file change for ${filePath}:`, error);
    }
  }

  /**
   * Handles file deletion
   */
  private async handleFileDelete(uri: vscode.Uri): Promise<void> {
    if (!this.config.removeDeleted) return;

    const filePath = uri.fsPath;

    try {
      const relPath = path.relative(this.config.workspaceRoot, filePath);
      
      // Get existing metadata
      const existing = await this.database.getFileByPath(filePath);
      if (existing) {
        // Remove from database
        await this.database.deleteFile(existing.id);
        console.log(`➖ Deleted file removed from queue: ${relPath}`);
      }
    } catch (error) {
      console.error(`❌ Error handling file delete for ${filePath}:`, error);
    }
  }

  /**
   * Checks if a file should be ignored
   */
  private shouldIgnore(relPath: string): boolean {
    // Normalize path separators
    const normalizedPath = relPath.replace(/\\/g, '/');
    
    // Always ignore .cappy directory
    if (normalizedPath.includes('.cappy/')) {
      return true;
    }

    // Check ignore patterns
    if (this.ignorePatterns.shouldIgnore(normalizedPath)) {
      return true;
    }

    return false;
  }

  /**
   * Gets watcher state
   */
  getState(): { isActive: boolean } {
    return { isActive: this.isActive };
  }
}
