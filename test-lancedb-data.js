/**
 * Test script to check LanceDB data
 * Run with: node test-lancedb-data.js
 */

const { connect } = require('@lancedb/lancedb');
const path = require('path');

async function checkData() {
    try {
        const dbPath = path.join(__dirname, '.cappy', 'lightrag-lancedb');
        console.log(`\n📂 Connecting to: ${dbPath}\n`);
        
        const db = await connect(dbPath);
        
        // Check Documents
        console.log('📄 DOCUMENTS:');
        const docsTable = await db.openTable('documents');
        const docs = await docsTable.query().limit(10).toArray();
        console.log(`   Total documents: ${docs.length}`);
        if (docs.length > 0) {
            console.log('   Sample:', JSON.stringify(docs[0], null, 2).substring(0, 300) + '...');
        }
        
        // Check Entities
        console.log('\n🏷️  ENTITIES:');
        const entitiesTable = await db.openTable('entities');
        const entities = await entitiesTable.query().limit(10).toArray();
        console.log(`   Total entities: ${entities.length}`);
        if (entities.length > 0) {
            console.log('   Sample:', JSON.stringify(entities[0], null, 2).substring(0, 300) + '...');
        }
        
        // Check Relationships
        console.log('\n🔗 RELATIONSHIPS:');
        const relsTable = await db.openTable('relationships');
        const rels = await relsTable.query().limit(10).toArray();
        console.log(`   Total relationships: ${rels.length}`);
        if (rels.length > 0) {
            console.log('   Sample:', JSON.stringify(rels[0], null, 2).substring(0, 300) + '...');
        }
        
        // Check Chunks
        console.log('\n📦 CHUNKS:');
        const chunksTable = await db.openTable('chunks');
        const chunks = await chunksTable.query().limit(10).toArray();
        console.log(`   Total chunks: ${chunks.length}`);
        if (chunks.length > 0) {
            console.log('   Sample:', JSON.stringify(chunks[0], null, 2).substring(0, 300) + '...');
        }
        
        console.log('\n✅ Database check complete!\n');
        
    } catch (error) {
        console.error('❌ Error checking database:', error.message);
        console.error(error);
    }
}

checkData();
