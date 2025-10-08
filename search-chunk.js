const { CappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');
const path = require('path');

async function searchSpecificChunk() {
    const workspacePath = __dirname;
    const db = new CappyRAGLanceDatabase(workspacePath);
    
    try {
        await db.initialize();
        console.log('🔍 Searching for chunk_1759640439943_03u8899q0...\n');
        
        const chunks = await db.getChunksAsync();
        console.log(`📊 Total chunks in database: ${chunks.length}\n`);
        
        // Search for the specific chunk
        const targetChunk = chunks.find(c => c.id === 'chunk_1759640439943_03u8899q0');
        
        if (!targetChunk) {
            console.log('❌ Chunk chunk_1759640439943_03u8899q0 not found!');
            
            // Search for similar chunks
            console.log('\n🔍 Searching for chunks with similar timestamp (1759640439943)...');
            const similarChunks = chunks.filter(c => c.id.includes('1759640439943'));
            
            if (similarChunks.length > 0) {
                console.log(`   Found ${similarChunks.length} similar chunks:`);
                similarChunks.forEach((chunk, idx) => {
                    console.log(`   ${idx + 1}. ${chunk.id}`);
                    console.log(`      Document: ${chunk.documentId}`);
                    console.log(`      Content: ${chunk.content.substring(0, 100)}...`);
                });
            } else {
                console.log('   No chunks found with similar timestamp');
            }
            
            // Show some example chunk IDs
            console.log('\n📋 Sample chunk IDs in database:');
            chunks.slice(0, 10).forEach((chunk, idx) => {
                console.log(`   ${idx + 1}. ${chunk.id}`);
            });
            
            return;
        }
        
        console.log('✅ Found the chunk!\n');
        
        // Analyze the chunk
        console.log('📋 Chunk Details:');
        console.log(`   ID: ${targetChunk.id}`);
        console.log(`   Document: ${targetChunk.documentId}`);
        console.log(`   Index: ${targetChunk.chunkIndex}`);
        console.log(`   Content: ${targetChunk.content.substring(0, 200)}...`);
        console.log(`   Content length: ${targetChunk.content.length}`);
        console.log(`   Start/End: ${targetChunk.startPosition}-${targetChunk.endPosition}`);
        console.log(`   Lines: ${targetChunk.startLine || 'N/A'} - ${targetChunk.endLine || 'N/A'}`);
        
        // Handle entities
        let entities = [];
        if (targetChunk.entities) {
            if (Array.isArray(targetChunk.entities)) {
                entities = targetChunk.entities;
            } else if (typeof targetChunk.entities.toArray === 'function') {
                entities = targetChunk.entities.toArray();
            } else if (typeof targetChunk.entities === 'object' && targetChunk.entities.length !== undefined) {
                entities = Array.from({ length: targetChunk.entities.length }, (_, i) => targetChunk.entities[i]);
            }
        }
        
        // Handle relationships
        let relationships = [];
        if (targetChunk.relationships) {
            if (Array.isArray(targetChunk.relationships)) {
                relationships = targetChunk.relationships;
            } else if (typeof targetChunk.relationships.toArray === 'function') {
                relationships = targetChunk.relationships.toArray();
            } else if (typeof targetChunk.relationships === 'object' && targetChunk.relationships.length !== undefined) {
                relationships = Array.from({ length: targetChunk.relationships.length }, (_, i) => targetChunk.relationships[i]);
            }
        }
        
        console.log(`\n🏷️ Entities (${entities.length}):`);
        if (entities.length === 0) {
            console.log('   ❌ No entities linked to this chunk');
        } else {
            entities.forEach((entityId, idx) => {
                console.log(`   ${idx + 1}. ${entityId}`);
            });
        }
        
        console.log(`\n🔗 Relationships (${relationships.length}):`);
        if (relationships.length === 0) {
            console.log('   ❌ No relationships linked to this chunk');
        } else {
            relationships.forEach((relId, idx) => {
                console.log(`   ${idx + 1}. ${relId}`);
            });
        }
        
        // Check if entities exist
        if (entities.length > 0) {
            console.log('\n🔍 Verifying entities exist in database:');
            const allEntities = await db.getEntitiesAsync();
            entities.forEach((entityId, idx) => {
                const entityExists = allEntities.find(e => e.id === entityId);
                if (entityExists) {
                    console.log(`   ✅ ${idx + 1}. ${entityExists.name} (${entityExists.type})`);
                } else {
                    console.log(`   ❌ ${idx + 1}. ${entityId} - NOT FOUND`);
                }
            });
        }
        
        // Check relationships involving this chunk
        console.log('\n🔍 Checking relationships that reference this chunk:');
        const allRels = await db.getRelationshipsAsync();
        const chunkRels = allRels.filter(rel => {
            // Check sourceChunks
            let sourceChunks = [];
            if (rel.sourceChunks) {
                if (Array.isArray(rel.sourceChunks)) {
                    sourceChunks = rel.sourceChunks;
                } else if (typeof rel.sourceChunks.toArray === 'function') {
                    sourceChunks = rel.sourceChunks.toArray();
                } else if (typeof rel.sourceChunks === 'object' && rel.sourceChunks.length !== undefined) {
                    sourceChunks = Array.from({ length: rel.sourceChunks.length }, (_, i) => rel.sourceChunks[i]);
                }
            }
            return sourceChunks.includes(targetChunk.id);
        });
        
        if (chunkRels.length === 0) {
            console.log('   ❌ No relationships reference this chunk in their sourceChunks');
        } else {
            console.log(`   ✅ Found ${chunkRels.length} relationships that reference this chunk:`);
            chunkRels.forEach((rel, idx) => {
                console.log(`   ${idx + 1}. ${rel.source} → ${rel.target} (${rel.type})`);
            });
        }
        
        console.log('\n📊 Summary:');
        console.log(`   • Chunk exists: ✅`);
        console.log(`   • Has entity references: ${entities.length > 0 ? '✅' : '❌'} (${entities.length})`);
        console.log(`   • Has relationship references: ${relationships.length > 0 ? '✅' : '❌'} (${relationships.length})`);
        console.log(`   • Referenced by relationships: ${chunkRels.length > 0 ? '✅' : '❌'} (${chunkRels.length})`);
        
        const shouldShowConnections = entities.length > 0 || chunkRels.length > 0;
        console.log(`   • Should show connections in graph: ${shouldShowConnections ? '✅ YES' : '❌ NO'}`);
        
    } catch (error) {
        console.error('❌ Error searching chunk:', error);
    }
}

searchSpecificChunk();