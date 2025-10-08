const { CappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');

async function cleanAllOrphanedChunks() {
    const workspacePath = __dirname;
    const db = new CappyRAGLanceDatabase(workspacePath);
    
    try {
        await db.initialize();
        console.log('[CappyRAG LanceDB] Initialized successfully\n');
        
        // Get all chunks and entities for validation
        const chunks = await db.getChunksAsync();
        const entities = await db.getEntitiesAsync();
        const relationships = await db.getRelationshipsAsync();
        
        console.log(`📊 Total chunks: ${chunks.length}`);
        console.log(`📊 Total entities: ${entities.length}`);
        console.log(`📊 Total relationships: ${relationships.length}\n`);
        
        // Phase 1: Identify problematic chunks
        const problematicChunks = [];
        
        console.log('🔍 Phase 1: Scanning all chunks for invalid references...\n');
        
        for (const chunk of chunks) {
            let invalidEntityRefs = 0;
            let invalidRelRefs = 0;
            
            // Check entity references
            if (chunk.entities && chunk.entities.length > 0) {
                for (const entityId of chunk.entities) {
                    const entityExists = entities.some(e => e.id === entityId);
                    if (!entityExists) {
                        invalidEntityRefs++;
                    }
                }
            }
            
            // Check relationship references
            if (chunk.relationships && chunk.relationships.length > 0) {
                for (const relId of chunk.relationships) {
                    const relExists = relationships.some(r => r.id === relId);
                    if (!relExists) {
                        invalidRelRefs++;
                    }
                }
            }
            
            // If chunk has invalid references, mark for cleanup
            if (invalidEntityRefs > 0 || invalidRelRefs > 0) {
                problematicChunks.push({
                    id: chunk.id,
                    chunk: chunk,
                    invalidEntityRefs,
                    invalidRelRefs,
                    totalEntityRefs: chunk.entities?.length || 0,
                    totalRelRefs: chunk.relationships?.length || 0
                });
                
                console.log(`🚨 ${chunk.id}:`);
                console.log(`   Entity refs: ${invalidEntityRefs}/${chunk.entities?.length || 0} invalid`);
                console.log(`   Relationship refs: ${invalidRelRefs}/${chunk.relationships?.length || 0} invalid`);
            }
        }
        
        console.log(`\n📊 Found ${problematicChunks.length} problematic chunks\n`);
        
        if (problematicChunks.length === 0) {
            console.log('✅ No problematic chunks found - all data is clean!');
            return;
        }
        
        // Phase 2: Clean all problematic chunks
        console.log('🧹 Phase 2: Cleaning all problematic chunks...\n');
        
        const chunksTable = db.chunksTable;
        if (!chunksTable) {
            console.log('❌ Cannot access chunks table');
            return;
        }
        
        let cleanedCount = 0;
        
        for (const problematic of problematicChunks) {
            try {
                // Delete the chunk
                await chunksTable.delete(`id = '${problematic.id}'`);
                
                // Create clean chunk data
                const cleanedChunk = {
                    ...problematic.chunk,
                    entities: [],
                    relationships: []
                };
                
                // Re-insert the clean chunk
                await chunksTable.add([cleanedChunk]);
                
                console.log(`✅ Cleaned ${problematic.id}`);
                cleanedCount++;
                
            } catch (error) {
                console.error(`❌ Failed to clean ${problematic.id}:`, error.message);
            }
        }
        
        console.log(`\n🎉 Successfully cleaned ${cleanedCount}/${problematicChunks.length} chunks`);
        
        // Phase 3: Verification
        console.log('\n🔍 Phase 3: Verification...\n');
        
        const verifyChunks = await db.getChunksAsync();
        let verifyProblematic = 0;
        
        for (const chunk of verifyChunks) {
            let hasInvalidRefs = false;
            
            if (chunk.entities && chunk.entities.length > 0) {
                for (const entityId of chunk.entities) {
                    const entityExists = entities.some(e => e.id === entityId);
                    if (!entityExists) {
                        hasInvalidRefs = true;
                        break;
                    }
                }
            }
            
            if (!hasInvalidRefs && chunk.relationships && chunk.relationships.length > 0) {
                for (const relId of chunk.relationships) {
                    const relExists = relationships.some(r => r.id === relId);
                    if (!relExists) {
                        hasInvalidRefs = true;
                        break;
                    }
                }
            }
            
            if (hasInvalidRefs) {
                verifyProblematic++;
            }
        }
        
        console.log(`📊 Verification results:`);
        console.log(`   Total chunks: ${verifyChunks.length}`);
        console.log(`   Problematic chunks remaining: ${verifyProblematic}`);
        
        if (verifyProblematic === 0) {
            console.log('✅ All chunks are now clean! Graph should show proper connections.');
        } else {
            console.log('⚠️ Some problematic chunks remain - may need manual investigation.');
        }
        
    } catch (error) {
        console.error('❌ Error during bulk cleanup:', error);
    }
}

cleanAllOrphanedChunks();