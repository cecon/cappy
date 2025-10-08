/**
 * FORÇA a deleção de chunks específicos (mesmo que não sejam órfãos)
 * ⚠️  CUIDADO: Isto pode quebrar o grafo de conhecimento!
 */

const path = require('path');
const fs = require('fs');

async function forceDeleteChunk() {
    const targetChunkIds = [
        'chunk_1759640339661_ujkt1ailh',
        'chunk_1759640305988_x6fsl42jv'
    ];
    
    console.log('⚠️  DELEÇÃO FORÇADA DE CHUNKS\n');
    console.log('='.repeat(80));
    
    try {
        const lancedb = require('@lancedb/lancedb');
        const workspacePath = process.cwd();
        const dbPath = path.join(workspacePath, '.cappy', 'cappyrag-data');
        
        const db = await lancedb.connect(dbPath);
        const chunksTable = await db.openTable('chunks');
        
        for (const chunkId of targetChunkIds) {
            console.log(`\n🔥 Deletando: ${chunkId}`);
            try {
                await chunksTable.delete(`id = '${chunkId}'`);
                console.log(`   ✅ Deletado`);
            } catch (error) {
                console.log(`   ❌ Erro: ${error.message}`);
            }
        }
        
        console.log('\n✅ Deleção forçada concluída!');
        
    } catch (error) {
        console.error('\n❌ ERRO:', error);
    }
}

forceDeleteChunk().then(() => process.exit(0));
