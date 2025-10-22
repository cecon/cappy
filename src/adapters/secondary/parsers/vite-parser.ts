/**
 * @fileoverview Vite configuration parser for extracting settings and documentation
 * @module adapters/secondary/parsers/vite-parser
 * @author Cappy Team
 * @since 3.0.0
 */

import type { DocumentChunk } from '../../../types/chunk';
import * as fs from 'fs';

/**
 * Parsed configuration from Vite config
 */
interface ParsedConfig {
  name: string;
  kind: 'plugin' | 'alias' | 'server' | 'build' | 'define' | 'comment' | 'jsdoc';
  content: string;
  lineStart: number;
  lineEnd: number;
  value?: string;
}

/**
 * Vite configuration parser using regex patterns
 * Extracts configuration options, plugins, and JSDoc comments
 */
export class ViteParser {
  /**
   * Parses a Vite config file and extracts documentation chunks
   */
  async parseFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Vite parser: File not found: ${filePath}`);
        return [];
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const chunks: DocumentChunk[] = [];
      const lines = content.split('\n');

      // Extract configuration elements
      const configs = this.extractConfigs(lines, content);

      // Create chunks for each configuration element
      for (const config of configs) {
        if (config.content) {
          const chunkId = this.generateChunkId(filePath, config.lineStart, config.lineEnd);
          
          chunks.push({
            id: chunkId,
            content: config.content,
            metadata: {
              filePath,
              lineStart: config.lineStart,
              lineEnd: config.lineEnd,
              chunkType: 'vite_config',
              symbolName: config.name,
              symbolKind: config.kind === 'jsdoc' ? 'variable' : undefined,
              configKind: config.kind,
              ...(config.value && { configValue: config.value })
            }
          });
        }
      }

      return chunks;
    } catch (error) {
      console.error(`❌ Vite parser error for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extracts configuration elements from Vite config
   */
  private extractConfigs(lines: string[], fullContent: string): ParsedConfig[] {
    const configs: ParsedConfig[] = [];
    let currentJsDoc: { content: string; lineStart: number } | null = null;
    let inJsDocBlock = false;

    // Extract JSDoc and multi-line comments from full content
    this.extractComments(fullContent, configs);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track JSDoc blocks
      if (trimmed.startsWith('/**')) {
        inJsDocBlock = true;
        currentJsDoc = { content: trimmed + '\n', lineStart: i + 1 };
        continue;
      }

      if (inJsDocBlock) {
        currentJsDoc!.content += trimmed + '\n';
        if (trimmed.includes('*/')) {
          inJsDocBlock = false;
          configs.push({
            name: 'jsdoc',
            kind: 'jsdoc',
            content: currentJsDoc!.content,
            lineStart: currentJsDoc!.lineStart,
            lineEnd: i + 1
          });
        }
        continue;
      }

      // Extract plugins array
      const pluginMatch = line.match(/plugins\s*:\s*\[\s*$/);
      if (pluginMatch) {
        const pluginContent = this.extractPluginsList(lines, i);
        if (pluginContent.content) {
          configs.push({
            name: 'plugins',
            kind: 'plugin',
            content: currentJsDoc?.content || `Vite plugins configuration:\n${pluginContent.content}`,
            lineStart: currentJsDoc?.lineStart || i + 1,
            lineEnd: pluginContent.endLine,
            value: pluginContent.content
          });
          currentJsDoc = null;
          i = pluginContent.endLine - 1;
          continue;
        }
      }

      // Extract simple plugin reference
      const simplePluginMatch = line.match(/(\w+)\s*\(\s*[{[]?/);
      if (simplePluginMatch && line.includes('(')) {
        const pluginName = simplePluginMatch[1];
        if (['react', 'vue', 'svelte', 'solid', 'legacy', 'basicSsl', 'viteTsconfigPaths'].includes(pluginName)) {
          configs.push({
            name: pluginName,
            kind: 'plugin',
            content: currentJsDoc?.content || `Vite plugin: ${pluginName}`,
            lineStart: currentJsDoc?.lineStart || i + 1,
            lineEnd: i + 1,
            value: pluginName
          });
          currentJsDoc = null;
          continue;
        }
      }

      // Extract resolve.alias
      const aliasMatch = line.match(/alias\s*:\s*\{/);
      if (aliasMatch) {
        const aliasContent = this.extractObjectConfig(lines, i);
        if (aliasContent.content) {
          configs.push({
            name: 'resolve.alias',
            kind: 'alias',
            content: currentJsDoc?.content || `Path aliases:\n${aliasContent.content}`,
            lineStart: currentJsDoc?.lineStart || i + 1,
            lineEnd: aliasContent.endLine,
            value: aliasContent.content
          });
          currentJsDoc = null;
          i = aliasContent.endLine - 1;
          continue;
        }
      }

      // Extract server config
      const serverMatch = line.match(/server\s*:\s*\{/);
      if (serverMatch) {
        const serverContent = this.extractObjectConfig(lines, i);
        if (serverContent.content) {
          configs.push({
            name: 'server',
            kind: 'server',
            content: currentJsDoc?.content || `Server configuration:\n${serverContent.content}`,
            lineStart: currentJsDoc?.lineStart || i + 1,
            lineEnd: serverContent.endLine,
            value: serverContent.content
          });
          currentJsDoc = null;
          i = serverContent.endLine - 1;
          continue;
        }
      }

      // Extract build config
      const buildMatch = line.match(/build\s*:\s*\{/);
      if (buildMatch) {
        const buildContent = this.extractObjectConfig(lines, i);
        if (buildContent.content) {
          configs.push({
            name: 'build',
            kind: 'build',
            content: currentJsDoc?.content || `Build configuration:\n${buildContent.content}`,
            lineStart: currentJsDoc?.lineStart || i + 1,
            lineEnd: buildContent.endLine,
            value: buildContent.content
          });
          currentJsDoc = null;
          i = buildContent.endLine - 1;
          continue;
        }
      }

      // Extract define (environment variables)
      const defineMatch = line.match(/define\s*:\s*\{/);
      if (defineMatch) {
        const defineContent = this.extractObjectConfig(lines, i);
        if (defineContent.content) {
          configs.push({
            name: 'define',
            kind: 'define',
            content: currentJsDoc?.content || `Environment definitions:\n${defineContent.content}`,
            lineStart: currentJsDoc?.lineStart || i + 1,
            lineEnd: defineContent.endLine,
            value: defineContent.content
          });
          currentJsDoc = null;
          i = defineContent.endLine - 1;
          continue;
        }
      }
    }

    return configs;
  }

  /**
   * Extracts plugins list
   */
  private extractPluginsList(lines: string[], startLine: number): { content: string; endLine: number } {
    let content = '';
    let depth = 1;
    let endLine = startLine;

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      content += line + '\n';

      if (line.includes('[')) depth++;
      if (line.includes(']')) depth--;

      if (depth === 0) {
        endLine = i + 1;
        break;
      }
    }

    return { content: content.trim(), endLine };
  }

  /**
   * Extracts object configuration
   */
  private extractObjectConfig(lines: string[], startLine: number): { content: string; endLine: number } {
    let content = '';
    let depth = 1;
    let endLine = startLine;

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      content += line + '\n';

      if (line.includes('{')) depth++;
      if (line.includes('}')) depth--;

      if (depth === 0) {
        endLine = i + 1;
        break;
      }
    }

    return { content: content.trim(), endLine };
  }

  /**
   * Extracts single-line and multi-line comments
   */
  private extractComments(content: string, configs: ParsedConfig[]): void {
    // Multi-line comments
    const multiCommentRegex = /\/\*([\s\S]*?)\*\//g;
    let match;

    while ((match = multiCommentRegex.exec(content)) !== null) {
      const commentContent = match[1].trim();
      
      // Skip JSDoc (handled separately)
      if (match[0].startsWith('/**')) {
        continue;
      }

      // Find line numbers
      const beforeComment = content.substring(0, match.index);
      const lineStart = (beforeComment.match(/\n/g) || []).length + 1;
      const commentLines = (match[0].match(/\n/g) || []).length;
      const lineEnd = lineStart + commentLines;

      if (commentContent) {
        configs.push({
          name: 'comment',
          kind: 'comment',
          content: commentContent,
          lineStart,
          lineEnd
        });
      }
    }

    // Single-line comments
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentMatch = line.match(/\/\/\s*(.+)$/);
      
      if (commentMatch && commentMatch[1].trim()) {
        configs.push({
          name: 'comment',
          kind: 'comment',
          content: commentMatch[1].trim(),
          lineStart: i + 1,
          lineEnd: i + 1
        });
      }
    }
  }

  /**
   * Generates a unique chunk ID
   */
  private generateChunkId(filePath: string, lineStart: number, lineEnd: number): string {
    const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
    return `chunk:${fileName}:${lineStart}-${lineEnd}`;
  }
}

/**
 * Factory function to create Vite parser
 */
export function createViteParser(): ViteParser {
  return new ViteParser();
}
