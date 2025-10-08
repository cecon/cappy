const { CappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');

async function cleanOrphanedData() {
    const workspacePath = __dirname;
    const db = new CappyRAGLanceDatabase(workspacePath);
    
    try {
        await db.initialize();
        console.log('🧹 Starting orphaned data cleanup...\n');
        
        const result = await db.cleanOrphanedData();
        
        console.log('\n✅ Cleanup completed!');
        console.log('\n📊 Final Report:');
        console.log(`   • Deleted entities: ${result.deletedEntities}`);
        console.log(`   • Deleted chunks: ${result.deletedChunks}`);
        console.log(`   • Remaining entities: ${result.remainingEntities}`);
        console.log(`   • Remaining chunks: ${result.remainingChunks}`);
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

cleanOrphanedData();