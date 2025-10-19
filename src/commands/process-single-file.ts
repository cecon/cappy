/**
 * @fileoverview Command to process a single file through the entire pipeline
 * @module commands/process-single-file
 * @author Cappy Team
 * @since 3.0.4
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ParserService } from '../services/parser-service';
import { IndexingService } from '../services/indexing-service';
import { ASTRelationshipExtractor } from '../services/ast-relationship-extractor';
import { EmbeddingService } from '../services/embedding-service';
import { createSQLiteAdapter } from '../adapters/secondary/graph/sqlite-adapter';
import type { VectorStorePort } from '../domains/graph/ports/indexing-port';

/**
 * Progress callback type
 */
type ProgressCallback = (step: string, progress: number) => void;

/**
 * Internal command that accepts progress callbacks
 */
export async function processSingleFileInternal(options: {
  filePath: string;
  onProgress?: ProgressCallback;
}): Promise<void> {
  const { filePath, onProgress } = options;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    throw new Error('No workspace folder open');
  }

  try {
    // Initialize services
    onProgress?.('Initializing services...', 10);
    
    const embeddingService = new EmbeddingService();
    await embeddingService.initialize();
    
    // Vector store removed - using SQLite only
    // const vectorStore = createLanceDBAdapter(workspaceRoot);
    const graphStore = createSQLiteAdapter(workspaceRoot);
    const indexingService = new IndexingService(
      null as unknown as VectorStorePort, // TODO: Remove VectorStore dependency
      graphStore,
      embeddingService,
      workspaceRoot
    );
    const parserService = new ParserService();
    const relationshipExtractor = new ASTRelationshipExtractor(workspaceRoot);

    await indexingService.initialize();

    // Parse file
    onProgress?.('Parsing AST...', 30);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 PROCESSING FILE: ${filePath}`);
    console.log(`${'='.repeat(80)}\n`);

    const language = path.extname(filePath).slice(1);
  let chunks = await parserService.parseFile(filePath);

    console.log(`\n📦 CHUNKS EXTRACTED: ${chunks.length}`);
    chunks.forEach((chunk, i) => {
      console.log(`\n  Chunk ${i + 1}/${chunks.length}:`);
      console.log(`    ID: ${chunk.id}`);
      console.log(`    Type: ${chunk.metadata.chunkType}`);
      console.log(`    Symbol: ${chunk.metadata.symbolName || 'N/A'}`);
      console.log(`    Lines: ${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}`);
      console.log(`    Content Preview: ${chunk.content.substring(0, 100)}...`);
    });

    if (chunks.length === 0) {
      // Fallback: create single file-level code chunk including entire file
      const fs = await import('fs');
      const content = fs.readFileSync(filePath, 'utf-8');
      const lineCount = Math.max(1, content.split('\n').length);
      const fileNameOnly = path.basename(filePath);
      const chunkId = `chunk:${fileNameOnly}:1-${lineCount}`;

      chunks = [{
        id: chunkId,
        content,
        metadata: {
          filePath,
          lineStart: 1,
          lineEnd: lineCount,
          chunkType: 'code',
          symbolName: fileNameOnly.replace(/\.[^.]+$/, ''),
          symbolKind: 'variable'
        }
      }];

      console.log(`⚠️ No JSDoc extracted; created 1 fallback code chunk for ${filePath}`);
    }

    // Extract relationships
    onProgress?.('Extracting relationships...', 50);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🕸️ EXTRACTING RELATIONSHIPS`);
    console.log(`${'='.repeat(80)}\n`);

    const relationships = await relationshipExtractor.extract(filePath, chunks);
    
    console.log(`\n📊 RELATIONSHIPS FOUND: ${relationships.length}`);
    relationships.forEach((rel, i) => {
      console.log(`\n  Relationship ${i + 1}/${relationships.length}:`);
      console.log(`    Type: ${rel.type}`);
      console.log(`    From: ${rel.from}`);
      console.log(`    To: ${rel.to}`);
      console.log(`    Properties:`, rel.properties);
    });

    // Index in Vector Store
    onProgress?.('Generating embeddings...', 70);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🤖 INDEXING IN VECTOR STORE`);
    console.log(`${'='.repeat(80)}\n`);

    await indexingService.indexFile(filePath, language, chunks);

    // Create relationships in Graph Store
    onProgress?.('Creating graph relationships...', 85);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 CREATING GRAPH RELATIONSHIPS`);
    console.log(`${'='.repeat(80)}\n`);

    if (relationships.length > 0) {
      await graphStore.createRelationships(relationships);
      console.log(`✅ Created ${relationships.length} relationships in graph database`);
    } else {
      console.log(`⚠️ No relationships to create`);
    }

    // Verification
    onProgress?.('Verifying indexing...', 95);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ VERIFICATION`);
    console.log(`${'='.repeat(80)}\n`);

    if (chunks.length > 0) {
      const testQuery = chunks[0].metadata.symbolName || 'function';
      console.log(`🔍 Testing search with query: "${testQuery}"`);
      
      const searchResults = await indexingService.hybridSearch(testQuery, 2);
      console.log(`\n📊 Search Results:`);
      console.log(`   - Direct matches: ${searchResults.directMatches.length}`);
      console.log(`   - Related chunks: ${searchResults.relatedChunks.length}`);
      
      if (searchResults.directMatches.length > 0) {
        console.log(`\n   Top match:`);
        const top = searchResults.directMatches[0];
        console.log(`     - Symbol: ${top.metadata.symbolName}`);
        console.log(`     - Type: ${top.metadata.chunkType}`);
        console.log(`     - File: ${top.metadata.filePath}`);
      }
    }

    onProgress?.('Completed', 100);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ PROCESSING COMPLETE`);
    console.log(`${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('❌ Error processing file:', error);
    throw error;
  }
}

/**
 * Processes a single file through AST → Chunks → Vector → Graph pipeline
 */
export async function processSingleFileCommand(): Promise<void> {
  try {
    // 1. Select file to process
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'TypeScript': ['ts', 'tsx'],
        'JavaScript': ['js', 'jsx'],
        'All Files': ['*']
      },
      title: 'Select a file to process'
    });

    if (!fileUri || fileUri.length === 0) {
      vscode.window.showWarningMessage('No file selected');
      return;
    }

    const filePath = fileUri[0].fsPath;
    const fileName = path.basename(filePath);

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Processing ${fileName}`,
      cancellable: false
    }, async (progress) => {
      
      await processSingleFileInternal({
        filePath,
        onProgress: (step, percent) => {
          progress.report({ message: step, increment: percent });
        }
      });

      // Show summary
      const message = `✅ ${fileName} processed successfully!\n\nCheck the Debug Console for detailed output.`;
      vscode.window.showInformationMessage(message);
    });

  } catch (error) {
    console.error('❌ Error processing file:', error);
    vscode.window.showErrorMessage(`Error processing file: ${error}`);
  }
}

/**
 * Registers the commands
 */
export function registerProcessSingleFileCommand(context: vscode.ExtensionContext): void {
  // Public command with file picker
  const disposable = vscode.commands.registerCommand(
    'cappy.processSingleFile',
    processSingleFileCommand
  );
  context.subscriptions.push(disposable);

  // Internal command for programmatic use
  const internalDisposable = vscode.commands.registerCommand(
    'cappy.processSingleFileInternal',
    processSingleFileInternal
  );
  context.subscriptions.push(internalDisposable);
}
