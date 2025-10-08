const { CappyRAGLanceDatabase } = require('./out/store/cappyragLanceDb');
const path = require('path');

async function debugChunkRelationships() {
    const dbPath = path.join(__dirname, '.cappy', 'cappyrag.db');
    const db = new CappyRAGLanceDatabase(dbPath);
    
    try {
        await db.initialize();
        console.log('🔍 Debugging chunk relationships...\n');
        
        const targetChunkId = 'chunk_1759640439943_03u8899q0';
        console.log(`📋 Investigating chunk: ${targetChunkId}\n`);
        
        // 1. Get chunk details
        console.log('1️⃣ Chunk Details:');
        const chunks = await db.getChunksAsync();
        const targetChunk = chunks.find(c => c.id === targetChunkId);
        
        if (!targetChunk) {
            console.log('❌ Chunk not found in database!');
            return;
        }
        
        console.log(`   📄 Document ID: ${targetChunk.documentId}`);
        console.log(`   📝 Content preview: ${targetChunk.content.substring(0, 100)}...`);
        console.log(`   🔢 Chunk index: ${targetChunk.chunkIndex}`);
        console.log(`   📏 Content length: ${targetChunk.content.length}`);
        
        // Convert Arrow arrays if needed
        let chunkEntities = [];
        if (targetChunk.entities) {
            if (Array.isArray(targetChunk.entities)) {
                chunkEntities = targetChunk.entities;
            } else if (typeof targetChunk.entities.toArray === 'function') {
                chunkEntities = targetChunk.entities.toArray();
            } else if (typeof targetChunk.entities === 'object' && targetChunk.entities.length !== undefined) {
                chunkEntities = Array.from({ length: targetChunk.entities.length }, (_, i) => targetChunk.entities[i]);
            }
        }
        
        let chunkRelationships = [];
        if (targetChunk.relationships) {
            if (Array.isArray(targetChunk.relationships)) {
                chunkRelationships = targetChunk.relationships;
            } else if (typeof targetChunk.relationships.toArray === 'function') {
                chunkRelationships = targetChunk.relationships.toArray();
            } else if (typeof targetChunk.relationships === 'object' && targetChunk.relationships.length !== undefined) {
                chunkRelationships = Array.from({ length: targetChunk.relationships.length }, (_, i) => targetChunk.relationships[i]);
            }
        }
        
        console.log(`   🏷️ Entities count: ${chunkEntities.length}`);
        console.log(`   🔗 Relationships count: ${chunkRelationships.length}`);
        console.log(`   📋 Entities: ${chunkEntities.join(', ')}`);
        console.log(`   📋 Relationships: ${chunkRelationships.join(', ')}\n`);
        
        // 2. Check entities referenced by this chunk
        console.log('2️⃣ Entities referenced by this chunk:');
        const entities = await db.getEntitiesAsync();
        const referencedEntities = entities.filter(e => chunkEntities.includes(e.id));
        
        referencedEntities.forEach((entity, idx) => {
            console.log(`   ${idx + 1}. ${entity.name} (${entity.id})`);
            console.log(`      Type: ${entity.type}`);
            console.log(`      Description: ${entity.description || 'N/A'}`);
        });
        
        if (referencedEntities.length === 0) {
            console.log('   ❌ No entities found for this chunk');
        }
        console.log('');
        
        // 3. Check relationships where this chunk is involved
        console.log('3️⃣ Relationships involving this chunk:');
        const relationships = await db.getRelationshipsAsync();
        const chunkRelationshipsFound = relationships.filter(rel => {
            // Check if chunk is in source documents
            let sourceChunks = [];
            if (rel.sourceChunks) {
                if (Array.isArray(rel.sourceChunks)) {
                    sourceChunks = rel.sourceChunks;
                } else if (typeof rel.sourceChunks.toArray === 'function') {
                    sourceChunks = rel.sourceChunks.toArray();
                } else if (typeof rel.sourceChunks === 'object' && rel.sourceChunks.length !== undefined) {
                    sourceChunks = Array.from({ length: rel.sourceChunks.length }, (_, i) => rel.sourceChunks[i]);
                }
            }
            return sourceChunks.includes(targetChunkId);
        });
        
        chunkRelationshipsFound.forEach((rel, idx) => {
            console.log(`   ${idx + 1}. ${rel.source} → ${rel.target}`);
            console.log(`      Type: ${rel.type}`);
            console.log(`      Description: ${rel.description || 'N/A'}`);
            console.log(`      Weight: ${rel.weight || 'N/A'}`);
            console.log(`      Confidence: ${rel.confidence || 'N/A'}`);
        });
        
        if (chunkRelationshipsFound.length === 0) {
            console.log('   ❌ No relationships found involving this chunk');
        }
        console.log('');
        
        // 4. Check document context
        console.log('4️⃣ Document context:');
        const documents = await db.getDocumentsAsync();
        const parentDoc = documents.find(d => d.id === targetChunk.documentId);
        
        if (parentDoc) {
            console.log(`   📄 Document: ${parentDoc.title || parentDoc.fileName}`);
            console.log(`   📂 File path: ${parentDoc.filePath}`);
            console.log(`   📊 Status: ${parentDoc.status}`);
            console.log(`   📏 File size: ${parentDoc.fileSize} bytes`);
        } else {
            console.log('   ❌ Parent document not found!');
        }
        console.log('');
        
        // 5. Summary
        console.log('📋 Summary:');
        console.log(`   • Chunk exists: ✅`);
        console.log(`   • Has entities: ${chunkEntities.length > 0 ? '✅' : '❌'} (${chunkEntities.length})`);
        console.log(`   • Has relationships: ${chunkRelationshipsFound.length > 0 ? '✅' : '❌'} (${chunkRelationshipsFound.length})`);
        console.log(`   • Parent document exists: ${parentDoc ? '✅' : '❌'}`);
        
        if (chunkEntities.length === 0 && chunkRelationshipsFound.length === 0) {
            console.log('\n⚠️  This chunk appears to be genuinely orphaned in the database.');
            console.log('   Consider re-processing the parent document or checking the indexing logic.');
        }
        
    } catch (error) {
        console.error('❌ Error debugging chunk:', error);
    } finally {
        // Close database connections if needed
    }
}

debugChunkRelationships();