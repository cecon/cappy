/**
 * Simple Database Diagnostics Script
 * Analyzes the SQLite database for issues
 */

import sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Helper to promisify database operations
function query<T = unknown>(db: sqlite3.Database, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

function queryOne<T = unknown>(db: sqlite3.Database, sql: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

async function runDiagnostics(dbPath: string) {
  console.log('='.repeat(80));
  console.log('DATABASE DIAGNOSTICS REPORT');
  console.log('='.repeat(80));
  console.log(`Database: ${dbPath}\n`);

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

  try {
    // 1. Check tables
    console.log('📋 SCHEMA ANALYSIS');
    console.log('-'.repeat(80));
    
    const tables = await query<{ name: string }>(db, `
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    
    console.log(`Total tables: ${tables.length}`);
    console.log(`Tables: ${tables.map(t => t.name).join(', ')}\n`);

    // 2. Analyze nodes
    console.log('🔵 NODES ANALYSIS');
    console.log('-'.repeat(80));
    
    const totalNodes = await queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM nodes');
    console.log(`Total nodes: ${totalNodes?.count || 0}`);

    if (!totalNodes || totalNodes.count === 0) {
      console.log('❌ ERROR: No nodes in database!\n');
      return;
    }

    const typeStats = await query<{ type: string; count: number }>(db, `
      SELECT type, COUNT(*) as count 
      FROM nodes 
      GROUP BY type 
      ORDER BY count DESC
    `);

    console.log('\nNode types distribution:');
    for (const stat of typeStats) {
      console.log(`  ${stat.type}: ${stat.count}`);
    }

    // Check for specific node types
    const fileNodes = typeStats.find(s => s.type === 'file');
    if (fileNodes) {
      console.log(`\n⚠️  Found ${fileNodes.count} file nodes (these are filtered out in retrieval)`);
    }

    const entityCheck = await queryOne<{ count: number }>(db, `
      SELECT COUNT(*) as count 
      FROM nodes 
      WHERE id LIKE 'entity:%'
    `);
    
    if (entityCheck && entityCheck.count > 0) {
      console.log(`⚠️  Found ${entityCheck.count} entity nodes (these are filtered out in retrieval)`);
    }

    const chunkNodes = await queryOne<{ count: number }>(db, `
      SELECT COUNT(*) as count 
      FROM nodes 
      WHERE type IN ('chunk', 'code_chunk', 'doc_chunk', 'markdown_section', 'document_section')
    `);

    console.log(`\n✓ Chunk nodes (actual content): ${chunkNodes?.count || 0}`);
    
    if (!chunkNodes || chunkNodes.count === 0) {
      console.log('❌ ERROR: No chunk nodes found! These are needed for retrieval.');
    }

    // Sample nodes
    console.log('\nSample nodes (first 3):');
    const sampleNodes = await query<{ id: string; type: string; label: string }>(db, `
      SELECT id, type, label 
      FROM nodes 
      LIMIT 3
    `);
    
    for (const node of sampleNodes) {
      console.log(`  ID: ${node.id}`);
      console.log(`  Type: ${node.type}`);
      console.log(`  Label: ${node.label.substring(0, 60)}...\n`);
    }

    // 3. Analyze edges
    console.log('🔗 EDGES ANALYSIS');
    console.log('-'.repeat(80));
    
    const totalEdges = await queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM edges');
    console.log(`Total edges: ${totalEdges?.count || 0}`);

    if (!totalEdges || totalEdges.count === 0) {
      console.log('⚠️  WARNING: No edges in database (nodes are isolated)');
    }

    const edgeTypes = await query<{ type: string; count: number }>(db, `
      SELECT type, COUNT(*) as count 
      FROM edges 
      GROUP BY type 
      ORDER BY count DESC
    `);

    if (edgeTypes.length > 0) {
      console.log('\nEdge types distribution:');
      for (const stat of edgeTypes) {
        console.log(`  ${stat.type}: ${stat.count}`);
      }
    }
    console.log();

    // 4. Analyze vectors
    console.log('🎯 VECTORS ANALYSIS');
    console.log('-'.repeat(80));
    
    const vectorsTableExists = await queryOne<{ name: string }>(db, `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='vectors'
    `);

    if (!vectorsTableExists) {
      console.log('❌ ERROR: Vectors table does not exist\n');
      return;
    }

    const totalVectors = await queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM vectors');
    console.log(`Total vector entries: ${totalVectors?.count || 0}`);

    if (!totalVectors || totalVectors.count === 0) {
      console.log('❌ ERROR: No vectors in database! Embeddings are missing.\n');
      return;
    }

    const vectorsWithContent = await queryOne<{ count: number }>(db, `
      SELECT COUNT(*) as count 
      FROM vectors 
      WHERE content IS NOT NULL AND content != ''
    `);

    console.log(`Vectors with content: ${vectorsWithContent?.count || 0} / ${totalVectors.count}`);

    if (!vectorsWithContent || vectorsWithContent.count === 0) {
      console.log('❌ ERROR: No vectors have content! This will cause empty retrieval results.');
    } else if (vectorsWithContent.count < totalVectors.count) {
      console.log(`⚠️  WARNING: Only ${vectorsWithContent.count}/${totalVectors.count} vectors have content`);
    } else {
      console.log(`✅ All vectors have content`);
    }

    // Check for vec_vectors table (sqlite-vec extension)
    console.log('\nChecking for embeddings table...');
    const vecVectorsInfo = await queryOne<{ name: string }>(db, `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'vec_%'
      LIMIT 1
    `);

    if (vecVectorsInfo) {
      console.log(`✅ Vector extension tables found (sqlite-vec is in use)`);
      console.log(`   Note: Vector data is stored in ${vecVectorsInfo.name} and related tables`);
    } else {
      console.log('⚠️  WARNING: vec_vectors tables not found (sqlite-vec extension may not be loaded)');
    }

    // Sample vectors
    console.log('\nSample vectors (first 3):');
    const sampleVectors = await query<{ chunk_id: string; content: string }>(db, `
      SELECT chunk_id, content
      FROM vectors 
      LIMIT 3
    `);

    for (const vec of sampleVectors) {
      console.log(`  Chunk ID: ${vec.chunk_id}`);
      console.log(`  Content length: ${vec.content?.length || 0} chars`);
      if (vec.content) {
        console.log(`  Content preview: ${vec.content.substring(0, 100)}...`);
      }
      console.log();
    }

    // 5. Consistency checks
    console.log('🔍 CONSISTENCY CHECKS');
    console.log('-'.repeat(80));
    
    const orphanedEdges = await queryOne<{ count: number }>(db, `
      SELECT COUNT(*) as count 
      FROM edges e
      WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id = e.from_id)
         OR NOT EXISTS (SELECT 1 FROM nodes WHERE id = e.to_id)
    `);

    if (orphanedEdges && orphanedEdges.count > 0) {
      console.log(`⚠️  Found ${orphanedEdges.count} orphaned edges (referencing non-existent nodes)`);
    } else {
      console.log('✓ No orphaned edges');
    }

    const nodesNotInVectors = await queryOne<{ count: number }>(db, `
      SELECT COUNT(*) as count 
      FROM nodes n
      WHERE n.type IN ('chunk', 'code_chunk', 'doc_chunk', 'markdown_section', 'document_section')
        AND NOT EXISTS (SELECT 1 FROM vectors WHERE chunk_id = n.id)
    `);

    if (nodesNotInVectors && nodesNotInVectors.count > 0) {
      console.log(`⚠️  Found ${nodesNotInVectors.count} chunk nodes WITHOUT vector entries`);
    } else {
      console.log('✓ All chunk nodes have vector entries');
    }

    const vectorsNotInNodes = await queryOne<{ count: number }>(db, `
      SELECT COUNT(*) as count 
      FROM vectors v
      WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id = v.chunk_id)
    `);

    if (vectorsNotInNodes && vectorsNotInNodes.count > 0) {
      console.log(`⚠️  Found ${vectorsNotInNodes.count} vector entries WITHOUT corresponding nodes`);
    } else {
      console.log('✓ All vectors have corresponding nodes');
    }

    console.log();

    // 6. Query simulation
    console.log('🔎 QUERY SIMULATION');
    console.log('-'.repeat(80));
    console.log('Testing query: "authentication user login"');
    
    const testQuery = '%authentication%';
    const matchingChunks = await query<{ id: string; content: string }>(db, `
      SELECT n.id, v.content 
      FROM nodes n
      INNER JOIN vectors v ON v.chunk_id = n.id
      WHERE n.type IN ('chunk', 'code_chunk', 'doc_chunk', 'markdown_section', 'document_section')
        AND (v.content LIKE '${testQuery}' OR n.label LIKE '${testQuery}' OR n.id LIKE '${testQuery}')
      LIMIT 5
    `);

    console.log(`Found ${matchingChunks.length} matching chunks`);
    
    if (matchingChunks.length === 0) {
      console.log('❌ ERROR: No matches found for test query! Content may be missing or poorly indexed.');
    } else {
      console.log('✅ Query retrieval appears to work');
      console.log('\nSample matches:');
      for (const chunk of matchingChunks.slice(0, 2)) {
        console.log(`  ID: ${chunk.id}`);
        console.log(`  Content: ${chunk.content.substring(0, 100)}...`);
        console.log();
      }
    }

    console.log('='.repeat(80));
    console.log('DIAGNOSTICS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
  } finally {
    db.close();
  }
}

// Main
async function main() {
  const homeDir = os.homedir();
  const possiblePaths = [
    path.join(process.cwd(), '.cappy', 'data', 'graph-store.db'),
    path.join(homeDir, '.cappy', 'data', 'graph-store.db'),
    path.join(homeDir, '.cappy', 'graph-store.db'),
    path.join(homeDir, '.cappy', 'graph.db'),
    path.join(homeDir, '.cappy', 'cappy.db'),
    path.join(process.cwd(), '.cappy', 'graph-store.db'),
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

  await runDiagnostics(dbPath);
}

main().catch(console.error);
