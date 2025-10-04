import { VectorStoreService } from '../store/vector-store';
import { Chunk } from '../core/schemas';
import * as path from 'path';

async function testVectorStore() {
    console.log('🧪 Testing Vector Store Service...');
    
    try {
        // Create test directory
        const testDir = path.join(__dirname, '..', '..', 'test-workspace', 'vector-test');
        
        // Initialize vector store
        const vectorStore = new VectorStoreService();
        vectorStore.setStoragePaths(testDir);
        
        console.log('📊 Initializing Vector Store...');
        await vectorStore.initialize();
        
        // Get stats
        const stats = await vectorStore.getStats();
        console.log('📈 Vector Store Stats:', JSON.stringify(stats, null, 2));
        
        // Create test chunk
        const testChunk: Chunk = {
            id: 'test-chunk-1',
            path: '/test/example.ts',
            language: 'typescript',
            type: 'code-function',
            textHash: 'test-hash',
            text: 'function calculateSum(numbers: number[]): number { return numbers.reduce((sum, num) => sum + num, 0); }',
            startLine: 1,
            endLine: 1,
            keywords: ['function', 'calculate', 'sum', 'numbers'],
            metadata: { complexity: 1 },
            vector: [],
            updatedAt: new Date().toISOString(),
            version: 1
        };
        
        console.log('💾 Indexing test chunk...');
        await vectorStore.indexChunks([testChunk]);
        
        console.log('🔍 Testing search...');
        const results = await vectorStore.search('calculate numbers', { limit: 5 });
        
        console.log(`✅ Found ${results.length} results`);
        if (results.length > 0) {
            console.log('🎯 Top result:', {
                score: results[0].score,
                text: results[0].chunk.text.substring(0, 100),
                explanation: results[0].explanation
            });
        }
        
        // Clean up
        await vectorStore.close();
        console.log('🎉 Vector Store test completed successfully!');
        
        return true;
        
    } catch (error) {
        console.error('❌ Vector Store test failed:', error);
        return false;
    }
}

// Run test if called directly
if (require.main === module) {
    testVectorStore().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { testVectorStore };