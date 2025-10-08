const { CappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');
const path = require('path');

async function listChunks() {
    const dbPath = path.join(__dirname, '.cappy', 'cappyrag.db');
    const db = new CappyRAGLanceDatabase(dbPath);
    
    try {
        await db.initialize();
        console.log('🔍 Listing all chunks in database...\n');
        
        const chunks = await db.getChunksAsync();
        console.log(`📊 Total chunks found: ${chunks.length}\n`);
        
        if (chunks.length === 0) {
            console.log('❌ No chunks found in database!');
            return;
        }
        
        // List first 20 chunks with details
        const chunksToShow = chunks.slice(0, 20);
        chunksToShow.forEach((chunk, idx) => {
            console.log(`${idx + 1}. ID: ${chunk.id}`);
            console.log(`   📄 Document: ${chunk.documentId}`);
            console.log(`   📝 Index: ${chunk.chunkIndex}`);
            console.log(`   📏 Content: ${chunk.content.substring(0, 60)}...`);
            
            // Handle entities
            let entities = [];
            if (chunk.entities) {
                if (Array.isArray(chunk.entities)) {
                    entities = chunk.entities;
                } else if (typeof chunk.entities.toArray === 'function') {
                    entities = chunk.entities.toArray();
                } else if (typeof chunk.entities === 'object' && chunk.entities.length !== undefined) {
                    entities = Array.from({ length: chunk.entities.length }, (_, i) => chunk.entities[i]);
                }
            }
            
            // Handle relationships
            let relationships = [];
            if (chunk.relationships) {
                if (Array.isArray(chunk.relationships)) {
                    relationships = chunk.relationships;
                } else if (typeof chunk.relationships.toArray === 'function') {
                    relationships = chunk.relationships.toArray();
                } else if (typeof chunk.relationships === 'object' && chunk.relationships.length !== undefined) {
                    relationships = Array.from({ length: chunk.relationships.length }, (_, i) => chunk.relationships[i]);
                }
            }
            
            console.log(`   🏷️ Entities: ${entities.length} (${entities.slice(0, 3).join(', ')}${entities.length > 3 ? '...' : ''})`);
            console.log(`   🔗 Relationships: ${relationships.length}`);
            console.log('');
        });
        
        if (chunks.length > 20) {
            console.log(`... and ${chunks.length - 20} more chunks`);
        }
        
        // Search for chunks that might match the pattern
        console.log('\n🔍 Searching for chunks with similar ID pattern...');
        const pattern = /chunk_\d+_\w+/;
        const matchingChunks = chunks.filter(c => pattern.test(c.id));
        
        console.log(`📋 Found ${matchingChunks.length} chunks with similar pattern:`);
        matchingChunks.slice(0, 10).forEach((chunk, idx) => {
            console.log(`   ${idx + 1}. ${chunk.id}`);
        });
        
    } catch (error) {
        console.error('❌ Error listing chunks:', error);
    }
}

listChunks();