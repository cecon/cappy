/**
 * Database Diagnostics Script
 * Analyzes the SQLite database for issues with graph data, vectors, and metadata
 */

import { Database } from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { promisify } from 'util';

interface DiagnosticResult {
  category: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  message: string;
  details?: any;
}

class DatabaseDiagnostics {
  private db: sqlite3.Database;
  private results: DiagnosticResult[] = [];

  constructor(dbPath: string) {
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database not found at: ${dbPath}`);
    }
    this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    console.log(`✓ Connected to database: ${dbPath}\n`);
  }

  /**
   * Run all diagnostics
   */
  async runAll(): Promise<void> {
    console.log('='.repeat(80));
    console.log('DATABASE DIAGNOSTICS REPORT');
    console.log('='.repeat(80));
    console.log();

    this.checkSchema();
    this.analyzeNodes();
    this.analyzeEdges();
    this.analyzeVectors();
    this.analyzeMetadata();
    this.checkConsistency();
    this.analyzeQueries();

    this.printSummary();
  }

  /**
   * Check database schema
   */
  private checkSchema(): void {
    console.log('📋 SCHEMA ANALYSIS');
    console.log('-'.repeat(80));

    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all() as { name: string }[];

    console.log(`Total tables: ${tables.length}`);
    console.log(`Tables: ${tables.map(t => t.name).join(', ')}\n`);

    const expectedTables = ['nodes', 'edges', 'vectors', 'metadata', 'file_metadata', 'vec_chunks'];
    const missingTables = expectedTables.filter(t => !tables.find(table => table.name === t));

    if (missingTables.length > 0) {
      this.results.push({
        category: 'Schema',
        status: 'ERROR',
        message: `Missing tables: ${missingTables.join(', ')}`
      });
    } else {
      this.results.push({
        category: 'Schema',
        status: 'OK',
        message: 'All expected tables present'
      });
    }

    // Check schema for each table
    for (const table of tables) {
      const schema = this.db.prepare(`PRAGMA table_info(${table.name})`).all();
      console.log(`\nTable: ${table.name}`);
      console.log('Columns:', schema.map((col: any) => `${col.name} (${col.type})`).join(', '));
    }
    console.log();
  }

  /**
   * Analyze nodes table
   */
  private analyzeNodes(): void {
    console.log('🔵 NODES ANALYSIS');
    console.log('-'.repeat(80));

    const totalNodes = this.db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
    console.log(`Total nodes: ${totalNodes.count}`);

    if (totalNodes.count === 0) {
      this.results.push({
        category: 'Nodes',
        status: 'ERROR',
        message: 'No nodes in database!'
      });
      console.log();
      return;
    }

    // Node types distribution
    const typeStats = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM nodes 
      GROUP BY type 
      ORDER BY count DESC
    `).all() as { type: string; count: number }[];

    console.log('\nNode types distribution:');
    for (const stat of typeStats) {
      console.log(`  ${stat.type}: ${stat.count}`);
    }

    // Check for file nodes
    const fileNodes = typeStats.find(s => s.type === 'file');
    if (fileNodes) {
      console.log(`\n⚠️  Found ${fileNodes.count} file nodes (these are filtered out in retrieval)`);
      this.results.push({
        category: 'Nodes',
        status: 'WARNING',
        message: `${fileNodes.count} file nodes present (will be filtered in retrieval)`,
        details: { fileNodeCount: fileNodes.count }
      });
    }

    // Check for entity nodes
    const entityCheck = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM nodes 
      WHERE id LIKE 'entity:%'
    `).get() as { count: number };

    if (entityCheck.count > 0) {
      console.log(`⚠️  Found ${entityCheck.count} entity nodes (these are filtered out in retrieval)`);
      this.results.push({
        category: 'Nodes',
        status: 'WARNING',
        message: `${entityCheck.count} entity nodes present (will be filtered in retrieval)`,
        details: { entityNodeCount: entityCheck.count }
      });
    }

    // Check for chunk nodes
    const chunkNodes = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM nodes 
      WHERE type IN ('chunk', 'code_chunk', 'doc_chunk', 'markdown_section', 'document_section')
    `).get() as { count: number };

    console.log(`\n✓ Chunk nodes (actual content): ${chunkNodes.count}`);
    
    if (chunkNodes.count === 0) {
      this.results.push({
        category: 'Nodes',
        status: 'ERROR',
        message: 'No chunk nodes found! These are needed for retrieval.',
        details: { chunkNodeCount: 0 }
      });
    } else {
      this.results.push({
        category: 'Nodes',
        status: 'OK',
        message: `${chunkNodes.count} chunk nodes available for retrieval`,
        details: { chunkNodeCount: chunkNodes.count }
      });
    }

    // Sample some nodes
    console.log('\nSample nodes (first 5):');
    const sampleNodes = this.db.prepare(`
      SELECT id, type, label, metadata 
      FROM nodes 
      LIMIT 5
    `).all();
    
    for (const node of sampleNodes) {
      console.log(`  ID: ${(node as any).id}`);
      console.log(`  Type: ${(node as any).type}`);
      console.log(`  Label: ${(node as any).label.substring(0, 60)}...`);
      console.log();
    }

    console.log();
  }

  /**
   * Analyze edges table
   */
  private analyzeEdges(): void {
    console.log('🔗 EDGES ANALYSIS');
    console.log('-'.repeat(80));

    const totalEdges = this.db.prepare('SELECT COUNT(*) as count FROM edges').get() as { count: number };
    console.log(`Total edges: ${totalEdges.count}`);

    if (totalEdges.count === 0) {
      this.results.push({
        category: 'Edges',
        status: 'WARNING',
        message: 'No edges in database (nodes are isolated)'
      });
    } else {
      this.results.push({
        category: 'Edges',
        status: 'OK',
        message: `${totalEdges.count} edges connecting nodes`
      });
    }

    // Edge types distribution
    const edgeTypes = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM edges 
      GROUP BY type 
      ORDER BY count DESC
    `).all() as { type: string; count: number }[];

    if (edgeTypes.length > 0) {
      console.log('\nEdge types distribution:');
      for (const stat of edgeTypes) {
        console.log(`  ${stat.type}: ${stat.count}`);
      }
    }

    console.log();
  }

  /**
   * Analyze vectors table
   */
  private analyzeVectors(): void {
    console.log('🎯 VECTORS ANALYSIS');
    console.log('-'.repeat(80));

    // Check if vectors table exists
    const vectorsTableExists = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='vectors'
    `).get();

    if (!vectorsTableExists) {
      console.log('⚠️  Vectors table does not exist');
      this.results.push({
        category: 'Vectors',
        status: 'ERROR',
        message: 'Vectors table not found'
      });
      return;
    }

    const totalVectors = this.db.prepare('SELECT COUNT(*) as count FROM vectors').get() as { count: number };
    console.log(`Total vector entries: ${totalVectors.count}`);

    if (totalVectors.count === 0) {
      this.results.push({
        category: 'Vectors',
        status: 'ERROR',
        message: 'No vectors in database! Embeddings are missing.'
      });
      console.log();
      return;
    }

    // Check for content in vectors
    const vectorsWithContent = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM vectors 
      WHERE content IS NOT NULL AND content != ''
    `).get() as { count: number };

    console.log(`Vectors with content: ${vectorsWithContent.count} / ${totalVectors.count}`);

    if (vectorsWithContent.count === 0) {
      this.results.push({
        category: 'Vectors',
        status: 'ERROR',
        message: 'No vectors have content! This will cause empty retrieval results.'
      });
    } else if (vectorsWithContent.count < totalVectors.count) {
      this.results.push({
        category: 'Vectors',
        status: 'WARNING',
        message: `Only ${vectorsWithContent.count}/${totalVectors.count} vectors have content`,
        details: { 
          withContent: vectorsWithContent.count, 
          total: totalVectors.count 
        }
      });
    } else {
      this.results.push({
        category: 'Vectors',
        status: 'OK',
        message: `All ${totalVectors.count} vectors have content`
      });
    }

    // Check for embeddings
    const vectorsWithEmbedding = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM vectors 
      WHERE embedding IS NOT NULL
    `).get() as { count: number };

    console.log(`Vectors with embeddings: ${vectorsWithEmbedding.count} / ${totalVectors.count}`);

    if (vectorsWithEmbedding.count === 0) {
      this.results.push({
        category: 'Vectors',
        status: 'ERROR',
        message: 'No embeddings found! Vector search will not work.'
      });
    } else if (vectorsWithEmbedding.count < totalVectors.count) {
      this.results.push({
        category: 'Vectors',
        status: 'WARNING',
        message: `Only ${vectorsWithEmbedding.count}/${totalVectors.count} vectors have embeddings`
      });
    }

    // Sample vectors
    console.log('\nSample vectors (first 3):');
    const sampleVectors = this.db.prepare(`
      SELECT chunk_id, content, embedding IS NOT NULL as has_embedding
      FROM vectors 
      LIMIT 3
    `).all();

    for (const vec of sampleVectors) {
      console.log(`  Chunk ID: ${(vec as any).chunk_id}`);
      console.log(`  Content length: ${(vec as any).content?.length || 0} chars`);
      console.log(`  Has embedding: ${(vec as any).has_embedding ? 'Yes' : 'No'}`);
      if ((vec as any).content) {
        console.log(`  Content preview: ${(vec as any).content.substring(0, 100)}...`);
      }
      console.log();
    }

    console.log();
  }

  /**
   * Analyze metadata
   */
  private analyzeMetadata(): void {
    console.log('📝 METADATA ANALYSIS');
    console.log('-'.repeat(80));

    // Check nodes with metadata
    const nodesWithMetadata = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM nodes 
      WHERE metadata IS NOT NULL AND metadata != '{}'
    `).get() as { count: number };

    const totalNodes = this.db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };

    console.log(`Nodes with metadata: ${nodesWithMetadata.count} / ${totalNodes.count}`);

    // Sample metadata structure
    console.log('\nSample metadata structures:');
    const sampleMeta = this.db.prepare(`
      SELECT type, metadata 
      FROM nodes 
      WHERE metadata IS NOT NULL AND metadata != '{}' 
      LIMIT 3
    `).all();

    for (const node of sampleMeta) {
      console.log(`  Type: ${(node as any).type}`);
      try {
        const meta = JSON.parse((node as any).metadata);
        console.log(`  Metadata keys: ${Object.keys(meta).join(', ')}`);
        console.log(`  Sample: ${JSON.stringify(meta).substring(0, 150)}...`);
      } catch (e) {
        console.log('  ERROR: Invalid JSON in metadata');
      }
      console.log();
    }

    console.log();
  }

  /**
   * Check data consistency
   */
  private checkConsistency(): void {
    console.log('🔍 CONSISTENCY CHECKS');
    console.log('-'.repeat(80));

    // Check for orphaned edges (referencing non-existent nodes)
    const orphanedEdges = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM edges e
      WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id = e.source)
         OR NOT EXISTS (SELECT 1 FROM nodes WHERE id = e.target)
    `).get() as { count: number };

    if (orphanedEdges.count > 0) {
      console.log(`⚠️  Found ${orphanedEdges.count} orphaned edges (referencing non-existent nodes)`);
      this.results.push({
        category: 'Consistency',
        status: 'WARNING',
        message: `${orphanedEdges.count} orphaned edges found`,
        details: { orphanedEdges: orphanedEdges.count }
      });
    } else {
      console.log('✓ No orphaned edges');
    }

    // Check for nodes not in vectors table
    const nodesNotInVectors = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM nodes n
      WHERE n.type IN ('chunk', 'code_chunk', 'doc_chunk', 'markdown_section', 'document_section')
        AND NOT EXISTS (SELECT 1 FROM vectors WHERE chunk_id = n.id)
    `).get() as { count: number };

    if (nodesNotInVectors.count > 0) {
      console.log(`⚠️  Found ${nodesNotInVectors.count} chunk nodes WITHOUT vector entries`);
      this.results.push({
        category: 'Consistency',
        status: 'WARNING',
        message: `${nodesNotInVectors.count} chunk nodes missing from vectors table`,
        details: { chunksMissingVectors: nodesNotInVectors.count }
      });
    } else {
      console.log('✓ All chunk nodes have vector entries');
    }

    // Check for vectors not in nodes table
    const vectorsNotInNodes = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM vectors v
      WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id = v.chunk_id)
    `).get() as { count: number };

    if (vectorsNotInNodes.count > 0) {
      console.log(`⚠️  Found ${vectorsNotInNodes.count} vector entries WITHOUT corresponding nodes`);
      this.results.push({
        category: 'Consistency',
        status: 'WARNING',
        message: `${vectorsNotInNodes.count} vectors missing from nodes table`,
        details: { vectorsMissingNodes: vectorsNotInNodes.count }
      });
    } else {
      console.log('✓ All vectors have corresponding nodes');
    }

    console.log();
  }

  /**
   * Analyze query performance issues
   */
  private analyzeQueries(): void {
    console.log('🔎 QUERY ANALYSIS');
    console.log('-'.repeat(80));

    // Simulate a typical retrieval query
    console.log('Simulating retrieval query: "authentication user login"');
    
    const query = 'authentication user login';
    const queryTokens = query.toLowerCase().split(/\s+/);
    
    // Count how many chunks would match
    let matchCount = 0;
    const chunks = this.db.prepare(`
      SELECT n.id, n.label, n.type, v.content 
      FROM nodes n
      LEFT JOIN vectors v ON v.chunk_id = n.id
      WHERE n.type IN ('chunk', 'code_chunk', 'doc_chunk', 'markdown_section', 'document_section')
      LIMIT 100
    `).all();

    for (const chunk of chunks) {
      const label = ((chunk as any).label || '').toLowerCase();
      const content = ((chunk as any).content || '').toLowerCase();
      const id = ((chunk as any).id || '').toLowerCase();
      
      for (const token of queryTokens) {
        if (label.includes(token) || content.includes(token) || id.includes(token)) {
          matchCount++;
          break;
        }
      }
    }

    console.log(`Potential matches in first 100 chunks: ${matchCount}`);

    if (matchCount === 0) {
      this.results.push({
        category: 'Query',
        status: 'ERROR',
        message: 'No matches found for test query! Content may be missing or poorly indexed.',
        details: { testQuery: query, matches: 0 }
      });
    } else {
      this.results.push({
        category: 'Query',
        status: 'OK',
        message: `Test query found ${matchCount} potential matches`,
        details: { testQuery: query, matches: matchCount }
      });
    }

    // Check if there are any chunks with substantive content
    const chunksWithContent = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM vectors 
      WHERE LENGTH(content) > 100
    `).get() as { count: number };

    console.log(`Chunks with substantial content (>100 chars): ${chunksWithContent.count}`);

    if (chunksWithContent.count === 0) {
      this.results.push({
        category: 'Query',
        status: 'ERROR',
        message: 'No chunks with substantial content found!',
        details: { chunksWithContent: 0 }
      });
    }

    console.log();
  }

  /**
   * Print summary of all diagnostics
   */
  private printSummary(): void {
    console.log('='.repeat(80));
    console.log('DIAGNOSTIC SUMMARY');
    console.log('='.repeat(80));
    console.log();

    const errors = this.results.filter(r => r.status === 'ERROR');
    const warnings = this.results.filter(r => r.status === 'WARNING');
    const ok = this.results.filter(r => r.status === 'OK');

    console.log(`✅ OK: ${ok.length}`);
    console.log(`⚠️  WARNINGS: ${warnings.length}`);
    console.log(`❌ ERRORS: ${errors.length}`);
    console.log();

    if (errors.length > 0) {
      console.log('ERRORS:');
      for (const error of errors) {
        console.log(`  ❌ [${error.category}] ${error.message}`);
        if (error.details) {
          console.log(`     Details: ${JSON.stringify(error.details)}`);
        }
      }
      console.log();
    }

    if (warnings.length > 0) {
      console.log('WARNINGS:');
      for (const warning of warnings) {
        console.log(`  ⚠️  [${warning.category}] ${warning.message}`);
        if (warning.details) {
          console.log(`     Details: ${JSON.stringify(warning.details)}`);
        }
      }
      console.log();
    }

    console.log('='.repeat(80));
    console.log();

    // Recommendations
    if (errors.length > 0 || warnings.length > 0) {
      console.log('RECOMMENDATIONS:');
      console.log();

      if (errors.some(e => e.category === 'Vectors' && e.message.includes('No vectors'))) {
        console.log('  1. Run a full workspace scan to generate embeddings');
        console.log('     - Open Command Palette (Cmd+Shift+P)');
        console.log('     - Run: "Cappy: Scan Workspace"');
        console.log();
      }

      if (errors.some(e => e.category === 'Nodes' && e.message.includes('No chunk nodes'))) {
        console.log('  2. Ensure files are being chunked properly during scan');
        console.log('     - Check scanner configuration');
        console.log('     - Verify file types are supported');
        console.log();
      }

      if (warnings.some(w => w.message.includes('file nodes') || w.message.includes('entity nodes'))) {
        console.log('  3. File and entity nodes are normal but filtered during retrieval');
        console.log('     - These provide graph structure but not content');
        console.log('     - No action needed if chunk nodes exist');
        console.log();
      }

      if (warnings.some(w => w.category === 'Consistency')) {
        console.log('  4. Consider running database cleanup to fix consistency issues');
        console.log('     - Orphaned edges can be safely removed');
        console.log('     - Missing vector entries should be regenerated');
        console.log();
      }
    } else {
      console.log('✅ Database appears healthy! No critical issues found.');
      console.log();
    }
  }

  close(): void {
    this.db.close();
  }
}

// Main execution
async function main() {
  // Find database path
  const homeDir = os.homedir();
  const possiblePaths = [
    path.join(homeDir, '.cappy', 'graph.db'),
    path.join(homeDir, '.cappy', 'cappy.db'),
    path.join(process.cwd(), '.cappy', 'graph.db'),
    path.join(process.cwd(), 'graph.db')
  ];

  let dbPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      dbPath = p;
      break;
    }
  }

  if (!dbPath) {
    console.error('❌ Could not find database file!');
    console.error('Searched in:');
    for (const p of possiblePaths) {
      console.error(`  - ${p}`);
    }
    process.exit(1);
  }

  const diagnostics = new DatabaseDiagnostics(dbPath);
  
  try {
    await diagnostics.runAll();
  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
    process.exit(1);
  } finally {
    diagnostics.close();
  }
}

main().catch(console.error);
