/**
 * Script para verificar se um chunk específico está órfão
 * Verifica: chunk_1759640339661_ujkt1ailh
 */

const vscode = require('vscode');

async function checkIfOrphan() {
    const chunkId = 'chunk_1759640339661_ujkt1ailh';
    
    console.log(`\n🔍 Verificando se o chunk está órfão: ${chunkId}\n`);

    try {
        // Importar o módulo do banco de dados
        const path = require('path');
        const dbPath = path.join(__dirname, 'out', 'store', 'cappyragLanceDb.js');
        const { getCappyRAGLanceDatabase } = require(dbPath);

        // Obter workspace path
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.error('❌ Nenhum workspace aberto');
            return;
        }

        const db = getCappyRAGLanceDatabase(workspaceFolders[0].uri.fsPath);
        await db.initialize();

        console.log('📊 Buscando chunk no banco de dados...\n');

        // Buscar o chunk específico
        const allChunks = await db.getChunksAsync();
        const chunk = allChunks.find(c => c.id === chunkId);

        if (!chunk) {
            console.log('❌ Chunk não encontrado no banco de dados!');
            console.log(`   ID procurado: ${chunkId}`);
            console.log(`   Total de chunks no banco: ${allChunks.length}`);
            return;
        }

        console.log('✅ Chunk encontrado!');
        console.log('='.repeat(80));
        console.log(`ID: ${chunk.id}`);
        console.log(`Document ID: ${chunk.documentId}`);
        console.log(`Chunk Index: ${chunk.chunkIndex}`);
        console.log(`Created: ${chunk.created}`);
        console.log(`Content Preview: ${(chunk.content || '').substring(0, 100)}...`);
        console.log('='.repeat(80));

        // Verificar entidades
        const hasEntities = chunk.entities && chunk.entities.length > 0;
        console.log(`\n📦 Entidades: ${hasEntities ? chunk.entities.length : 0}`);
        if (hasEntities) {
            console.log(`   IDs: ${chunk.entities.join(', ')}`);
        } else {
            console.log('   ❌ NENHUMA ENTIDADE');
        }

        // Verificar relacionamentos
        const hasRelationships = chunk.relationships && chunk.relationships.length > 0;
        console.log(`\n🔗 Relacionamentos: ${hasRelationships ? chunk.relationships.length : 0}`);
        if (hasRelationships) {
            console.log(`   IDs: ${chunk.relationships.join(', ')}`);
        } else {
            console.log('   ❌ NENHUM RELACIONAMENTO');
        }

        // Determinar se está órfão
        const isOrphan = !hasEntities && !hasRelationships;
        
        console.log('\n' + '='.repeat(80));
        if (isOrphan) {
            console.log('❌ STATUS: CHUNK ÓRFÃO');
            console.log('='.repeat(80));
            console.log('\n📌 Este chunk será REMOVIDO pelo comando de limpeza porque:');
            console.log('   • Não tem entidades associadas');
            console.log('   • Não tem relacionamentos associados');
            console.log('\n💡 Para remover, execute:');
            console.log('   Ctrl+Shift+P → CappyRAG: Clean Orphaned Entities & Chunks');
        } else {
            console.log('✅ STATUS: CHUNK VÁLIDO');
            console.log('='.repeat(80));
            console.log('\n📌 Este chunk está conectado ao grafo de conhecimento:');
            if (hasEntities) {
                console.log(`   • ${chunk.entities.length} entidade(s)`);
            }
            if (hasRelationships) {
                console.log(`   • ${chunk.relationships.length} relacionamento(s)`);
            }
        }
        console.log('');

    } catch (error) {
        console.error('\n❌ Erro ao verificar chunk:', error);
        console.error(error.stack);
    }
}

// Executar verificação
checkIfOrphan().then(() => {
    console.log('✅ Verificação concluída!');
}).catch(error => {
    console.error('❌ Verificação falhou:', error);
});
