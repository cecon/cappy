/**
 * Script para buscar e deletar um chunk específico
 */

const path = require('path');
const fs = require('fs');

async function findAndDeleteChunk() {
    const targetChunkId = 'chunk_1759640339661_ujkt1ailh';
    
    console.log(`🔍 Buscando chunk específico: ${targetChunkId}\n`);
    console.log('='.repeat(80));
    
    try {
        const lancedb = require('@lancedb/lancedb');
        const workspacePath = process.cwd();
        const dbPath = path.join(workspacePath, '.cappy', 'cappyrag-data');
        
        console.log(`📁 Database: ${dbPath}\n`);
        
        if (!fs.existsSync(dbPath)) {
            console.error('❌ Banco não encontrado');
            return;
        }
        
        // Conectar
        console.log('🔌 Conectando ao LanceDB...');
        const db = await lancedb.connect(dbPath);
        const chunksTable = await db.openTable('chunks');
        
        // Buscar TODOS os chunks
        console.log('📊 Buscando todos os chunks...');
        const allChunks = await chunksTable.query().limit(100000).toArray();
        console.log(`   Total no banco: ${allChunks.length}\n`);
        
        // Listar os IDs dos primeiros 20 chunks
        console.log('📋 IDs dos chunks no banco:');
        allChunks.slice(0, 20).forEach((chunk, idx) => {
            console.log(`   ${idx + 1}. ${chunk.id}`);
        });
        if (allChunks.length > 20) {
            console.log(`   ... e mais ${allChunks.length - 20} chunks\n`);
        }
        
        // Buscar o chunk específico
        const targetChunk = allChunks.find(c => c.id === targetChunkId);
        
        if (!targetChunk) {
            console.log(`\n❌ Chunk ${targetChunkId} NÃO ENCONTRADO no banco!`);
            console.log('\nPossíveis razões:');
            console.log('1. O chunk já foi deletado anteriormente');
            console.log('2. O ID está incorreto');
            console.log('3. O chunk está em outro banco/workspace');
            
            // Buscar chunks similares
            const similarChunks = allChunks.filter(c => 
                c.id.includes('1759640339661') || c.id.includes('ujkt1ailh')
            );
            
            if (similarChunks.length > 0) {
                console.log('\n🔍 Chunks similares encontrados:');
                similarChunks.forEach(chunk => {
                    console.log(`   - ${chunk.id}`);
                });
            }
            
            return;
        }
        
        // Chunk encontrado - mostrar detalhes
        console.log('\n✅ CHUNK ENCONTRADO!');
        console.log('='.repeat(80));
        console.log(`ID: ${targetChunk.id}`);
        console.log(`Document ID: ${targetChunk.documentId}`);
        console.log(`Chunk Index: ${targetChunk.chunkIndex}`);
        console.log(`Created: ${targetChunk.created}`);
        console.log(`Entities: ${targetChunk.entities?.length || 0}`);
        console.log(`Relationships: ${targetChunk.relationships?.length || 0}`);
        console.log(`Content (preview): ${(targetChunk.content || '').substring(0, 100)}...`);
        console.log('='.repeat(80));
        
        // Verificar se é órfão
        const isOrphan = (!targetChunk.entities || targetChunk.entities.length === 0) &&
                        (!targetChunk.relationships || targetChunk.relationships.length === 0);
        
        if (isOrphan) {
            console.log('\n❌ STATUS: CHUNK ÓRFÃO (será deletado)');
        } else {
            console.log('\n✅ STATUS: CHUNK VÁLIDO');
            console.log('\nMotivo para NÃO deletar:');
            if (targetChunk.entities?.length > 0) {
                console.log(`   - Tem ${targetChunk.entities.length} entidades:`);
                targetChunk.entities.forEach(entityId => {
                    console.log(`     • ${entityId}`);
                });
            }
            if (targetChunk.relationships?.length > 0) {
                console.log(`   - Tem ${targetChunk.relationships.length} relacionamentos:`);
                targetChunk.relationships.forEach(relId => {
                    console.log(`     • ${relId}`);
                });
            }
        }
        
        // Perguntar se quer deletar mesmo assim
        console.log('\n🔥 DELETANDO O CHUNK (forçado)...');
        await chunksTable.delete(`id = '${targetChunkId}'`);
        console.log('✅ Chunk deletado com sucesso!');
        
        // Verificar
        const afterDelete = await chunksTable.query().limit(100000).toArray();
        const stillExists = afterDelete.find(c => c.id === targetChunkId);
        
        if (stillExists) {
            console.log('\n⚠️  ATENÇÃO: Chunk ainda existe no banco!');
        } else {
            console.log('\n✅ CONFIRMADO: Chunk removido do banco!');
            console.log(`   Chunks restantes: ${afterDelete.length}`);
        }
        
    } catch (error) {
        console.error('\n❌ ERRO:', error);
        console.error(error.stack);
    }
}

findAndDeleteChunk().then(() => {
    console.log('\n✅ Script finalizado!');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Script falhou:', error);
    process.exit(1);
});
