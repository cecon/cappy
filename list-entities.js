const path = require('path');

async function listEntities() {
    try {
        const workspacePath = process.cwd();
        console.log(`🔧 Using workspace: ${workspacePath}`);
        
        const { getCappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');
        
        const db = getCappyRAGLanceDatabase(workspacePath);
        await db.initialize();
        
        console.log('📋 Listing all entities...\n');
        
        // Debug: verificar se as tabelas estão acessíveis
        console.log('🔍 Debug: Checking tables...');
        
        try {
            const entities = await db.getEntitiesAsync(); // Usar método assíncrono
            console.log(`Found ${entities.length} entities`);
            
            if (entities.length === 0) {
                console.log('❌ No entities found, but let\'s check the raw table...');
                
                // Tentar acessar diretamente a conexão
                const stats = await db.getStatistics();
                console.log('Stats:', stats);
                
            } else {
                console.log(`✅ Found ${entities.length} entities:\n`);
                
                entities.forEach((entity, index) => {
                    console.log(`${index + 1}. ID: ${entity.id}`);
                    console.log(`   Name: ${entity.name}`);
                    console.log(`   Type: ${entity.type}`);
                    console.log(`   Description: ${entity.description}`);
                    console.log(`   Documents: ${entity.documentIds?.length || 0}`);
                    console.log(`   Created: ${entity.created}`);
                    console.log('');
                });
            }
            
        } catch (entitiesError) {
            console.error('Error getting entities:', entitiesError);
        }
        
        // Também listar relacionamentos existentes
        console.log('🔗 Listing existing relationships...\n');
        try {
            const relationships = await db.getRelationshipsAsync(); // Usar método assíncrono
            
            if (relationships.length === 0) {
                console.log('❌ No relationships found in database');
            } else {
                console.log(`✅ Found ${relationships.length} relationships:\n`);
                
                relationships.forEach((rel, index) => {
                    console.log(`${index + 1}. ID: ${rel.id}`);
                    console.log(`   Source: ${rel.source}`);
                    console.log(`   Target: ${rel.target}`);
                    console.log(`   Type: ${rel.type}`);
                    console.log(`   Description: ${rel.description}`);
                    console.log(`   Weight: ${rel.weight}`);
                    console.log('');
                });
            }
        } catch (relationshipsError) {
            console.error('Error getting relationships:', relationshipsError);
        }
        
    } catch (error) {
        console.error('❌ Error listing entities:', error);
        console.error('Stack trace:', error.stack);
    }
}

listEntities();