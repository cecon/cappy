/**
 * @fileoverview Diagnostic tool for graph relationships and depth
 * @module commands/diagnose-graph
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import type { GraphStorePort } from '../../../../domains/dashboard/ports/indexing-port';
import { ASTRelationshipExtractor } from '../../../../nivel2/infrastructure/services/ast-relationship-extractor';
import * as path from 'path';
import * as fs from 'fs';

interface DiagnosticReport {
  totalFiles: number;
  totalChunks: number;
  totalRelationships: number;
  relationshipTypes: Record<string, number>;
  filesWithoutChunks: string[];
  chunksWithoutRelationships: string[];
  orphanChunks: string[];
  deepestPath: { depth: number; path: string[] };
  averageChunksPerFile: number;
  filesWithImports: number;
  filesWithExports: number;
  crossFileReferences: number;
  intraFileReferences: number;
}

/**
 * Initialize diagnostic report
 */
function createEmptyReport(): DiagnosticReport {
  return {
    totalFiles: 0,
    totalChunks: 0,
    totalRelationships: 0,
    relationshipTypes: {},
    filesWithoutChunks: [],
    chunksWithoutRelationships: [],
    orphanChunks: [],
    deepestPath: { depth: 0, path: [] },
    averageChunksPerFile: 0,
    filesWithImports: 0,
    filesWithExports: 0,
    crossFileReferences: 0,
    intraFileReferences: 0,
  };
}

/**
 * Check database consistency
 * Verifies that vectors and nodes are in sync
 */
async function checkDatabaseConsistency(
  graphStore: GraphStorePort,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  outputChannel.appendLine('🏥 Checking Database Consistency...');
  
  try {
    // Check if graphStore has diagnoseConsistency method
    if (typeof (graphStore as any).diagnoseConsistency === 'function') {
      const diagnosis = await (graphStore as any).diagnoseConsistency();
      
      outputChannel.appendLine(`   📊 Nodes: ${diagnosis.nodesCount}`);
      outputChannel.appendLine(`   🔗 Edges: ${diagnosis.edgesCount}`);
      outputChannel.appendLine(`   🧮 Vectors: ${diagnosis.vectorsCount}`);
      
      if (diagnosis.isConsistent) {
        outputChannel.appendLine('   ✅ Database is CONSISTENT\n');
      } else {
        outputChannel.appendLine('   ⚠️  INCONSISTENCIES DETECTED:\n');
        
        for (const issue of diagnosis.issues) {
          outputChannel.appendLine(`   ❌ ${issue}`);
        }
        
        outputChannel.appendLine('');
        
        if (diagnosis.chunksWithoutNodes > 0) {
          outputChannel.appendLine(`   💡 ${diagnosis.chunksWithoutNodes} vectors are indexed but have no graph nodes.`);
          outputChannel.appendLine('      Run workspace scan to rebuild the graph.\n');
        }
        
        if (diagnosis.nodesWithoutVectors > 0) {
          outputChannel.appendLine(`   💡 ${diagnosis.nodesWithoutVectors} nodes exist but have no vector embeddings.`);
          outputChannel.appendLine('      These nodes cannot be found via semantic search.\n');
        }
      }
    } else {
      outputChannel.appendLine('   ⚠️  Consistency check not available (old adapter version)\n');
    }
  } catch (error) {
    outputChannel.appendLine(`   ❌ Consistency check failed: ${error}\n`);
  }
}

/**
 * Load and count all files
 */
async function loadFiles(
  graphStore: GraphStorePort,
  outputChannel: vscode.OutputChannel
): Promise<Array<{ path: string }>> {
  outputChannel.appendLine('📂 Loading all indexed files...');
  const files = await graphStore.listAllFiles();
  outputChannel.appendLine(`   Found ${files.length} files\n`);
  return files;
}

/**
 * Analyze AST for a single file
 */
async function analyzeFileAST(
  filePath: string,
  workspaceRoot: string,
  outputChannel: vscode.OutputChannel,
  report: DiagnosticReport
): Promise<void> {
  if (!fs.existsSync(filePath)) return;

  try {
    const extractor = new ASTRelationshipExtractor(workspaceRoot);
    const analysis = await extractor.analyze(filePath);

    if (analysis.imports.length > 0) {
      report.filesWithImports++;
      outputChannel.appendLine(`      📥 ${analysis.imports.length} imports: ${analysis.imports.map((i) => i.source).join(', ')}`);
    }

    if (analysis.exports.length > 0) {
      report.filesWithExports++;
      outputChannel.appendLine(`      📤 ${analysis.exports.length} exports: ${analysis.exports.join(', ')}`);
    }

    if (analysis.calls.length > 0) {
      outputChannel.appendLine(`      📞 ${analysis.calls.length} function calls detected`);
    }

    if (analysis.typeRefs.length > 0) {
      outputChannel.appendLine(`      🏷️  ${analysis.typeRefs.length} type references`);
    }
  } catch (e) {
    outputChannel.appendLine(`      ⚠️ AST analysis failed: ${e}`);
  }
}

/**
 * Analyze file structure and chunks
 */
async function analyzeFileStructure(
  files: Array<{ path: string }>,
  graphStore: GraphStorePort,
  outputChannel: vscode.OutputChannel,
  workspaceRoot: string,
  report: DiagnosticReport
): Promise<void> {
  outputChannel.appendLine('🔬 Analyzing file structure...');
  let totalChunkCount = 0;

  for (const file of files) {
    const chunks = await graphStore.getFileChunks(file.path);
    totalChunkCount += chunks.length;

    if (chunks.length === 0) {
      report.filesWithoutChunks.push(file.path);
    }

    outputChannel.appendLine(`   📄 ${path.basename(file.path)}: ${chunks.length} chunks`);
    await analyzeFileAST(file.path, workspaceRoot, outputChannel, report);
  }

  report.totalChunks = totalChunkCount;
  report.averageChunksPerFile = totalChunkCount / files.length;
  outputChannel.appendLine(`\n   Total chunks: ${totalChunkCount}`);
  outputChannel.appendLine(`   Average chunks per file: ${report.averageChunksPerFile.toFixed(2)}\n`);
}

/**
 * Analyze relationships statistics
 */
async function analyzeRelationships(
  graphStore: GraphStorePort,
  outputChannel: vscode.OutputChannel,
  report: DiagnosticReport
): Promise<void> {
  outputChannel.appendLine('🔗 Analyzing relationships...');
  const stats = graphStore.getStats();
  report.totalRelationships = stats.relationships;
  outputChannel.appendLine(`   Total relationships: ${stats.relationships}\n`);
}

/**
 * Test graph depth traversal
 */
async function testDepthTraversal(
  graphStore: GraphStorePort,
  outputChannel: vscode.OutputChannel,
  report: DiagnosticReport
): Promise<void> {
  outputChannel.appendLine('📊 Testing graph depth traversal...');
  
  for (let depth = 1; depth <= 5; depth++) {
    try {
      const subgraph = await graphStore.getSubgraph(undefined, depth);
      outputChannel.appendLine(`   Depth ${depth}: ${subgraph.nodes.length} nodes, ${subgraph.edges.length} edges`);

      if (depth === 5 && subgraph.nodes.length > report.deepestPath.depth) {
        report.deepestPath.depth = subgraph.nodes.length;
      }
    } catch (e) {
      outputChannel.appendLine(`   ⚠️ Depth ${depth} failed: ${e}`);
    }
  }
  
  outputChannel.appendLine('');
}

/**
 * Display relationship patterns info
 */
function displayRelationshipPatterns(outputChannel: vscode.OutputChannel): void {
  outputChannel.appendLine('🔍 Checking relationship patterns...');
  outputChannel.appendLine('   Looking for:');
  outputChannel.appendLine('   - File -> Chunk (CONTAINS)');
  outputChannel.appendLine('   - Chunk -> Chunk (REFERENCES, DOCUMENTS)');
  outputChannel.appendLine('   - Chunk -> File (REFERENCES - cross-file)');
  outputChannel.appendLine('');
}

/**
 * Group relationships by type
 */
function groupRelationshipsByType(
  relationships: Array<{ type: string; from: string; to: string; properties?: unknown }>
): Record<string, typeof relationships> {
  const byType: Record<string, typeof relationships> = {};
  
  for (const rel of relationships) {
    if (!byType[rel.type]) {
      byType[rel.type] = [];
    }
    byType[rel.type].push(rel);
  }
  
  return byType;
}

/**
 * Display sample relationships
 */
async function displaySampleRelationships(
  graphStore: GraphStorePort,
  outputChannel: vscode.OutputChannel,
  report: DiagnosticReport
): Promise<void> {
  outputChannel.appendLine('📋 Sample relationships (first 20):');
  
  try {
    const sampleRelationships = await graphStore.getSampleRelationships(20);

    if (sampleRelationships.length === 0) {
      outputChannel.appendLine('   ⚠️ No relationships found in database');
      return;
    }

    outputChannel.appendLine(`   Found ${sampleRelationships.length} sample relationships:\n`);

    const byType = groupRelationshipsByType(sampleRelationships);

    for (const [type, rels] of Object.entries(byType)) {
      outputChannel.appendLine(`   🔗 ${type} (${rels.length}):`);
      
      const displayRels = rels.slice(0, 5);
      for (const rel of displayRels) {
        const fromShort = path.basename(rel.from);
        const toShort = path.basename(rel.to);
        const props = rel.properties ? ` [${JSON.stringify(rel.properties)}]` : '';
        outputChannel.appendLine(`      ${fromShort} → ${toShort}${props}`);
      }
      
      if (rels.length > 5) {
        outputChannel.appendLine(`      ... and ${rels.length - 5} more ${type} relationships`);
      }
      outputChannel.appendLine('');
    }

    for (const rel of sampleRelationships) {
      report.relationshipTypes[rel.type] = (report.relationshipTypes[rel.type] || 0) + 1;
    }
  } catch (e) {
    outputChannel.appendLine(`   ⚠️ Could not fetch sample: ${e}`);
  }
  
  outputChannel.appendLine('');
}

/**
 * Count cross-file vs intra-file references
 */
function countFileReferences(
  rels: Array<{ from: string; to: string }>,
  report: DiagnosticReport
): void {
  for (const rel of rels) {
    const fromFile = rel.from.includes(':') ? rel.from.split(':')[0] : rel.from;
    const toFile = rel.to.includes(':') ? rel.to.split(':')[0] : rel.to;

    if (fromFile === toFile) {
      report.intraFileReferences++;
    } else {
      report.crossFileReferences++;
    }
  }
}

/**
 * Analyze relationship type distribution
 */
async function analyzeRelationshipTypes(
  graphStore: GraphStorePort,
  outputChannel: vscode.OutputChannel,
  report: DiagnosticReport
): Promise<void> {
  outputChannel.appendLine('📊 Relationship type distribution:');
  
  try {
    const relationshipsByType = await graphStore.getRelationshipsByType();

    if (Object.keys(relationshipsByType).length === 0) {
      outputChannel.appendLine('   ⚠️ No relationships found');
      return;
    }

    for (const [type, rels] of Object.entries(relationshipsByType)) {
      if (!Array.isArray(rels)) continue;

      report.relationshipTypes[type] = rels.length;
      outputChannel.appendLine(`   ${type}: ${rels.length}`);

      if (type === 'REFERENCES' || type === 'IMPORTS') {
        countFileReferences(rels, report);
      }
    }
  } catch (e) {
    outputChannel.appendLine(`   ⚠️ Could not fetch relationship types: ${e}`);
  }
  
  outputChannel.appendLine('');
}

/**
 * Display identified issues
 */
function displayIssues(
  outputChannel: vscode.OutputChannel,
  report: DiagnosticReport
): void {
  outputChannel.appendLine('⚠️  Issues Found:');
  
  if (report.filesWithoutChunks.length > 0) {
    outputChannel.appendLine(`   - ${report.filesWithoutChunks.length} files without chunks:`);
    
    const displayFiles = report.filesWithoutChunks.slice(0, 5);
    for (const f of displayFiles) {
      outputChannel.appendLine(`     • ${path.basename(f)}`);
    }
    
    if (report.filesWithoutChunks.length > 5) {
      outputChannel.appendLine(`     ... and ${report.filesWithoutChunks.length - 5} more`);
    }
  }
  
  outputChannel.appendLine('');
}

/**
 * Display recommendations
 */
function displayRecommendations(
  outputChannel: vscode.OutputChannel,
  report: DiagnosticReport
): void {
  outputChannel.appendLine('💡 Recommendations:');

  if (report.averageChunksPerFile < 2) {
    outputChannel.appendLine('   ⚠️ Low chunk count per file - file parsing may not be working correctly');
  }

  if (report.totalRelationships === 0) {
    outputChannel.appendLine('   🔴 CRITICAL: No relationships found!');
    outputChannel.appendLine('      - Check if createRelationships is being called');
    outputChannel.appendLine('      - Verify AST extraction is working');
    outputChannel.appendLine('      - Run: "Cappy: Reanalyze Relationships"');
  } else if (report.totalRelationships < report.totalChunks) {
    outputChannel.appendLine('   ⚠️ Few relationships compared to chunks');
    outputChannel.appendLine('      - Expected: at least 1 CONTAINS per chunk');
    outputChannel.appendLine('      - Consider running: "Cappy: Reanalyze Relationships"');
  }

  if (report.filesWithImports > 0 && report.crossFileReferences === 0) {
    outputChannel.appendLine('   ⚠️ Files have imports but no cross-file references created');
    outputChannel.appendLine('      - This limits graph depth and connectivity');
    outputChannel.appendLine('      - Run: "Cappy: Reanalyze Relationships"');
  }

  if (report.deepestPath.depth <= report.totalFiles) {
    outputChannel.appendLine('   ⚠️ Graph depth is shallow (depth ≈ number of files)');
    outputChannel.appendLine('      - Indicates lack of chunk-level relationships');
    outputChannel.appendLine('      - Should see depth increasing with chunk connections');
  }

  outputChannel.appendLine('');
  outputChannel.appendLine('✅ Diagnostics complete!');
  outputChannel.appendLine('');
  outputChannel.appendLine('Next steps:');
  outputChannel.appendLine('1. Review issues and recommendations above');
  outputChannel.appendLine('2. If needed, run: "Cappy: Reanalyze Relationships"');
  outputChannel.appendLine('3. Check Extension Host console for detailed logs');
}

/**
 * Performs comprehensive graph diagnostics
 */
export async function diagnoseGraph(
  graphStore: GraphStorePort,
  outputChannel: vscode.OutputChannel,
  workspaceRoot: string
): Promise<DiagnosticReport> {
  outputChannel.clear();
  outputChannel.show();
  outputChannel.appendLine('🔍 Starting Graph Diagnostics...\n');

  const report = createEmptyReport();

  try {
    // 0. Check database consistency (NEW)
    await checkDatabaseConsistency(graphStore, outputChannel);

    // 1. Load all files
    const files = await loadFiles(graphStore, outputChannel);
    report.totalFiles = files.length;

    // 2. Analyze file structure
    await analyzeFileStructure(files, graphStore, outputChannel, workspaceRoot, report);

    // 3. Analyze relationships
    await analyzeRelationships(graphStore, outputChannel, report);

    // 4. Test depth traversal
    await testDepthTraversal(graphStore, outputChannel, report);

    // 5. Display relationship patterns
    displayRelationshipPatterns(outputChannel);

    // 6. Sample relationships
    await displaySampleRelationships(graphStore, outputChannel, report);

    // 7. Relationship type distribution
    await analyzeRelationshipTypes(graphStore, outputChannel, report);

    // 8. Display issues
    displayIssues(outputChannel, report);

    // 9. Display recommendations
    displayRecommendations(outputChannel, report);

  } catch (error) {
    outputChannel.appendLine(`\n❌ Diagnostic error: ${error}`);
    throw error;
  }

  return report;
}

/**
 * Register the diagnostic command
 */
export function registerDiagnoseGraphCommand(
  context: vscode.ExtensionContext,
  graphStore: GraphStorePort
): void {
  const outputChannel = vscode.window.createOutputChannel('Cappy Graph Diagnostics');
  
  const command = vscode.commands.registerCommand(
    'cappy.diagnoseGraph',
    async () => {
      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }
        await diagnoseGraph(graphStore, outputChannel, workspaceRoot);
      } catch (error) {
        vscode.window.showErrorMessage(`Graph diagnostics failed: ${error}`);
      }
    }
  );

  context.subscriptions.push(command, outputChannel);
}
