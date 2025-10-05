/**
 * Script to fix documents stuck in "processing" status
 * Run with: node fix-document-status.js
 */

const { connect } = require('@lancedb/lancedb');
const path = require('path');

async function fixDocumentStatus() {
    try {
        const dbPath = path.join(__dirname, '.cappy', 'cappyrag-data');
        console.log(`\n📂 Connecting to: ${dbPath}\n`);
        
        const db = await connect(dbPath);
        const docsTable = await db.openTable('documents');
        
        // Get all documents
        const docs = await docsTable.query().toArray();
        console.log(`📄 Found ${docs.length} documents\n`);
        
        let updatedCount = 0;
        
        for (const doc of docs) {
            if (doc.status === 'processing') {
                console.log(`🔄 Updating document: ${doc.title} (${doc.id})`);
                
                // Delete old document
                await docsTable.delete(`id = '${doc.id}'`);
                
                // Add updated document (clean object without Arrow metadata)
                const updatedDoc = {
                    id: doc.id,
                    title: doc.title,
                    description: doc.description,
                    category: doc.category,
                    tags: Array.isArray(doc.tags) ? Array.from(doc.tags) : [],
                    filePath: doc.filePath,
                    fileName: doc.fileName,
                    fileSize: doc.fileSize,
                    content: doc.content,
                    status: 'completed',
                    created: doc.created,
                    updated: new Date().toISOString()
                };
                
                await docsTable.add([updatedDoc]);
                updatedCount++;
                
                console.log(`   ✅ Status updated to 'completed'\n`);
            } else {
                console.log(`⏭️  Skipping document: ${doc.title} (already ${doc.status})\n`);
            }
        }
        
        console.log(`\n✅ Fixed ${updatedCount} document(s)!\n`);
        
    } catch (error) {
        console.error('❌ Error fixing documents:', error.message);
        console.error(error);
    }
}

fixDocumentStatus();
