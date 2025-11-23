/**
 * Test script to verify vector database retrieval is working
 */

const path = require('path');
const sqlite3 = require('sqlite3');

const workspaceRoot = path.resolve(__dirname, '..');
const dbPath = path.join(workspaceRoot, '.cappy', 'data', 'graph-store.db');

console.log('🔍 Testing Vector Database Retrieval');
console.log('=====================================\n');
console.log(`Database path: ${dbPath}\n`);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Check if database exists and has tables
  console.log('📊 Database Tables:');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  tables.forEach((table: any) => {
    console.log(`  - ${table.name}`);
  });
  console.log('');
  
  // Check vector embeddings table
  console.log('📦 Embeddings Statistics:');
  const embeddingsCount = db.prepare(`
    SELECT COUNT(*) as count FROM embeddings
  `).get() as any;
  console.log(`  Total embeddings: ${embeddingsCount.count}`);
  
  if (embeddingsCount.count > 0) {
    // Get sample embeddings
    console.log('\n📝 Sample Embeddings (first 5):');
    const samples = db.prepare(`
      SELECT id, source, content_preview, metadata
      FROM embeddings
      LIMIT 5
    `).all();
    
    samples.forEach((sample: any, i: number) => {
      console.log(`\n  ${i + 1}. Source: ${sample.source}`);
      console.log(`     Preview: ${sample.content_preview?.substring(0, 100)}...`);
      console.log(`     Metadata: ${sample.metadata}`);
    });
    
    // Check if we have chat-related content
    console.log('\n\n🔍 Searching for "chat" related content:');
    const chatResults = db.prepare(`
      SELECT id, source, content_preview, metadata
      FROM embeddings
      WHERE content_preview LIKE '%chat%' 
         OR source LIKE '%chat%'
         OR metadata LIKE '%chat%'
      LIMIT 10
    `).all();
    
    if (chatResults.length > 0) {
      console.log(`  ✅ Found ${chatResults.length} results:`);
      chatResults.forEach((result: any, i: number) => {
        console.log(`\n  ${i + 1}. ${result.source}`);
        console.log(`     ${result.content_preview?.substring(0, 150)}...`);
      });
    } else {
      console.log('  ❌ No chat-related content found');
    }
    
    // Check vector extension
    console.log('\n\n🔧 Checking vec0 extension:');
    try {
      const vecInfo = db.prepare(`SELECT vec_version()`).get() as any;
      console.log(`  ✅ sqlite-vec version: ${Object.values(vecInfo)[0]}`);
      
      // Check if embeddings have vectors
      const vecCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM embeddings 
        WHERE embedding IS NOT NULL
      `).get() as any;
      console.log(`  Embeddings with vectors: ${vecCount.count}/${embeddingsCount.count}`);
      
    } catch (error) {
      console.log('  ⚠️  vec0 extension not loaded or not working');
    }
    
    // Try a semantic search if vec0 is available
    console.log('\n\n🧪 Testing semantic search for "chat application":');
    try {
      // This would require generating an embedding for the query
      // For now, just check if the table structure supports it
      const schema = db.prepare(`
        PRAGMA table_info(embeddings)
      `).all();
      
      console.log('  Embeddings table schema:');
      schema.forEach((col: any) => {
        console.log(`    - ${col.name} (${col.type})`);
      });
      
    } catch (error) {
      console.log('  ⚠️  Could not inspect schema:', error);
    }
    
  } else {
    console.log('  ⚠️  No embeddings found in database');
    console.log('\n💡 Possible reasons:');
    console.log('  1. Project has not been scanned yet (run cappy.scan command)');
    console.log('  2. Database was cleared');
    console.log('  3. Indexing failed during scan');
  }
  
  db.close();
  console.log('\n✅ Diagnostic complete');
  
} catch (error) {
  console.error('❌ Error accessing database:', error);
  console.log('\n💡 Make sure:');
  console.log('  1. Database file exists at:', dbPath);
  console.log('  2. You have read permissions');
  console.log('  3. Cappy has been initialized (run cappy.init)');
}
