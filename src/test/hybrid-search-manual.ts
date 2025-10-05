import * as path from 'path';
import * as fs from 'fs';
import { HybridSearchPipeline, SearchQuery } from '../query/hybrid-search';
import { LanceDBStore } from '../store/lancedb';
import { EmbeddingService } from '../core/embeddings';
import { LightGraphService } from '../core/lightgraph';

async function testHybridSearchPipeline() {
  console.log('🚀 Testing Hybrid Search Pipeline...');

  try {
    // 1. Criar diretório temporário para testes
    const testDir = path.join(__dirname, '../../test-temp-search');
    await fs.promises.mkdir(testDir, { recursive: true });

    // 2. Configurar serviços
    const dbPath = path.join(testDir, 'test-lancedb');
    const lancedb = new LanceDBStore({ 
      dbPath,
      vectorDimension: 384,
      writeMode: 'append',
      indexConfig: {
        metric: 'cosine',
        indexType: 'HNSW',
        m: 16,
        efConstruction: 200
      }
    });

    const embeddings = new EmbeddingService();
    await embeddings.initialize();
    console.log('✅ EmbeddingService initialized');

    const lightgraph = new LightGraphService(lancedb, embeddings);
    
    // 3. Criar HybridSearchPipeline
    const searchPipeline = new HybridSearchPipeline(
      lancedb,
      embeddings,
      lightgraph,
      {
        defaultMaxResults: 10,
        defaultExpandHops: 1,
        defaultVectorWeight: 0.6,
        defaultGraphWeight: 0.3,
        defaultFreshnessWeight: 0.1,
        vectorSearchTopK: 20,
        enableQueryExpansion: true,
        cacheResultsMinutes: 5
      }
    );

    console.log('✅ HybridSearchPipeline created');

    // 4. Teste 1: Busca simples
    console.log('\n📊 Test 1: Simple search...');
    const query1: SearchQuery = {
      text: 'function implementation typescript',
      options: {
        maxResults: 5,
        expandHops: 0, // Apenas busca vetorial
        includeGraph: false
      }
    };

    const results1 = await searchPipeline.search(query1);
    console.log('✅ Simple search completed');
    console.log(`- Results found: ${results1.results.length}`);
    console.log(`- Vector matches: ${results1.stats.vectorMatches}`);
    console.log(`- Processing time: ${results1.stats.processingTime}ms`);
    console.log(`- Query cached: ${results1.stats.query.text}`);

    // 5. Teste 2: Busca com expansão de grafo
    console.log('\n📊 Test 2: Search with graph expansion...');
    const query2: SearchQuery = {
      text: 'async await error handling',
      filters: {
        languages: ['typescript', 'javascript'],
        paths: ['src/']
      },
      options: {
        maxResults: 10,
        expandHops: 1, // Com expansão de grafo
        includeGraph: true,
        vectorWeight: 0.5,
        graphWeight: 0.4,
        freshnessWeight: 0.1
      }
    };

    const results2 = await searchPipeline.search(query2);
    console.log('✅ Graph expansion search completed');
    console.log(`- Results found: ${results2.results.length}`);
    console.log(`- Vector matches: ${results2.stats.vectorMatches}`);
    console.log(`- Graph expansions: ${results2.stats.graphExpansions}`);
    console.log(`- Processing time: ${results2.stats.processingTime}ms`);
    
    if (results2.graph) {
      console.log(`- Graph nodes: ${results2.graph.nodes.length}`);
      console.log(`- Graph edges: ${results2.graph.edges.length}`);
      console.log(`- Connected components: ${results2.graph.subgraphStats.connectedComponents}`);
    }

    // 6. Teste 3: Busca com filtros
    console.log('\n📊 Test 3: Search with filters...');
    const query3: SearchQuery = {
      text: 'class interface definition',
      filters: {
        languages: ['typescript'],
        dateRange: {
          from: '2025-01-01T00:00:00.000Z',
          to: '2025-12-31T23:59:59.999Z'
        }
      },
      options: {
        maxResults: 15,
        minScore: 0.2
      }
    };

    const results3 = await searchPipeline.search(query3);
    console.log('✅ Filtered search completed');
    console.log(`- Results found: ${results3.results.length}`);
    console.log(`- Processing time: ${results3.stats.processingTime}ms`);

    // 7. Teste 4: Cache hit
    console.log('\n📊 Test 4: Cache hit test...');
    const cachedResults = await searchPipeline.search(query1); // Mesmo query do teste 1
    console.log('✅ Cached search completed');
    console.log(`- Cache hit (should be faster): ${cachedResults.stats.processingTime}ms`);

    // 8. Teste de estatísticas
    console.log('\n📊 Cache statistics:');
    const cacheStats = searchPipeline.getCacheStats();
    console.log(`- Cache size: ${cacheStats.size} entries`);
    console.log(`- Oldest entry age: ${cacheStats.oldestAge.toFixed(2)} minutes`);

    // 9. Limpar cache
    searchPipeline.clearCache();
    console.log('🧹 Cache cleared');

    // 10. Teste de exemplo de resultado
    if (results2.results.length > 0) {
      console.log('\n📄 Example search result:');
      const example = results2.results[0];
      console.log(`- Chunk ID: ${example.chunk.id.substring(0, 20)}...`);
      console.log(`- Path: ${example.chunk.path}`);
      console.log(`- Language: ${example.chunk.language}`);
      console.log(`- Lines: ${example.chunk.startLine}-${example.chunk.endLine}`);
      console.log(`- Score: ${example.score.toFixed(4)}`);
      console.log(`- Vector score: ${example.explanation.vectorScore.toFixed(4)}`);
      console.log(`- Graph score: ${example.explanation.graphScore.toFixed(4)}`);
      console.log(`- Freshness score: ${example.explanation.freshnessScore.toFixed(4)}`);
      console.log(`- Keyword overlap: ${(example.explanation.keywordOverlap * 100).toFixed(1)}%`);
      console.log(`- Why relevant: ${example.explanation.whyRelevant}`);
    }

    // 11. Limpeza
    await fs.promises.rm(testDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up test directory');

    console.log('\n✅ HybridSearchPipeline test completed successfully!');

  } catch (error) {
    console.error('❌ HybridSearchPipeline test failed:', error);
    process.exit(1);
  }
}

// Executar teste
if (require.main === module) {
  testHybridSearchPipeline();
}
