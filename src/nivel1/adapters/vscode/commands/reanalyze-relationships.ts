/**
 * @fileoverview Command to reanalyze relationships for all indexed files
 * @module commands/reanalyze-relationships
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import type { GraphStorePort } from '../../../../domains/dashboard/ports/indexing-port';
import { ASTRelationshipExtractor } from '../../../../nivel2/infrastructure/services/ast-relationship-extractor';
import type { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

/**
 * Reanalyzes all file relationships
 */
export async function reanalyzeRelationships(
  graphStore: GraphStorePort,
  workspaceRoot: string,
  metadataDb?: FileMetadataDatabase
): Promise<void> {
  const startTime = Date.now();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Reanalyzing Relationships',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Loading indexed files...' });

        // 1. Get all indexed files from graph store
        const files = await graphStore.listAllFiles();
        console.log(`📂 Found ${files.length} indexed files`);

        if (files.length === 0) {
          vscode.window.showInformationMessage('No indexed files found');
          return;
        }

        progress.report({ message: `Processing ${files.length} files...` });

        let processedCount = 0;
        let relationshipsCreated = 0;
        const fileMap = new Map<string, string>(); // Map filename -> file id

        // Build a map of filenames to file IDs
        for (const file of files) {
          const fileName = path.basename(file.path);
          fileMap.set(fileName, file.path);
        }

        console.log(`📋 File map:`, Array.from(fileMap.entries()));

        // 2. For each file, reanalyze relationships
        for (const file of files) {
          const filePath = file.path;
          processedCount++;

          progress.report({
            message: `${processedCount}/${files.length}: ${path.basename(filePath)}`,
            increment: (100 / files.length),
          });

          try {
            // Check if this is an uploaded file (virtual path)
            const isUploadedFile = filePath.startsWith('uploaded:');
            let actualFilePath = filePath;
            let tempFile: string | null = null;

            if (isUploadedFile && metadataDb) {
              // Get file content from metadata database
              const metadata = await metadataDb.getFileByPath(filePath);
              
              if (metadata?.fileContent) {
                // Create temporary file for analysis
                const fileName = path.basename(filePath).replace(/^uploaded:/, '');
                tempFile = path.join(os.tmpdir(), `cappy-reanalyze-${Date.now()}-${fileName}`);
                
                // Decode base64 content and write to temp file
                const content = Buffer.from(metadata.fileContent, 'base64').toString('utf-8');
                fs.writeFileSync(tempFile, content);
                actualFilePath = tempFile;
                console.log(`📝 Created temp file for analysis: ${tempFile}`);
              } else {
                console.warn(`⚠️ No content found for uploaded file ${filePath}`);
                continue;
              }
            } else if (!fs.existsSync(actualFilePath)) {
              console.warn(`⚠️ File not found: ${actualFilePath}`);
              continue;
            }

            // 2a. Extract AST relationships (imports, exports, calls)
            const extractor = new ASTRelationshipExtractor(workspaceRoot);
            const relationships = await extractor.analyze(actualFilePath);

            // Clean up temp file immediately after analysis
            if (tempFile && fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
              console.log(`🗑️  Temp file cleaned up`);
            }

            console.log(`📊 ${path.basename(filePath)}: ${relationships.imports.length} imports, ${relationships.exports.length} exports, ${relationships.calls.length} calls`);

            // 2b. Get all chunks for this file
            const fileChunks = await graphStore.getFileChunks(filePath);

            if (fileChunks.length === 0) {
              console.warn(`⚠️ No chunks found for ${filePath}`);
              continue;
            }

            // 2c. Create cross-file relationships for imports
            const crossFileRels: Array<{
              from: string;
              to: string;
              type: string;
              properties?: Record<string, string | number | boolean | string[] | null>;
            }> = [];

            for (const importDecl of relationships.imports) {
              if (importDecl.isExternal) {
                continue; // Skip external imports for now
              }

              console.log(`🔍 Processing import: "${importDecl.source}" from ${path.basename(filePath)}`);

              // For uploaded files, try to match by filename
              let resolvedPath: string | null = null;

              // Extract the imported filename
              const importedFileName = importDecl.source.replace(/^[./]+/, '').replace(/\.(ts|tsx|js|jsx)$/, '');
              
              // Try to find matching file in the map
              for (const [fileName, fileId] of fileMap.entries()) {
                const baseFileName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');
                if (baseFileName === importedFileName || fileName.includes(importedFileName)) {
                  resolvedPath = fileId;
                  console.log(`✅ Resolved "${importDecl.source}" -> "${fileId}"`);
                  break;
                }
              }

              if (!resolvedPath) {
                // Try traditional path resolution for non-uploaded files
                resolvedPath = await resolveImportPath(filePath, importDecl.source);
              }

              if (resolvedPath) {
                // Check if target file exists in graph
                const targetExists = files.some(f => f.path === resolvedPath);

                if (targetExists) {
                  // Create IMPORTS edge from file to file
                  crossFileRels.push({
                    from: filePath,
                    to: resolvedPath,
                    type: 'IMPORTS',
                    properties: {
                      source: importDecl.source,
                      specifiers: importDecl.specifiers
                    },
                  });

                  // Create IMPORTS_SYMBOL edges from chunks to chunks
                  const targetChunks = await graphStore.getFileChunks(resolvedPath);
                  
                  for (const specifier of importDecl.specifiers) {
                    // Find target chunk that exports this symbol
                    const targetChunk = targetChunks.find(c => 
                      c.label.includes(specifier) || c.id.includes(specifier)
                    );

                    if (targetChunk) {
                      // Connect all source chunks to this target chunk
                      for (const sourceChunk of fileChunks) {
                        crossFileRels.push({
                          from: sourceChunk.id,
                          to: targetChunk.id,
                          type: 'IMPORTS_SYMBOL',
                          properties: {
                            symbol: specifier,
                            sourceFile: filePath,
                            targetFile: resolvedPath
                          }
                        });
                      }
                    }
                  }

                  relationshipsCreated++;
                } else {
                  console.log(`⚠️ Import target not indexed: ${resolvedPath}`);
                }
              }
            }

            // 2d. Create relationships in graph
            if (crossFileRels.length > 0) {
              await graphStore.createRelationships(crossFileRels);
              console.log(`✅ Created ${crossFileRels.length} cross-file relationships for ${path.basename(filePath)}`);
            }

          } catch (error) {
            console.error(`❌ Error processing ${filePath}:`, error);
          }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const message = `✅ Reanalysis complete: ${processedCount} files, ${relationshipsCreated} relationships created in ${duration}s`;

        console.log(message);
        vscode.window.showInformationMessage(message);

      } catch (error) {
        console.error('❌ Reanalyze error:', error);
        vscode.window.showErrorMessage(`Failed to reanalyze relationships: ${error}`);
      }
    }
  );
}

/**
 * Register the reanalyze relationships command
 */
export function registerReanalyzeRelationshipsCommand(
  context: vscode.ExtensionContext,
  graphStore: GraphStorePort,
  fileDatabase: FileMetadataDatabase
): void {
  const command = vscode.commands.registerCommand('cappy.reanalyzeRelationships', async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    await reanalyzeRelationships(graphStore, workspaceRoot, fileDatabase);
  });

  context.subscriptions.push(command);
}

/**
 * Resolves import path to absolute file path
 */
async function resolveImportPath(
  sourceFilePath: string,
  importSource: string
): Promise<string | null> {
  // Only handle relative imports for now
  if (!importSource.startsWith('./') && !importSource.startsWith('../')) {
    return null;
  }

  const sourceDir = path.dirname(sourceFilePath);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];

  for (const ext of extensions) {
    const candidatePath = path.resolve(sourceDir, importSource + ext);

    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(candidatePath));
      return candidatePath;
    } catch {
      // File doesn't exist, try next extension
    }
  }

  // Try exact path (might already have extension)
  try {
    const exactPath = path.resolve(sourceDir, importSource);
    await vscode.workspace.fs.stat(vscode.Uri.file(exactPath));
    return exactPath;
  } catch {
    return null;
  }
}
