import { LightGraphService, DEFAULT_GRAPH_CONFIG } from '../core/lightgraph';
import { LanceDBStore } from '../store/lancedb';
import { EmbeddingService } from '../core/embeddings';
import { Chunk } from '../core/schemas';
import * as path from 'path';

async function testLightGraph() {
    console.log('🧪 Testing LightGraph Service...');
    
    try {
        // Create test directory
        const testDir = path.join(__dirname, '..', '..', 'test-workspace', 'lightgraph-test');
        
        // Initialize services
        const lancedbStore = new LanceDBStore();
        lancedbStore.setDbPath(path.join(testDir, 'lancedb'));
        
        const embeddingService = new EmbeddingService();
        embeddingService.setCacheDir(path.join(testDir, 'models'));
        
        const lightGraphService = new LightGraphService(lancedbStore, embeddingService, {
            ...DEFAULT_GRAPH_CONFIG,
            similarityThreshold: 0.1, // Lower threshold for testing
            maxEdgesPerNode: 5
        });
        
        console.log('🔄 Initializing LightGraph...');
        await lightGraphService.initialize();
        
        // Create test chunks with embeddings
        const testChunks: Chunk[] = [
            {
                id: 'chunk-function-1',
                path: '/test/math.ts',
                language: 'typescript',
                type: 'code-function',
                textHash: 'hash1',
                text: 'function add(a: number, b: number): number { return a + b; }',
                startLine: 1,
                endLine: 1,
                keywords: ['function', 'add', 'number', 'math'],
                metadata: { complexity: 1 },
                vector: [], // Will be generated
                updatedAt: new Date().toISOString(),
                version: 1
            },
            {
                id: 'chunk-function-2',
                path: '/test/math.ts',
                language: 'typescript',
                type: 'code-function',
                textHash: 'hash2',
                text: 'function multiply(x: number, y: number): number { return x * y; }',
                startLine: 3,
                endLine: 3,
                keywords: ['function', 'multiply', 'number', 'math'],
                metadata: { complexity: 1 },
                vector: [],
                updatedAt: new Date().toISOString(),
                version: 1
            },
            {
                id: 'chunk-class-1',
                path: '/test/calculator.ts',
                language: 'typescript',
                type: 'code-class',
                textHash: 'hash3',
                text: 'class Calculator { calculate(operation: string, a: number, b: number): number { /* impl */ } }',
                startLine: 1,
                endLine: 3,
                keywords: ['class', 'calculator', 'calculate', 'operation'],
                metadata: { complexity: 2 },
                vector: [],
                updatedAt: new Date().toISOString(),
                version: 1
            },
            {
                id: 'chunk-doc-1',
                path: '/test/README.md',
                language: 'markdown',
                type: 'markdown-section',
                textHash: 'hash4',
                text: '# Math Library\n\nThis library provides basic mathematical operations like addition and multiplication.',
                startLine: 1,
                endLine: 3,
                keywords: ['math', 'library', 'addition', 'multiplication', 'operations'],
                metadata: { complexity: 1 },
                vector: [],
                updatedAt: new Date().toISOString(),
                version: 1
            }
        ];
        
        // Generate embeddings for chunks first
        console.log('🧠 Generating embeddings for test chunks...');
        for (const chunk of testChunks) {
            const embedding = await embeddingService.embed(chunk.text);
            chunk.vector = embedding;
        }
        
        console.log('🔗 Building graph from test chunks...');
        const { nodes, edges } = await lightGraphService.buildGraph(testChunks);
        
        console.log(`📊 Graph structure:`);
        console.log(`  - Nodes: ${nodes.length}`);
        console.log(`  - Edges: ${edges.length}`);
        
        // Log node details
        console.log('\n📍 Nodes:');
        nodes.forEach(node => {
            console.log(`  - ${node.id}: ${node.label} (${node.type})`);
        });
        
        // Log edge details
        console.log('\n🔗 Edges:');
        edges.forEach(edge => {
            console.log(`  - ${edge.sourceId} → ${edge.targetId} (${edge.type}, weight: ${edge.weight.toFixed(3)})`);
        });
        
        console.log('\n💾 Saving graph to LanceDB...');
        await lightGraphService.saveGraph(nodes, edges);
        
        console.log('📥 Loading graph from LanceDB...');
        const { nodes: loadedNodes, edges: loadedEdges } = await lightGraphService.loadGraph();
        console.log(`✅ Loaded: ${loadedNodes.length} nodes, ${loadedEdges.length} edges`);
        
        console.log('📈 Analyzing graph structure...');
        const analysis = await lightGraphService.analyzeGraph();
        console.log('🔍 Graph Analysis:', JSON.stringify(analysis, null, 2));
        
        console.log('🎉 LightGraph test completed successfully!');
        
        return true;
        
    } catch (error) {
        console.error('❌ LightGraph test failed:', error);
        return false;
    }
}

// Run test if called directly
if (require.main === module) {
    testLightGraph().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { testLightGraph };
