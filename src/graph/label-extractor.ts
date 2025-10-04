import * as path from 'path';
import { graphLimits } from './config';

/**
 * Chunk interface (minimal for label extraction)
 */
export interface ChunkForLabel {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  symbolId?: string;
  keywords?: string[];
}

/**
 * Node interface (minimal for label extraction)
 */
export interface NodeForLabel {
  id: string;
  type: 'Document' | 'Section' | 'Keyword' | 'Symbol' | string;
  path?: string;
  label?: string;
}

/**
 * Extracts short, readable labels for graph nodes
 */
export class LabelExtractor {
  private maxLength: number;

  constructor(maxLength: number = graphLimits.maxLabelLength) {
    this.maxLength = maxLength;
  }

  /**
   * Extract a short label from a chunk
   */
  extractFromChunk(chunk: ChunkForLabel): string {
    // 1. If has symbolId, use the last part (most specific)
    if (chunk.symbolId) {
      const parts = chunk.symbolId.split('.');
      const symbolName = parts[parts.length - 1];
      return this.truncate(symbolName);
    }

    // 2. Extract filename without extension
    const fileName = path.basename(chunk.path);
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');

    // 3. Add line indicator
    const lineIndicator = `:${chunk.startLine}`;
    const availableLength = this.maxLength - lineIndicator.length;

    return this.truncate(nameWithoutExt, availableLength) + lineIndicator;
  }

  /**
   * Extract a short label from a node
   */
  extractFromNode(node: NodeForLabel): string {
    // If node already has a label, just truncate it
    if (node.label) {
      return this.truncate(node.label);
    }

    // Extract based on node type
    switch (node.type) {
      case 'Symbol':
        return this.extractSymbolLabel(node.id);
      
      case 'Document':
        return this.extractDocumentLabel(node.path);
      
      case 'Section':
        return this.extractSectionLabel(node.id);
      
      case 'Keyword':
        return this.extractKeywordLabel(node.id);
      
      default:
        return this.truncate(node.id);
    }
  }

  /**
   * Extract label from symbol ID (format: "sym:ClassName.methodName")
   */
  private extractSymbolLabel(symbolId: string): string {
    // Remove prefix
    const withoutPrefix = symbolId.replace(/^sym:/, '');
    
    // Get last part (most specific)
    const parts = withoutPrefix.split('.');
    const symbolName = parts[parts.length - 1];
    
    return this.truncate(symbolName);
  }

  /**
   * Extract label from document path
   */
  private extractDocumentLabel(docPath?: string): string {
    if (!docPath) {
      return 'document';
    }

    const fileName = path.basename(docPath);
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
    
    return this.truncate(nameWithoutExt);
  }

  /**
   * Extract label from section ID (format: "sec:hash")
   */
  private extractSectionLabel(sectionId: string): string {
    // Remove prefix
    const withoutPrefix = sectionId.replace(/^sec:/, '');
    
    // Try to extract meaningful name if possible
    // For now, just truncate the hash
    return this.truncate(withoutPrefix, 10) + '...';
  }

  /**
   * Extract label from keyword ID (format: "kw:keyword")
   */
  private extractKeywordLabel(keywordId: string): string {
    // Remove prefix
    const keyword = keywordId.replace(/^kw:/, '');
    return this.truncate(keyword);
  }

  /**
   * Truncate text to maximum length
   */
  private truncate(text: string, maxLen: number = this.maxLength): string {
    if (text.length <= maxLen) {
      return text;
    }
    
    return text.slice(0, maxLen - 3) + '...';
  }

  /**
   * Extract keywords from text (for node creation)
   */
  extractKeywords(text: string, maxKeywords: number = 5): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length < 20)
      .filter((word, index, self) => self.indexOf(word) === index) // Unique
      .slice(0, maxKeywords);
  }

  /**
   * Extract symbol name from code text
   */
  extractSymbolName(text: string): string | undefined {
    // Try to match common patterns
    const patterns = [
      /(?:function|class|interface|type|const|let|var)\s+(\w+)/,
      /(\w+)\s*[:=]\s*(?:function|class|\(|async)/,
      /export\s+(?:default\s+)?(?:function|class|interface|type|const)\s+(\w+)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Create a cluster label from multiple nodes
   */
  createClusterLabel(nodes: NodeForLabel[]): string {
    if (nodes.length === 0) {
      return 'empty cluster';
    }

    // Group by type
    const typeGroups = new Map<string, number>();
    for (const node of nodes) {
      typeGroups.set(node.type, (typeGroups.get(node.type) || 0) + 1);
    }

    // Find most common type
    let maxCount = 0;
    let mostCommonType = 'items';
    for (const [type, count] of typeGroups) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type.toLowerCase() + 's';
      }
    }

    // Try to extract common prefix from paths
    const paths = nodes.map(n => n.path).filter(p => p !== undefined) as string[];
    if (paths.length > 0) {
      const commonPath = this.findCommonPath(paths);
      if (commonPath) {
        const dirName = path.basename(commonPath);
        return this.truncate(`${dirName} (${nodes.length} ${mostCommonType})`);
      }
    }

    return this.truncate(`${nodes.length} ${mostCommonType}`);
  }

  /**
   * Find common path prefix
   */
  private findCommonPath(paths: string[]): string | undefined {
    if (paths.length === 0) {
      return undefined;
    }

    if (paths.length === 1) {
      return path.dirname(paths[0]);
    }

    // Split all paths into segments
    const segments = paths.map(p => p.split(path.sep));
    
    // Find common prefix
    const commonSegments: string[] = [];
    const minLength = Math.min(...segments.map(s => s.length));

    for (let i = 0; i < minLength; i++) {
      const segment = segments[0][i];
      if (segments.every(s => s[i] === segment)) {
        commonSegments.push(segment);
      } else {
        break;
      }
    }

    if (commonSegments.length === 0) {
      return undefined;
    }

    return commonSegments.join(path.sep);
  }
}

/**
 * Default label extractor instance
 */
export const defaultLabelExtractor = new LabelExtractor();
