/**
 * @fileoverview Command to reanalyze relationships for all indexed files
 * @module commands/reanalyze-relationships
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import type { GraphStorePort } from '../domains/graph/ports/indexing-port';
import { ASTRelationshipExtractor } from '../services/ast-relationship-extractor';
import * as path from 'path';

/**
 * Reanalyzes all relationships for indexed files
 */
export async function reanalyzeRelationships(
  graphStore: GraphStorePort,
  workspaceRoot: string
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

        // 2. For each file, reanalyze relationships
        for (const file of files) {
          const filePath = file.path;
          processedCount++;

          progress.report({
            message: `${processedCount}/${files.length}: ${path.basename(filePath)}`,
            increment: (100 / files.length),
          });

          try {
            // 2a. Extract AST relationships (imports, exports, calls)
            const extractor = new ASTRelationshipExtractor(workspaceRoot);
            const relationships = await extractor.analyze(filePath);

            console.log(`📊 ${path.basename(filePath)}: ${relationships.imports.length} imports, ${relationships.exports.length} exports, ${relationships.calls.length} calls`);

            // 2b. Get all chunks for this file
            const fileChunks = await graphStore.getFileChunks(filePath);

            if (fileChunks.length === 0) {
              console.warn(`⚠️ No chunks found for ${filePath}`);
              continue;
            }

            // 2c. Create REFERENCES relationships for imports
            const importRelationships: Array<{
              from: string;
              to: string;
              type: string;
              properties?: Record<string, string | number | boolean>;
            }> = [];

            for (const importDecl of relationships.imports) {
              // Resolve import path
              const resolvedPath = await resolveImportPath(filePath, importDecl.source);

              if (resolvedPath) {
                // Check if target file exists in graph
                const targetExists = files.some(f => f.path === resolvedPath);

                if (targetExists) {
                  // Create REFERENCES edge from first chunk to target file
                  importRelationships.push({
                    from: fileChunks[0].id,
                    to: resolvedPath,
                    type: 'REFERENCES',
                    properties: {
                      referenceType: 'import',
                      source: importDecl.source,
                      imported: importDecl.specifiers.join(', '),
                    },
                  });
                  relationshipsCreated++;
                } else {
                  console.log(`⚠️ Import target not indexed: ${resolvedPath}`);
                }
              }
            }

            // 2d. Create relationships in graph
            if (importRelationships.length > 0) {
              await graphStore.createRelationships(importRelationships);
              console.log(`✅ Created ${importRelationships.length} REFERENCES for ${path.basename(filePath)}`);
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
        console.error('❌ Error reanalyzing relationships:', error);
        vscode.window.showErrorMessage(`Failed to reanalyze relationships: ${error}`);
      }
    }
  );
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
