/**
 * Query CappyRAG chunk using MCP-like approach
 * Consulta o chunk específico: chunk_1759640429156_anyyg7q42
 */

const path = require('path');
const fs = require('fs');

async function queryKnowledgeBase(query, limit = 10) {
    console.log(`\n🔍 Consultando Knowledge Base para: "${query}"\n`);

    try {
        // Verificar se existe banco de dados
        const dbPath = path.join(process.cwd(), '.cappy', 'cappyrag-data');
        
        if (!fs.existsSync(dbPath)) {
            console.log('❌ Banco de dados CappyRAG não encontrado');
            return;
        }

        console.log(`📊 Banco de dados encontrado: ${dbPath}`);

        // Conectar ao LanceDB
        const { connect } = require('@lancedb/lancedb');
        const db = await connect(dbPath);
        
        const tableNames = await db.tableNames();
        console.log(`📋 Tabelas disponíveis: ${tableNames.join(', ')}`);

        // Buscar em chunks se a query parece ser um chunk ID
        if (query.startsWith('chunk_') && tableNames.includes('chunks')) {
            console.log('🔍 Buscando chunk específico...');
            
            const chunks = await db.openTable('chunks');
            const count = await chunks.countRows();
            console.log(`📊 Total de chunks: ${count}`);

            // Como search() tem problemas, vou tentar uma busca textual simples
            // Para isso, vou usar uma abordagem diferente - buscar o chunk através da estrutura de dados
            
            // Verificar se existe algum arquivo de índice ou cache
            const cappyPath = path.join(process.cwd(), '.cappy');
            const files = fs.readdirSync(cappyPath);
            console.log(`📁 Arquivos na pasta .cappy: ${files.join(', ')}`);

            // Tentar ler algum arquivo que possa ter informações sobre chunks
            const possibleFiles = ['output.txt', 'stack.md', 'config.yaml'];
            
            for (const file of possibleFiles) {
                const filePath = path.join(cappyPath, file);
                if (fs.existsSync(filePath)) {
                    console.log(`📄 Verificando ${file}...`);
                    const content = fs.readFileSync(filePath, 'utf8');
                    if (content.includes(query)) {
                        console.log(`✅ Referência ao chunk encontrada em ${file}:`);
                        const lines = content.split('\n');
                        const relevantLines = lines.filter(line => line.includes(query));
                        relevantLines.forEach(line => console.log(`   ${line.trim()}`));
                    }
                }
            }

            return {
                query,
                type: 'chunk_search',
                database_info: {
                    tables: tableNames,
                    chunks_count: count
                },
                note: 'Direct chunk access limited by LanceDB API. Consider using VS Code command when extension is properly loaded.'
            };
        }

        // Busca genérica
        console.log('🔍 Fazendo busca genérica...');
        
        const results = [];
        
        // Verificar tabelas e contar registros
        for (const tableName of tableNames) {
            const table = await db.openTable(tableName);
            const count = await table.countRows();
            results.push({
                table: tableName,
                count: count,
                query_match: tableName.includes(query.toLowerCase()) || query.toLowerCase().includes(tableName)
            });
        }

        console.log('✅ Resultados da consulta:');
        console.log('='.repeat(80));
        results.forEach(result => {
            console.log(`📊 ${result.table}: ${result.count} registros${result.query_match ? ' (relacionado à consulta)' : ''}`);
        });
        console.log('='.repeat(80));

        return {
            query,
            results,
            total_records: results.reduce((sum, r) => sum + r.count, 0)
        };

    } catch (error) {
        console.error('\n❌ Erro ao consultar knowledge base:', error.message);
        return {
            error: error.message,
            query
        };
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    queryKnowledgeBase('chunk_1759640429156_anyyg7q42', 10).then(result => {
        console.log('\n🎯 Resultado final:');
        console.log(JSON.stringify(result, null, 2));
    }).catch(console.error);
}

module.exports = { queryKnowledgeBase };