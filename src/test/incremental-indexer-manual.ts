import * as path from 'path';
import * as fs from 'fs';
import { IncrementalIndexer } from '../indexer/incremental-indexer';
import { LanceDBStore } from '../store/lancedb';
import { EmbeddingService } from '../core/embeddings';
import { ChunkingService } from '../core/chunking';
import { LightGraphService } from '../core/lightgraph';

async function testIncrementalIndexer() {
  console.log('🚀 Testing Incremental Indexer...');

  try {
    // 1. Criar diretório temporário para testes
    const testDir = path.join(__dirname, '../../test-temp');
    await fs.promises.mkdir(testDir, { recursive: true });

    // 2. Criar arquivo de teste
    const testFile = path.join(testDir, 'test.ts');
    const testContent = `/**
 * Test file for incremental indexing
 */
export class TestClass {
  private value: number = 0;

  /**
   * Get the current value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Set a new value
   */
  setValue(newValue: number): void {
    this.value = newValue;
  }

  /**
   * Calculate double of current value
   */
  double(): number {
    return this.value * 2;
  }
}

/**
 * Utility function to create a test instance
 */
export function createTestInstance(): TestClass {
  return new TestClass();
}

export default TestClass;
`;

    await fs.promises.writeFile(testFile, testContent, 'utf8');
    console.log(`📝 Created test file: ${testFile}`);

    // 3. Configurar serviços
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

    const chunking = new ChunkingService();
    console.log('✅ ChunkingService initialized');

    const lightgraph = new LightGraphService(lancedb, embeddings);
    console.log('✅ LightGraphService initialized');

    // 4. Criar IncrementalIndexer
    const indexer = new IncrementalIndexer(
      lancedb,
      embeddings,
      chunking,
      lightgraph,
      {
        batchSize: 10,
        maxConcurrency: 2,
        skipPatterns: ['node_modules'],
        includePatterns: ['*.ts'],
        chunkSize: { min: 200, max: 800 },
        enableTombstones: true,
        retentionDays: 7
      }
    );

    console.log('✅ IncrementalIndexer created');

    // 5. Executar indexação inicial
    console.log('\n📊 Running initial indexing...');
    const stats1 = await indexer.indexWorkspace(testDir);
    
    console.log('\n📈 Initial Indexing Stats:');
    console.log(`- Files scanned: ${stats1.filesScanned}`);
    console.log(`- Files modified: ${stats1.filesModified}`);
    console.log(`- Chunks added: ${stats1.chunksAdded}`);
    console.log(`- Chunks modified: ${stats1.chunksModified}`);
    console.log(`- Chunks removed: ${stats1.chunksRemoved}`);
    console.log(`- Duration: ${stats1.duration}ms`);
    console.log(`- Errors: ${stats1.errors.length}`);

    if (stats1.errors.length > 0) {
      console.log('❌ Errors:', stats1.errors);
    }

    // 6. Modificar arquivo e re-indexar
    const modifiedContent = testContent.replace(
      'private value: number = 0;',
      'private value: number = 42;'
    ) + `
/**
 * New method added for testing incremental indexing
 */
export function newTestFunction(): string {
  return 'This is a new function';
}
`;

    await fs.promises.writeFile(testFile, modifiedContent, 'utf8');
    console.log('\n🔄 Modified test file');

    // 7. Executar indexação incremental
    console.log('\n📊 Running incremental indexing...');
    const stats2 = await indexer.indexWorkspace(testDir);
    
    console.log('\n📈 Incremental Indexing Stats:');
    console.log(`- Files scanned: ${stats2.filesScanned}`);
    console.log(`- Files modified: ${stats2.filesModified}`);
    console.log(`- Chunks added: ${stats2.chunksAdded}`);
    console.log(`- Chunks modified: ${stats2.chunksModified}`);
    console.log(`- Chunks removed: ${stats2.chunksRemoved}`);
    console.log(`- Duration: ${stats2.duration}ms`);
    console.log(`- Errors: ${stats2.errors.length}`);

    // 8. Teste de detecção de não-mudança
    console.log('\n📊 Running no-change detection...');
    const stats3 = await indexer.indexWorkspace(testDir);
    
    console.log('\n📈 No-Change Detection Stats:');
    console.log(`- Files scanned: ${stats3.filesScanned}`);
    console.log(`- Files modified: ${stats3.filesModified}`);
    console.log(`- Should be 0 files modified: ${stats3.filesModified === 0 ? '✅' : '❌'}`);

    // 9. Limpeza
    await fs.promises.rm(testDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up test directory');

    console.log('\n✅ IncrementalIndexer test completed successfully!');

  } catch (error) {
    console.error('❌ IncrementalIndexer test failed:', error);
    process.exit(1);
  }
}

// Executar teste
if (require.main === module) {
  testIncrementalIndexer();
}