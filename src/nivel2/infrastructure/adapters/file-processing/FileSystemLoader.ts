/**
 * @fileoverview Filesystem adapter for file loading
 * @module nivel2/infrastructure/adapters/file-processing
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FileLoaderPort } from '../../../../domains/file-processing/ports/FileLoaderPort';
import type { FileContent } from '../../../../domains/file-processing/entities/FileContent';
import { FileHashService } from '../../services/file-hash-service';

/**
 * Adapter for loading files from filesystem or embedded content
 */
export class FileSystemLoader implements FileLoaderPort {
  private readonly hashService: FileHashService;
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.hashService = new FileHashService();
  }

  async loadFile(filePath: string, base64Content?: string): Promise<FileContent> {
    if (base64Content) {
      return this.loadEmbeddedFile(filePath, base64Content);
    } else {
      return this.loadPhysicalFile(filePath);
    }
  }

  private async loadEmbeddedFile(filePath: string, base64Content: string): Promise<FileContent> {
    console.log(`📄 Loading embedded file: ${filePath}`);
    
    const content = Buffer.from(base64Content, 'base64').toString('utf-8');
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(Buffer.from(base64Content, 'base64')).digest('hex');
    
    return {
      filePath,
      absolutePath: filePath, // For embedded files, path is just a label
      content,
      hash,
      size: content.length,
      language: this.detectLanguage(filePath),
      isEmbedded: true
    };
  }

  private async loadPhysicalFile(filePath: string): Promise<FileContent> {
    // Resolve to absolute path if needed
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.workspaceRoot, filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${filePath} (resolved to: ${absolutePath})`);
    }

    const stats = fs.statSync(absolutePath);
    if (stats.size === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const hash = await this.hashService.hashFile(absolutePath);

    return {
      filePath,
      absolutePath,
      content,
      hash,
      size: stats.size,
      language: this.detectLanguage(filePath),
      isEmbedded: false
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.cs': 'csharp',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sql': 'sql'
    };
    return languageMap[ext] || 'plaintext';
  }
}
