/**
 * Script to query CappyRAG using the existing query tool
 * Consulta o chunk específico: chunk_1759640339661_ujkt1ailh
 */

const vscode = require('vscode');

async function queryChunk() {
    const chunkId = 'chunk_1759640339661_ujkt1ailh';
    
    console.log(`\n🔍 Consultando informações sobre: ${chunkId}\n`);

    try {
        // Usar a tool cappyrag_query_knowledge_base que já existe
        console.log('📊 Buscando no knowledge base...\n');
        
        const result = await vscode.commands.executeCommand(
            'cappyrag.queryKnowledgeBase',
            chunkId,
            10
        );

        console.log('✅ Resultado da consulta:');
        console.log('='.repeat(80));
        console.log(result);
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n❌ Erro ao consultar:', error);
        console.error(error.stack);
    }
}

// Executar consulta
queryChunk().then(() => {
    console.log('\n✅ Consulta concluída!');
}).catch(error => {
    console.error('\n❌ Falha na consulta:', error);
});
