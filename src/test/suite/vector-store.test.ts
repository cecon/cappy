import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { VectorStoreService, VectorStoreConfig, DEFAULT_VECTOR_STORE_CONFIG } from '../../store/vector-store';
import { Chunk } from '../../core/schemas';

suite('VectorStoreService Tests', () => {
    let vectorStore: VectorStoreService;
    let tempDir: string;
    let testChunks: Chunk[];

    setup(async function() {
        this.timeout(60000); // Increase timeout for model downloads

        // Create temporary directory
        tempDir = path.join(__dirname, '..', '..', '..', 'test-workspace', 'temp-vector-store');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Initialize vector store with test configuration
        const config: VectorStoreConfig = {
            ...DEFAULT_VECTOR_STORE_CONFIG,
            embedding: {
                ...DEFAULT_VECTOR_STORE_CONFIG.embedding,
                modelName: 'Xenova/all-MiniLM-L6-v2' // Explicit model name
            }
        };

        vectorStore = new VectorStoreService(config);
        vectorStore.setStoragePaths(tempDir);

        // Create test chunks
        testChunks = [
            {
                id: 'chunk-1',
                path: '/test/file1.ts',
                language: 'typescript',
                type: 'code-function',
                textHash: 'hash1',
                text: 'function calculateTotal(prices: number[]): number { return prices.reduce((sum, price) => sum + price, 0); }',
                startLine: 1,
                endLine: 3,
                keywords: ['function', 'calculate', 'total', 'prices', 'number'],
                metadata: { complexity: 1 },
                vector: [], // Will be generated
                updatedAt: new Date().toISOString(),
                version: 1
            },
            {
                id: 'chunk-2',
                path: '/test/file2.md',
                language: 'markdown',
                type: 'markdown-section',
                textHash: 'hash2',
                text: '# Data Processing\n\nThis section covers data processing techniques including filtering, mapping, and reducing arrays.',
                startLine: 1,
                endLine: 3,
                keywords: ['data', 'processing', 'filtering', 'mapping', 'reducing'],
                metadata: { complexity: 1 },
                vector: [],
                updatedAt: new Date().toISOString(),
                version: 1
            },
            {
                id: 'chunk-3',
                path: '/test/file3.ts',
                language: 'typescript',
                type: 'code-class',
                textHash: 'hash3',
                text: 'class DataProcessor { private items: any[] = []; processItems(): void { /* processing logic */ } }',
                startLine: 5,
                endLine: 8,
                keywords: ['class', 'data', 'processor', 'items', 'process'],
                metadata: { complexity: 2 },
                vector: [],
                updatedAt: new Date().toISOString(),
                version: 1
            }
        ];
    });

    teardown(async function() {
        this.timeout(10000);
        
        if (vectorStore) {
            await vectorStore.close();
        }

        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('Should initialize vector store', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        
        const stats = await vectorStore.getStats();
        assert.strictEqual(stats.isReady, true);
        assert.ok(stats.modelInfo);
        assert.ok(stats.dbStats);
    });

    test('Should index chunks with embeddings', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        
        // Index test chunks
        await vectorStore.indexChunks(testChunks);
        
        // Verify chunks were indexed
        const retrievedChunks = await vectorStore.getChunksByIds(['chunk-1', 'chunk-2', 'chunk-3']);
        assert.strictEqual(retrievedChunks.length, 3);
        
        // Verify embeddings were generated
        for (const chunk of retrievedChunks) {
            assert.ok(chunk.vector);
            assert.strictEqual(chunk.vector.length, 384); // MiniLM-L6-v2 dimension
            assert.ok(chunk.vector.some(val => val !== 0)); // Should have non-zero values
        }
    });

    test('Should search for similar chunks', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        await vectorStore.indexChunks(testChunks);
        
        // Search for function-related content
        const results = await vectorStore.search('calculate sum of numbers', {
            limit: 5,
            minScore: 0.1
        });
        
        assert.ok(results.length > 0);
        
        // The calculateTotal function should be most relevant
        const topResult = results[0];
        assert.ok(topResult.chunk.text.includes('calculateTotal'));
        assert.ok(topResult.score > 0);
        assert.ok(topResult.explanation);
        assert.ok(topResult.explanation.textSnippet);
    });

    test('Should search with language filter', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        await vectorStore.indexChunks(testChunks);
        
        // Search only in TypeScript files
        const results = await vectorStore.search('data processing', {
            filters: { languages: ['typescript'] },
            limit: 5
        });
        
        // Should only return TypeScript chunks
        for (const result of results) {
            assert.strictEqual(result.chunk.language, 'typescript');
        }
        
        // Should find the DataProcessor class
        const hasDataProcessor = results.some(r => r.chunk.text.includes('DataProcessor'));
        assert.ok(hasDataProcessor);
    });

    test('Should search with type filter', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        await vectorStore.indexChunks(testChunks);
        
        // Search only for functions
        const results = await vectorStore.search('function', {
            filters: { types: ['function'] },
            limit: 5
        });
        
        // Should only return function chunks
        for (const result of results) {
            assert.strictEqual(result.chunk.type, 'code-function');
        }
    });

    test('Should search with path filter', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        await vectorStore.indexChunks(testChunks);
        
        // Search only in specific path
        const results = await vectorStore.search('processing', {
            filters: { paths: ['/test/file2'] },
            limit: 5
        });
        
        // Should only return chunks from file2.md
        for (const result of results) {
            assert.ok(result.chunk.path.includes('/test/file2'));
        }
    });

    test('Should apply minimum score threshold', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        await vectorStore.indexChunks(testChunks);
        
        // Search with high threshold
        const highThresholdResults = await vectorStore.search('completely unrelated topic xyz', {
            minScore: 0.8,
            limit: 10
        });
        
        // Should return fewer or no results
        assert.ok(highThresholdResults.length <= 1);
        
        // Search with low threshold
        const lowThresholdResults = await vectorStore.search('data', {
            minScore: 0.1,
            limit: 10
        });
        
        // Should return more results
        assert.ok(lowThresholdResults.length > 0);
        
        // All results should meet threshold
        for (const result of lowThresholdResults) {
            assert.ok(result.score >= 0.1);
        }
    });

    test('Should get chunks by IDs', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        await vectorStore.indexChunks(testChunks);
        
        // Get specific chunks
        const chunks = await vectorStore.getChunksByIds(['chunk-1', 'chunk-3']);
        
        assert.strictEqual(chunks.length, 2);
        
        const chunk1 = chunks.find(c => c.id === 'chunk-1');
        const chunk3 = chunks.find(c => c.id === 'chunk-3');
        
        assert.ok(chunk1);
        assert.ok(chunk3);
        assert.ok(chunk1.text.includes('calculateTotal'));
        assert.ok(chunk3.text.includes('DataProcessor'));
    });

    test('Should delete chunks', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        await vectorStore.indexChunks(testChunks);
        
        // Verify chunks exist
        let chunks = await vectorStore.getChunksByIds(['chunk-1', 'chunk-2', 'chunk-3']);
        assert.strictEqual(chunks.length, 3);
        
        // Delete one chunk
        await vectorStore.deleteChunks(['chunk-2']);
        
        // Verify chunk was deleted
        chunks = await vectorStore.getChunksByIds(['chunk-1', 'chunk-2', 'chunk-3']);
        assert.strictEqual(chunks.length, 2);
        
        const deletedChunk = chunks.find(c => c.id === 'chunk-2');
        assert.strictEqual(deletedChunk, undefined);
    });

    test('Should handle empty searches gracefully', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        
        // Search with no indexed data
        const results = await vectorStore.search('anything');
        assert.strictEqual(results.length, 0);
        
        // Index data and search for non-existent content
        await vectorStore.indexChunks(testChunks);
        const noMatchResults = await vectorStore.search('completely unrelated quantum physics', {
            minScore: 0.9
        });
        
        // Should handle gracefully
        assert.ok(Array.isArray(noMatchResults));
    });

    test('Should provide meaningful search explanations', async function() {
        this.timeout(60000);

        await vectorStore.initialize();
        await vectorStore.indexChunks(testChunks);
        
        const results = await vectorStore.search('calculate prices');
        
        assert.ok(results.length > 0);
        
        const topResult = results[0];
        assert.ok(topResult.explanation);
        assert.ok(topResult.explanation.textSnippet);
        assert.ok(topResult.explanation.textSnippet.length > 0);
        
        // Should include relevant text snippet
        assert.ok(topResult.explanation.textSnippet.includes('calculate') || 
                 topResult.explanation.textSnippet.includes('price'));
    });
});
