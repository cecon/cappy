const path = require('path');
const fs = require('fs');

async function createRelationshipBetweenEntities() {
    try {
        // IDs das entidades fornecidas
        const entity1Id = 'entity_1759895512985_xfzvk2okd';
        const entity2Id = 'entity_1759639747801_uhmf42chr';
        
        // Usar diretório atual como workspace
        const workspacePath = process.cwd();
        console.log(`🔧 Using workspace: ${workspacePath}`);
        
        // Importar o banco compilado
        const { getCappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');
        
        // Inicializar banco
        const db = getCappyRAGLanceDatabase(workspacePath);
        await db.initialize();
        
        console.log('🔍 Checking if entities exist...');
        
        // Verificar se as entidades existem - usar método assíncrono
        const entities = await db.getEntitiesAsync();
        const entity1 = entities.find(e => e.id === entity1Id);
        const entity2 = entities.find(e => e.id === entity2Id);
        
        if (!entity1) {
            console.error(`❌ Entity 1 not found: ${entity1Id}`);
            console.log(`Found ${entities.length} entities total`);
            // Mostrar algumas entidades como exemplo
            if (entities.length > 0) {
                console.log(`First 5 entities:`);
                entities.slice(0, 5).forEach(e => console.log(`  - ${e.id}: ${e.name} (${e.type})`));
            }
            return;
        }
        
        if (!entity2) {
            console.error(`❌ Entity 2 not found: ${entity2Id}`);
            console.log(`Found ${entities.length} entities total`);
            // Mostrar algumas entidades como exemplo
            if (entities.length > 0) {
                console.log(`First 5 entities:`);
                entities.slice(0, 5).forEach(e => console.log(`  - ${e.id}: ${e.name} (${e.type})`));
            }
            return;
        }
        
        console.log(`✅ Entity 1 found: ${entity1.name} (type: ${entity1.type})`);
        console.log(`✅ Entity 2 found: ${entity2.name} (type: ${entity2.type})`);
        
        // Verificar se já existe relacionamento entre elas - usar método assíncrono
        const relationships = await db.getRelationshipsAsync();
        const existingRel = relationships.find(r => 
            (r.source === entity1Id && r.target === entity2Id) ||
            (r.source === entity2Id && r.target === entity1Id)
        );
        
        if (existingRel) {
            console.log(`⚠️ Relationship already exists: ${existingRel.type} (ID: ${existingRel.id})`);
            return;
        }
        
        // Criar novo relacionamento
        console.log('🔗 Creating new relationship...');
        const relationshipId = await db.addRelationship({
            source: entity1Id,
            target: entity2Id,
            type: 'RELATED_TO', // Tipo genérico - pode ser alterado conforme necessário
            description: `Relationship between ${entity1.name} and ${entity2.name}`,
            weight: 1.0,
            documentIds: [] // Pode ser preenchido se há documentos em comum
        });
        
        console.log(`✅ Relationship created successfully!`);
        console.log(`   ID: ${relationshipId}`);
        console.log(`   Source: ${entity1.name} (${entity1Id})`);
        console.log(`   Target: ${entity2.name} (${entity2Id})`);
        console.log(`   Type: RELATED_TO`);
        
        // Mostrar estatísticas atualizadas
        const stats = await db.getStatistics();
        console.log(`\n📊 Updated statistics:`);
        console.log(`   Entities: ${stats.totalEntities}`);
        console.log(`   Relationships: ${stats.totalRelationships}`);
        console.log(`   Documents: ${stats.totalDocuments}`);
        console.log(`   Chunks: ${stats.totalChunks}`);
        
    } catch (error) {
        console.error('❌ Error creating relationship:', error);
    }
}

// Execute se rodado diretamente
if (require.main === module) {
    createRelationshipBetweenEntities();
}