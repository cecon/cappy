/**
 * Script to query CappyRAG chunk directly from LanceDB
 * Consulta o chunk específico: chunk_1759640429156_anyyg7q42
 */

const path = require('path');
const os = require('os');

async function queryChunk() {
    const chunkId = 'chunk_1759640429156_anyyg7q42';
    
    console.log(`\n🔍 Consultando informações sobre: ${chunkId}\n`);

    try {
        // Importar LanceDB diretamente
        const { connect } = require('@lancedb/lancedb');
        
        console.log('📊 Conectando ao banco de dados LanceDB...\n');
        
        // Caminho para o banco CappyRAG
        const dbPath = path.join(process.cwd(), '.cappy', 'cappyrag-data');
        console.log(`Caminho do banco: ${dbPath}`);
        
        const db = await connect(dbPath);
        
        console.log('📋 Listando tabelas disponíveis...');
        const tableNames = await db.tableNames();
        console.log('Tabelas:', tableNames);
        
        if (!tableNames.includes('chunks')) {
            console.log('❌ Tabela "chunks" não encontrada');
            return;
        }
        
        const chunks = await db.openTable('chunks');
        
        console.log('🔍 Buscando chunk específico...\n');
        
        // Primeiro, verificar quantos chunks existem
        const count = await chunks.countRows();
        console.log(`📊 Total de chunks na tabela: ${count}`);
        
        if (count === 0) {
            console.log('❌ Nenhum chunk encontrado na tabela');
            return;
        }
        
        // Usar scan() para busca não-vetorial
        console.log('🔍 Fazendo scan da tabela...');
        
        const allChunks = [];
        const scanner = chunks.scan();
        
        for await (const batch of scanner) {
            for (const chunk of batch) {
                allChunks.push(chunk);
                if (allChunks.length >= 1000) {
                    break; // Limitar a 1000 chunks
                }
            }
            if (allChunks.length >= 1000) {
                break;
            }
        }
        
        console.log(`📊 Chunks carregados: ${allChunks.length}`);
        
        const result = allChunks.filter(chunk => chunk.id === chunkId);

        if (result.length === 0) {
            console.log(`❌ Chunk ${chunkId} não encontrado`);
            console.log('\n🔍 Primeiros chunks disponíveis:');
            
            allChunks.slice(0, 10).forEach((chunk, i) => {
                console.log(`${i + 1}. ID: ${chunk.id}`);
            });
            return;
        }

        const chunk = result[0];
        
        console.log('✅ Chunk encontrado:');
        console.log('='.repeat(80));
        console.log(`ID: ${chunk.id}`);
        console.log(`Documento: ${chunk.document_id}`);
        console.log(`Texto:`);
        console.log(chunk.text);
        if (chunk.metadata) {
            console.log('\nMetadados:');
            console.log(JSON.stringify(chunk.metadata, null, 2));
        }
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n❌ Erro ao consultar:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    queryChunk().catch(console.error);
}

module.exports = { queryChunk };

// Executar consulta
queryChunk().then(() => {
    console.log('\n✅ Consulta concluída!');
}).catch(error => {
    console.error('\n❌ Falha na consulta:', error);
});
