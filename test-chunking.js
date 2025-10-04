const { testChunking } = require('./out/core/chunking-test');

// Execute the chunking test
testChunking().then(results => {
    console.log('\n=== CHUNKING TEST RESULTS ===');
    console.log(`Total chunks created: ${results.totalChunks}`);
    console.log(`Markdown chunks: ${results.markdownChunks.length}`);
    console.log(`TypeScript chunks: ${results.tsChunks.length}`);
    console.log('\n✅ Chunking system test completed successfully!');
}).catch(error => {
    console.error('❌ Chunking test failed:', error);
});