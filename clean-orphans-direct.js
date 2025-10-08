/**
 * Script para limpar chunks órfãos diretamente no banco LanceDB
 * Executa sem depender do VS Code
 */

const path = require('path');
const fs = require('fs');

async function cleanOrphansDirectly() {
    console.log('🧹 Limpeza Direta de Órfãos no LanceDB\n');
    console.log('='.repeat(80));
    
    try {
        // Importar LanceDB
        const lancedb = require('@lancedb/lancedb');
        
        // Definir path do banco
        const workspacePath = process.cwd();
        const dbPath = path.join(workspacePath, '.cappy', 'cappyrag-data');
        
        console.log(`📁 Database path: ${dbPath}\n`);
        
        if (!fs.existsSync(dbPath)) {
            console.error('❌ Banco de dados não encontrado em:', dbPath);
            console.log('\n💡 Certifique-se de ter adicionado documentos antes.');
            return;
        }
        
        // Conectar ao banco
        console.log('🔌 Conectando ao LanceDB...');
        const db = await lancedb.connect(dbPath);
        
        // Abrir tabelas
        console.log('📊 Abrindo tabelas...');
        const entitiesTable = await db.openTable('entities');
        const relationshipsTable = await db.openTable('relationships');
        const chunksTable = await db.openTable('chunks');
        
        // Step 1: Buscar todos os relacionamentos
        console.log('\n📋 Step 1: Analisando relacionamentos...');
        const relationships = await relationshipsTable.query().limit(100000).toArray();
        console.log(`   Total de relacionamentos: ${relationships.length}`);
        
        // Construir set de entidades referenciadas
        const referencedEntityIds = new Set();
        relationships.forEach(rel => {
            referencedEntityIds.add(rel.source);
            referencedEntityIds.add(rel.target);
        });
        console.log(`   Entidades referenciadas: ${referencedEntityIds.size}`);
        
        // Step 2: Buscar todas as entidades
        console.log('\n📋 Step 2: Analisando entidades...');
        const allEntities = await entitiesTable.query().limit(100000).toArray();
        console.log(`   Total de entidades: ${allEntities.length}`);
        
        // Encontrar órfãs
        const orphanedEntities = allEntities.filter(entity => 
            !referencedEntityIds.has(entity.id)
        );
        console.log(`   Entidades órfãs: ${orphanedEntities.length}`);
        
        if (orphanedEntities.length > 0) {
            console.log('\n   🗑️  Entidades órfãs a serem deletadas:');
            orphanedEntities.slice(0, 10).forEach((entity, idx) => {
                console.log(`      ${idx + 1}. ${entity.name} (${entity.type}) - ID: ${entity.id}`);
            });
            if (orphanedEntities.length > 10) {
                console.log(`      ... e mais ${orphanedEntities.length - 10}`);
            }
            
            // Deletar entidades órfãs
            console.log('\n   🔥 Deletando entidades órfãs...');
            for (const entity of orphanedEntities) {
                await entitiesTable.delete(`id = '${entity.id}'`);
            }
            console.log(`   ✅ ${orphanedEntities.length} entidades deletadas`);
        }
        
        // Step 3: Buscar todos os chunks
        console.log('\n📋 Step 3: Analisando chunks...');
        const allChunks = await chunksTable.query().limit(100000).toArray();
        console.log(`   Total de chunks: ${allChunks.length}`);
        
        // Encontrar chunks órfãos
        const orphanedChunks = allChunks.filter(chunk => 
            (!chunk.entities || chunk.entities.length === 0) &&
            (!chunk.relationships || chunk.relationships.length === 0)
        );
        console.log(`   Chunks órfãos: ${orphanedChunks.length}`);
        
        if (orphanedChunks.length > 0) {
            console.log('\n   🗑️  Chunks órfãos a serem deletados:');
            orphanedChunks.forEach((chunk, idx) => {
                const preview = (chunk.content || '').substring(0, 60).replace(/\n/g, ' ');
                console.log(`      ${idx + 1}. ${chunk.id}`);
                console.log(`          Content: "${preview}..."`);
                console.log(`          Entities: ${chunk.entities?.length || 0}`);
                console.log(`          Relationships: ${chunk.relationships?.length || 0}`);
            });
            
            // Deletar chunks órfãos
            console.log('\n   🔥 Deletando chunks órfãos...');
            for (const chunk of orphanedChunks) {
                await chunksTable.delete(`id = '${chunk.id}'`);
            }
            console.log(`   ✅ ${orphanedChunks.length} chunks deletados`);
        }
        
        // Step 4: Verificar resultados
        console.log('\n📊 Step 4: Verificando resultados finais...');
        const finalEntities = await entitiesTable.query().limit(100000).toArray();
        const finalChunks = await chunksTable.query().limit(100000).toArray();
        
        console.log('\n' + '='.repeat(80));
        console.log('✅ LIMPEZA CONCLUÍDA');
        console.log('='.repeat(80));
        console.log(`Entidades deletadas: ${orphanedEntities.length}`);
        console.log(`Chunks deletados: ${orphanedChunks.length}`);
        console.log(`Entidades restantes: ${finalEntities.length}`);
        console.log(`Chunks restantes: ${finalChunks.length}`);
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('\n❌ ERRO durante limpeza:', error);
        console.error(error.stack);
    }
}

// Executar limpeza
cleanOrphansDirectly().then(() => {
    console.log('\n✅ Script finalizado!');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Script falhou:', error);
    process.exit(1);
});
