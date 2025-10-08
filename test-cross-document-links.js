/**
 * Test script to verify cross-document relationship creation
 * Run with: node test-cross-document-links.js
 */

const vscode = require('vscode');

async function testCrossDocumentLinks() {
    console.log('🔍 Testing Cross-Document Relationship Creation...\n');

    try {
        // Step 1: Add first document
        console.log('📄 Adding Document 1: TypeScript basics...');
        const result1 = await vscode.commands.executeCommand(
            'cappy.CappyRAG.addDocument',
            {
                content: `
TypeScript is a programming language developed by Microsoft.
It is a typed superset of JavaScript that compiles to plain JavaScript.
TypeScript adds static typing to JavaScript, making code more robust.
Angular framework heavily uses TypeScript for development.
`,
                metadata: {
                    title: 'TypeScript Basics',
                    source: 'test-doc-1.md',
                    author: 'Test User',
                    tags: ['typescript', 'programming']
                }
            }
        );
        console.log(`✅ Document 1 added: ${result1.documentId}`);
        console.log(`   Entities: ${result1.entities.length}`);
        console.log(`   Relationships: ${result1.relationships.length}\n`);

        // Wait a bit to ensure processing is complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Add second document that should link to first
        console.log('📄 Adding Document 2: Angular framework...');
        const result2 = await vscode.commands.executeCommand(
            'cappy.CappyRAG.addDocument',
            {
                content: `
Angular is a web application framework developed by Google.
Angular uses TypeScript as its primary programming language.
The framework provides powerful features for building SPAs.
Microsoft and Google collaborate on TypeScript tooling for Angular.
`,
                metadata: {
                    title: 'Angular Framework',
                    source: 'test-doc-2.md',
                    author: 'Test User',
                    tags: ['angular', 'framework']
                }
            }
        );
        console.log(`✅ Document 2 added: ${result2.documentId}`);
        console.log(`   Entities: ${result2.entities.length}`);
        console.log(`   Relationships: ${result2.relationships.length}\n`);

        // Step 3: Check for cross-document relationships
        console.log('🔗 Analyzing relationships...');
        
        // Look for relationships mentioning entities from both documents
        const crossDocRelationships = result2.relationships.filter(rel => {
            const relStr = JSON.stringify(rel);
            return relStr.includes('TypeScript') || relStr.includes('Microsoft');
        });

        console.log(`\n📊 RESULTS:`);
        console.log(`   Total relationships in Doc 2: ${result2.relationships.length}`);
        console.log(`   Cross-document relationships: ${crossDocRelationships.length}`);
        
        if (crossDocRelationships.length > 0) {
            console.log('\n✅ SUCCESS! Cross-document relationships were created:');
            crossDocRelationships.forEach((rel, idx) => {
                console.log(`   ${idx + 1}. ${rel.type}: ${rel.description}`);
            });
        } else {
            console.log('\n❌ PROBLEM: No cross-document relationships found!');
            console.log('\n🔍 Debug info - All relationships in Doc 2:');
            result2.relationships.forEach((rel, idx) => {
                console.log(`   ${idx + 1}. ${rel.source} -> ${rel.target} (${rel.type})`);
            });
        }

        // Step 4: Query the database directly to verify
        console.log('\n\n📊 Querying database statistics...');
        const stats = await vscode.commands.executeCommand('cappy.CappyRAG.getStats');
        if (stats) {
            console.log(`   Total documents: ${stats.documents || 0}`);
            console.log(`   Total entities: ${stats.entities || 0}`);
            console.log(`   Total relationships: ${stats.relationships || 0}`);
        }

    } catch (error) {
        console.error('\n❌ Error during test:', error);
        console.error(error.stack);
    }
}

// Run the test
testCrossDocumentLinks().then(() => {
    console.log('\n✅ Test completed!');
}).catch(error => {
    console.error('\n❌ Test failed:', error);
});
