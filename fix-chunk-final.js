const { CappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');

async function cleanChunkReferences() {
    const workspacePath = __dirname;
    const db = new CappyRAGLanceDatabase(workspacePath);
    const targetChunkId = 'chunk_1759640439943_03u8899q0';
    
    try {
        await db.initialize();
        console.log('[CappyRAG LanceDB] Initialized successfully');
        
        // 1. Get all chunks and find the target
        const chunks = await db.getChunksAsync();
        const targetChunk = chunks.find(c => c.id === targetChunkId);
        
        if (!targetChunk) {
            console.log(`❌ Chunk ${targetChunkId} not found`);
            return;
        }
        
        console.log(`✅ Found chunk ${targetChunkId}`);
        console.log(`📋 Current entities: ${targetChunk.entities?.length || 0}`);
        console.log(`📋 Current relationships: ${targetChunk.relationships?.length || 0}`);
        
        // 2. Access the chunks table directly for low-level operations
        const chunksTable = db.chunksTable;
        if (!chunksTable) {
            console.log('❌ Chunks table not accessible');
            return;
        }
        
        // 3. Delete the chunk
        await chunksTable.delete(`id = '${targetChunkId}'`);
        console.log('🗑️ Deleted chunk from table');
        
        // 4. Create clean chunk data (preserving all original fields)
        const cleanedChunk = {
            ...targetChunk,
            entities: [],
            relationships: []
        };
        
        // 5. Re-insert the clean chunk
        await chunksTable.add([cleanedChunk]);
        console.log('📝 Re-inserted clean chunk');
        
        console.log('\n✅ Chunk references cleaned!');
        console.log('📋 New entities: 0');
        console.log('📋 New relationships: 0');
        
        // 6. Verify by getting chunks again
        const verifyChunks = await db.getChunksAsync();
        const verifiedChunk = verifyChunks.find(c => c.id === targetChunkId);
        
        console.log('\n🔍 Verification:');
        console.log(`   Entities: ${verifiedChunk?.entities?.length || 0}`);
        console.log(`   Relationships: ${verifiedChunk?.relationships?.length || 0}`);
        
    } catch (error) {
        console.error('❌ Error cleaning chunk references:', error);
        console.error('Full error:', error.stack);
    }
}

cleanChunkReferences();