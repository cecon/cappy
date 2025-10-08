/**
 * Script to inspect a specific chunk and find orphaned data
 * Run with: node inspect-chunk.js
 */

const vscode = require('vscode');

async function inspectChunk() {
    const chunkId = 'chunk_1759640305988_x6fsl42jv';
    
    console.log(`\n🔍 Inspecting chunk: ${chunkId}\n`);

    try {
        // Get database statistics
        const stats = await vscode.commands.executeCommand('cappyrag.getStats');
        
        if (stats) {
            console.log('📊 Current Database Stats:');
            console.log(`   Total Documents: ${stats.documents || 0}`);
            console.log(`   Total Entities: ${stats.entities || 0}`);
            console.log(`   Total Relationships: ${stats.relationships || 0}`);
            console.log(`   Total Chunks: ${stats.chunks || 0}`);
        }

        console.log(`\n🧹 Running cleanup to remove orphaned data...\n`);

        // Run cleanup command
        await vscode.commands.executeCommand('cappy.CappyRAG.cleanOrphanedData');

        // Get updated stats
        const updatedStats = await vscode.commands.executeCommand('cappyrag.getStats');
        
        if (updatedStats) {
            console.log('\n📊 After Cleanup:');
            console.log(`   Total Documents: ${updatedStats.documents || 0}`);
            console.log(`   Total Entities: ${updatedStats.entities || 0}`);
            console.log(`   Total Relationships: ${updatedStats.relationships || 0}`);
            console.log(`   Total Chunks: ${updatedStats.chunks || 0}`);
            
            const chunksRemoved = (stats.chunks || 0) - (updatedStats.chunks || 0);
            const entitiesRemoved = (stats.entities || 0) - (updatedStats.entities || 0);
            
            console.log('\n✅ Cleanup Results:');
            console.log(`   Chunks removed: ${chunksRemoved}`);
            console.log(`   Entities removed: ${entitiesRemoved}`);
        }

    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error(error.stack);
    }
}

// Run inspection
inspectChunk().then(() => {
    console.log('\n✅ Inspection completed!');
}).catch(error => {
    console.error('\n❌ Inspection failed:', error);
});
