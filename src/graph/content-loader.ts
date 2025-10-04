import * as fs from 'fs/promises';
import * as path from 'path';
import { graphLimits } from './config';

/**
 * Chunk reference for content loading
 */
export interface ChunkReference {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  textHash?: string;
}

/**
 * Node details with loaded content
 */
export interface NodeDetails {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  preview: string;
  language?: string;
  keywords?: string[];
}

/**
 * Cache entry
 */
interface CacheEntry {
  content: string;
  timestamp: number;
  accessCount: number;
}

/**
 * Content Loader
 * Manages lazy loading and caching of file content
 */
export class ContentLoader {
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize: number;
  private workspacePath: string = '';

  constructor(maxCacheSize: number = graphLimits.cacheSize) {
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Set the workspace path for resolving relative paths
   */
  setWorkspacePath(workspacePath: string): void {
    this.workspacePath = workspacePath;
  }

  /**
   * Load snippet from a chunk reference
   */
  async loadSnippet(chunk: ChunkReference): Promise<string> {
    const cacheKey = this.getCacheKey(chunk);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      cached.accessCount++;
      cached.timestamp = Date.now();
      return cached.content;
    }

    try {
      // Read file
      const fullPath = this.resolveFilePath(chunk.path);
      const fileContent = await fs.readFile(fullPath, 'utf8');
      
      // Extract lines
      const snippet = this.extractLines(fileContent, chunk.startLine, chunk.endLine);
      
      // Cache the result
      this.cacheSnippet(cacheKey, snippet);
      
      return snippet;

    } catch (error) {
      console.error(`Failed to load snippet from ${chunk.path}:`, error);
      return `[Error loading content from ${chunk.path}]`;
    }
  }

  /**
   * Load complete node details
   */
  async loadNodeDetails(chunk: ChunkReference): Promise<NodeDetails> {
    const snippet = await this.loadSnippet(chunk);
    
    return {
      id: chunk.id,
      path: chunk.path,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      snippet: snippet,
      preview: this.createPreview(snippet, 200),
      language: this.detectLanguage(chunk.path)
    };
  }

  /**
   * Preload multiple chunks (batch loading)
   */
  async preloadChunks(chunks: ChunkReference[]): Promise<void> {
    // Group chunks by file for efficient loading
    const chunksByFile = new Map<string, ChunkReference[]>();
    
    for (const chunk of chunks) {
      if (!chunksByFile.has(chunk.path)) {
        chunksByFile.set(chunk.path, []);
      }
      chunksByFile.get(chunk.path)!.push(chunk);
    }

    // Load files and cache snippets
    const loadPromises = Array.from(chunksByFile.entries()).map(
      async ([filePath, fileChunks]) => {
        try {
          const fullPath = this.resolveFilePath(filePath);
          const fileContent = await fs.readFile(fullPath, 'utf8');
          
          // Extract and cache all chunks from this file
          for (const chunk of fileChunks) {
            const snippet = this.extractLines(fileContent, chunk.startLine, chunk.endLine);
            const cacheKey = this.getCacheKey(chunk);
            this.cacheSnippet(cacheKey, snippet);
          }
        } catch (error) {
          console.warn(`Failed to preload ${filePath}:`, error);
        }
      }
    );

    await Promise.all(loadPromises);
    console.log(`Preloaded ${chunks.length} chunks from ${chunksByFile.size} files`);
  }

  /**
   * Extract lines from file content
   */
  private extractLines(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    
    // Convert to 0-based index
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    
    return lines.slice(start, end).join('\n');
  }

  /**
   * Create a preview (truncated snippet)
   */
  private createPreview(snippet: string, maxLength: number): string {
    if (snippet.length <= maxLength) {
      return snippet;
    }
    
    return snippet.slice(0, maxLength - 3) + '...';
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const languageMap = new Map<string, string>([
      ['.ts', 'typescript'],
      ['.tsx', 'tsx'],
      ['.js', 'javascript'],
      ['.jsx', 'jsx'],
      ['.py', 'python'],
      ['.java', 'java'],
      ['.cpp', 'cpp'],
      ['.c', 'c'],
      ['.cs', 'csharp'],
      ['.go', 'go'],
      ['.rs', 'rust'],
      ['.rb', 'ruby'],
      ['.php', 'php'],
      ['.md', 'markdown'],
      ['.json', 'json'],
      ['.yaml', 'yaml'],
      ['.yml', 'yaml'],
      ['.xml', 'xml'],
      ['.html', 'html'],
      ['.css', 'css'],
      ['.scss', 'scss'],
      ['.sql', 'sql']
    ]);
    
    return languageMap.get(ext) || 'text';
  }

  /**
   * Resolve file path (handle relative paths)
   */
  private resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    
    return path.join(this.workspacePath, filePath);
  }

  /**
   * Generate cache key for a chunk
   */
  private getCacheKey(chunk: ChunkReference): string {
    return `${chunk.path}:${chunk.startLine}-${chunk.endLine}`;
  }

  /**
   * Cache a snippet
   */
  private cacheSnippet(key: string, content: string): void {
    // If cache is full, remove least recently used entry
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      content,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  /**
   * Evict least recently used cache entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalAccesses: number;
  } {
    let totalAccesses = 0;
    
    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
    }

    // Hit rate calculation would require tracking misses
    // For now, approximate based on access counts
    const avgAccessCount = totalAccesses / (this.cache.size || 1);
    const hitRate = avgAccessCount > 1 ? (avgAccessCount - 1) / avgAccessCount : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: Math.min(1, hitRate),
      totalAccesses
    };
  }

  /**
   * Check if chunk is cached
   */
  isCached(chunk: ChunkReference): boolean {
    const cacheKey = this.getCacheKey(chunk);
    return this.cache.has(cacheKey);
  }

  /**
   * Get cache keys for a specific file
   */
  getCachedKeysForFile(filePath: string): string[] {
    const keys: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(filePath + ':')) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidateFile(filePath: string): number {
    const keysToRemove = this.getCachedKeysForFile(filePath);
    
    for (const key of keysToRemove) {
      this.cache.delete(key);
    }
    
    return keysToRemove.length;
  }
}

/**
 * Default content loader instance
 */
export const defaultContentLoader = new ContentLoader();
