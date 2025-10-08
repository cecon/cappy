const { CappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');
const path = require('path');

async function inspectDatabase() {
    // Use workspace path, not direct db path
    const workspacePath = __dirname;
    const db = new CappyRAGLanceDatabase(workspacePath);
    
    try {
        await db.initialize();
        console.log('🔍 Inspecting CappyRAG database...\n');
        
        // Check documents
        const documents = await db.getDocumentsAsync();
        console.log(`📄 Documents: ${documents.length}`);
        documents.slice(0, 5).forEach((doc, idx) => {
            console.log(`   ${idx + 1}. ${doc.title || doc.fileName} (${doc.id})`);
            console.log(`      Status: ${doc.status}, Size: ${doc.fileSize} bytes`);
        });
        console.log('');
        
        // Check entities
        const entities = await db.getEntitiesAsync();
        console.log(`🏷️ Entities: ${entities.length}`);
        entities.slice(0, 5).forEach((entity, idx) => {
            console.log(`   ${idx + 1}. ${entity.name} (${entity.id})`);
            console.log(`      Type: ${entity.type}, Description: ${entity.description || 'N/A'}`);
        });
        console.log('');
        
        // Check relationships
        const relationships = await db.getRelationshipsAsync();
        console.log(`🔗 Relationships: ${relationships.length}`);
        relationships.slice(0, 5).forEach((rel, idx) => {
            console.log(`   ${idx + 1}. ${rel.source} → ${rel.target}`);
            console.log(`      Type: ${rel.type}, Weight: ${rel.weight || 'N/A'}`);
        });
        console.log('');
        
        // Check chunks
        const chunks = await db.getChunksAsync();
        console.log(`🧩 Chunks: ${chunks.length}`);
        chunks.slice(0, 5).forEach((chunk, idx) => {
            console.log(`   ${idx + 1}. ${chunk.id}`);
            console.log(`      Document: ${chunk.documentId}, Index: ${chunk.chunkIndex}`);
        });
        
        // Summary
        console.log('\n📋 Database Summary:');
        console.log(`   • Documents: ${documents.length}`);
        console.log(`   • Entities: ${entities.length}`);
        console.log(`   • Relationships: ${relationships.length}`);
        console.log(`   • Chunks: ${chunks.length}`);
        
        if (chunks.length === 0 && documents.length > 0) {
            console.log('\n⚠️  Documents exist but no chunks found!');
            console.log('   This suggests documents were not processed into chunks yet.');
            console.log('   Try re-indexing or processing the documents.');
        }
        
    } catch (error) {
        console.error('❌ Error inspecting database:', error);
    }
}

inspectDatabase();