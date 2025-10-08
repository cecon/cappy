const { CappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');

async function checkMultipleChunks() {
    const workspacePath = __dirname;
    const db = new CappyRAGLanceDatabase(workspacePath);
    
    // Lista de chunks para verificar
    const targetChunks = [
        'chunk_1759640439943_03u8899q0', // já corrigido
        'chunk_1759640348637_cs9mmkck0',
        'chunk_1759640326470_ha51dq1ob'
    ];
    
    try {
        await db.initialize();
        console.log('[CappyRAG LanceDB] Initialized successfully\n');
        
        // Get all chunks and entities for validation
        const chunks = await db.getChunksAsync();
        const entities = await db.getEntitiesAsync();
        
        console.log(`📊 Total chunks in database: ${chunks.length}`);
        console.log(`📊 Total entities in database: ${entities.length}\n`);
        
        // Check each target chunk
        for (const chunkId of targetChunks) {
            console.log(`🔍 Checking ${chunkId}:`);
            
            const chunk = chunks.find(c => c.id === chunkId);
            if (!chunk) {
                console.log(`   ❌ Chunk not found\n`);
                continue;
            }
            
            console.log(`   ✅ Found chunk`);
            console.log(`   📋 Entity references: ${chunk.entities?.length || 0}`);
            console.log(`   📋 Relationship references: ${chunk.relationships?.length || 0}`);
            
            // Validate entity references
            if (chunk.entities && chunk.entities.length > 0) {
                let validEntities = 0;
                let invalidEntities = 0;
                
                for (const entityId of chunk.entities) {
                    const entityExists = entities.some(e => e.id === entityId);
                    if (entityExists) {
                        validEntities++;
                    } else {
                        invalidEntities++;
                    }
                }
                
                console.log(`   ✅ Valid entity refs: ${validEntities}`);
                console.log(`   ❌ Invalid entity refs: ${invalidEntities}`);
                
                if (invalidEntities > 0) {
                    console.log(`   🚨 PROBLEMATIC CHUNK - needs cleanup`);
                }
            }
            
            console.log(''); // blank line
        }
        
        // Summary
        console.log('📊 Summary:');
        console.log('   - chunk_1759640439943_03u8899q0: Already cleaned');
        console.log('   - chunk_1759640348637_cs9mmkck0: Check results above');
        console.log('   - chunk_1759640326470_ha51dq1ob: Check results above');
        
    } catch (error) {
        console.error('❌ Error checking chunks:', error);
    }
}

checkMultipleChunks();