/**
 * @fileoverview File discovery module for workspace scanner
 * @module workspace-scanner/discovery
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FileHashService } from '../../file-hash-service';
import { IgnorePatternMatcher } from '../../ignore-pattern-matcher';
import type { FileIndexEntry } from '../../../../../shared/types/chunk';
import type { ProgressCallback } from '../types';

/**
 * File discovery configuration
 */
export interface FileDiscoveryConfig {
  workspaceRoot: string;
  repoId: string;
}

/**
 * Handles file discovery in workspace
 */
export class FileDiscovery {
  private readonly config: FileDiscoveryConfig;
  private readonly hashService: FileHashService;
  private readonly ignorePatterns: IgnorePatternMatcher;

  constructor(config: FileDiscoveryConfig) {
    this.config = config;
    this.hashService = new FileHashService();
    this.ignorePatterns = new IgnorePatternMatcher(config.workspaceRoot);
  }

  /**
   * Initialize ignore patterns
   */
  async initialize(): Promise<void> {
    await this.ignorePatterns.load();
  }

  /**
   * Discovers all files in workspace
   */
  async discoverFiles(progressCallback?: ProgressCallback): Promise<FileIndexEntry[]> {
    console.log('🔍 [FileDiscovery] discoverFiles() called');
    console.log('🔍 [FileDiscovery] workspaceRoot:', this.config.workspaceRoot);
    console.log('🔍 [FileDiscovery] progressCallback:', !!progressCallback);
    
    const files: FileIndexEntry[] = [];
    
    console.log('🔍 Searching for files in workspace...');
    
    try {
      console.log('🔍 [FileDiscovery] Calling vscode.workspace.findFiles...');
      // Use VS Code file search
      const uris = await vscode.workspace.findFiles(
        '**/*',
        '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.cappy/**}'
      );
      console.log(`📁 [FileDiscovery] vscode.workspace.findFiles returned ${uris.length} URIs`);

    console.log(`📁 Found ${uris.length} potential files, filtering...`);
    let processedCount = 0;

    for (const uri of uris) {
      processedCount++;
      
      // Report progress during discovery every 10 files
      if (progressCallback && processedCount % 10 === 0) {
        progressCallback({
          totalFiles: uris.length,
          processedFiles: 0,
          currentFile: `Discovering: ${processedCount}/${uris.length} files`,
          status: 'scanning',
          errors: []
        });
      }

      const relPath = path.relative(this.config.workspaceRoot, uri.fsPath);

      // Ignore any folder or file starting with dot
      const parts = relPath.split(path.sep);
      if (parts.some(p => p.startsWith('.'))) {
        continue;
      }

      // Apply ignore patterns
      if (this.ignorePatterns.shouldIgnore(relPath)) {
        continue;
      }

      try {
        const stat = await vscode.workspace.fs.stat(uri);

        // Skip directories
        if (stat.type === vscode.FileType.Directory) {
          continue;
        }

        const fileId = this.generateFileId(relPath);
        const hash = await this.hashService.hashFile(uri.fsPath);
        const language = this.detectLanguage(relPath);

        files.push({
          repoId: this.config.repoId,
          fileId,
          relPath,
          isAvailable: true,
          isDeleted: false,
          sizeBytes: stat.size,
          mtimeEpochMs: stat.mtime,
          hashAlgo: 'blake3',
          contentHash: hash,
          hashStatus: 'OK',
          hashVerifiedAtEpochMs: Date.now(),
          language,
          lastIndexedAtEpochMs: 0,
          pendingGraph: true
        });
      } catch (error) {
        console.warn(`⚠️ Could not stat file ${relPath}:`, error);
      }
    }

    console.log(`✅ [FileDiscovery] Discovered ${files.length} valid files`);
    return files;
    
    } catch (error) {
      console.error('❌ [FileDiscovery] Error discovering files:', error);
      throw error;
    }
  }

  /**
   * Filters files that need processing (new or modified)
   */
  filterFilesToProcess(
    files: FileIndexEntry[],
    fileIndex: Map<string, FileIndexEntry>
  ): FileIndexEntry[] {
    const filesToProcess: FileIndexEntry[] = [];

    for (const file of files) {
      const existing = fileIndex.get(file.relPath);
      const isNew = !existing;
      const isModified = !!existing && existing.contentHash !== file.contentHash;

      if (isNew || isModified) {
        if (isModified) {
          console.log(`📝 File modified: ${file.relPath}`);
        }
        filesToProcess.push(file);
      }
    }

    return filesToProcess;
  }

  /**
   * Generates a unique file ID
   */
  private generateFileId(relPath: string): string {
    return `file:${this.hashService.hashStringSync(relPath)}`;
  }

  /**
   * Detects file language
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath);
    
    // Check for Blade templates
    if (filePath.endsWith('.blade.php')) {
      return 'blade';
    }
    
    // Check for Vite config
    const viteConfigRegex = /^vite\.config\.(js|ts|mjs|cjs)$/;
    if (viteConfigRegex.exec(fileName)) {
      return 'vite';
    }
    
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.php': 'php',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby'
    };

    return languageMap[ext] || 'unknown';
  }
}
