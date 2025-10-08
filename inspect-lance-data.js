const path = require('path');
const fs = require('fs');

async function inspectLanceData() {
    try {
        const workspacePath = process.cwd();
        const dbPath = path.join(workspacePath, '.cappy', 'cappyrag-data');
        
        console.log(`🔧 Inspecting Lance data at: ${dbPath}`);
        
        // Verificar se os diretórios das tabelas existem e têm dados
        const tables = ['entities.lance', 'relationships.lance', 'documents.lance', 'chunks.lance'];
        
        for (const tableName of tables) {
            const tablePath = path.join(dbPath, tableName);
            if (fs.existsSync(tablePath)) {
                const stats = fs.statSync(tablePath);
                const files = fs.readdirSync(tablePath);
                console.log(`📊 ${tableName}:`);
                console.log(`   Path: ${tablePath}`);
                console.log(`   Is Directory: ${stats.isDirectory()}`);
                console.log(`   Files: ${files.length}`);
                console.log(`   Files List: ${files.join(', ')}`);
                
                // Verificar tamanhos dos arquivos
                let totalSize = 0;
                files.forEach(file => {
                    const filePath = path.join(tablePath, file);
                    if (fs.statSync(filePath).isFile()) {
                        const fileSize = fs.statSync(filePath).size;
                        totalSize += fileSize;
                        console.log(`     ${file}: ${fileSize} bytes`);
                    }
                });
                console.log(`   Total Size: ${totalSize} bytes`);
                console.log('');
            } else {
                console.log(`❌ ${tableName}: Not found`);
            }
        }
        
        // Tentar conectar diretamente ao LanceDB e inspecionar
        console.log('🔍 Trying direct LanceDB connection...');
        
        const { connect } = require('@lancedb/lancedb');
        const db = await connect(dbPath);
        
        const tableNames = await db.tableNames();
        console.log(`📋 Available tables: ${tableNames.join(', ')}`);
        
        for (const tableName of tableNames) {
            try {
                const table = await db.openTable(tableName);
                const count = await table.countRows();
                console.log(`📊 ${tableName}: ${count} rows`);
                
                if (count > 0) {
                    // Tentar mostrar algumas linhas de exemplo
                    const sample = await table.search().limit(5).toArray();
                    console.log(`   Sample data (first 5 rows):`);
                    sample.forEach((row, index) => {
                        console.log(`     ${index + 1}. ${JSON.stringify(row).substring(0, 100)}...`);
                    });
                }
            } catch (tableError) {
                console.error(`❌ Error reading table ${tableName}:`, tableError.message);
            }
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ Error inspecting data:', error);
        console.error('Stack trace:', error.stack);
    }
}

inspectLanceData();