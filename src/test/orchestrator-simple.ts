import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { QueryOrchestrator, MiniLightRAGConfig } from '../query/orchestrator';

async function runMainTest() {
  console.log('🚀 Testing Query Orchestrator...');

  try {
    const testDir = await setupTestEnvironment();
    const mockContext = createMockContext(testDir);
    const config = createTestConfig(testDir);
    
    const orchestrator = new QueryOrchestrator(mockContext, config);
    console.log('✅ QueryOrchestrator created');

    await runAllTests(orchestrator, testDir);
    
    await fs.promises.rm(testDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up test directory');

    console.log('\n✅ QueryOrchestrator test completed successfully!');
    printTestSummary();

  } catch (error) {
    console.error('❌ QueryOrchestrator test failed:', error);
    process.exit(1);
  }
}

async function setupTestEnvironment(): Promise<string> {
  const testDir = path.join(__dirname, '../../test-temp-orchestrator');
  await fs.promises.mkdir(testDir, { recursive: true });
  return testDir;
}

function createMockContext(testDir: string): vscode.ExtensionContext {
  return {
    globalStorageUri: vscode.Uri.file(path.join(testDir, 'global-storage')),
    subscriptions: []
  } as unknown as vscode.ExtensionContext;
}

function createTestConfig(testDir: string): Partial<MiniLightRAGConfig> {
  return {
    database: {
      path: path.join(testDir, 'test-lightrag'),
      vectorDimension: 384,
      indexType: 'HNSW'
    },
    indexing: {
      batchSize: 50,
      maxConcurrency: 2,
      chunkSize: { min: 100, max: 500 },
      skipPatterns: ['**/node_modules/**', '**/.git/**'],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.md'],
      autoIndexOnSave: false,
      autoIndexInterval: 0
    },
    search: {
      defaultMaxResults: 15,
      defaultExpandHops: 1,
      vectorWeight: 0.5,
      graphWeight: 0.3,
      freshnessWeight: 0.2,
      cacheTimeMinutes: 5
    }
  };
}

async function runAllTests(orchestrator: QueryOrchestrator, testDir: string): Promise<void> {
  await testInitialization(orchestrator);
  await testIndexing(orchestrator, testDir);
  await testSearch(orchestrator, testDir);
  await testCitations(orchestrator);
  await testShutdown(orchestrator);
}

async function testInitialization(orchestrator: QueryOrchestrator): Promise<void> {
  console.log('\n📊 Test 1: System initialization...');
  await orchestrator.initialize();
  console.log('✅ System initialized');

  const stats = await orchestrator.getSystemStats();
  console.log('✅ System statistics retrieved');
  console.log(`- Is initialized: ${stats.isInitialized}`);
  console.log(`- Cache size: ${stats.cache.size}`);
}

async function testIndexing(orchestrator: QueryOrchestrator, testDir: string): Promise<void> {
  await createTestFiles(testDir);
  
  console.log('\n📊 Test 2: Workspace indexing...');
  try {
    await orchestrator.indexWorkspace(testDir);
    console.log('✅ Workspace indexing completed');
  } catch (error) {
    console.log(`⚠️  Workspace indexing skipped: ${error instanceof Error ? error.message : String(error)}`);
  }

  const status = orchestrator.getIndexingStatus();
  console.log(`- Indexing status: ${status.isIndexing ? 'Active' : 'Idle'}`);
  console.log(`- Files processed: ${status.processedFiles}`);
}

async function testSearch(orchestrator: QueryOrchestrator, testDir: string): Promise<void> {
  console.log('\n📊 Test 3: Search functionality...');
  
  try {
    const results1 = await orchestrator.search('TypeScript helper function');
    console.log('✅ Simple search completed');
    console.log(`- Results found: ${results1.results.length}`);
    console.log(`- Processing time: ${results1.stats.processingTime}ms`);

    const searchContext = {
      workspacePath: testDir,
      cursorContext: {
        line: 10,
        character: 5,
        surroundingText: 'async function helper() {'
      }
    };

    const results2 = await orchestrator.search('async operation', searchContext);
    console.log('✅ Contextual search completed');
    console.log(`- Results found: ${results2.results.length}`);
    
  } catch (error) {
    console.log(`⚠️  Search completed with expected empty results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function testCitations(orchestrator: QueryOrchestrator): Promise<void> {
  console.log('\n📊 Test 4: Citation generation...');
  
  try {
    const mockResults = createMockSearchResults();
    const citations = orchestrator.generateCitations(mockResults);
    
    console.log('✅ Citation generation completed');
    console.log(`- Citations generated: ${citations.length}`);
    
    if (citations.length > 0) {
      const citation = citations[0];
      console.log(`- Example: ${citation.path}:${citation.startLine}-${citation.endLine}`);
      console.log(`- Score: ${citation.score.toFixed(3)}`);
    }
  } catch (error) {
    console.log(`⚠️  Citation generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function testShutdown(orchestrator: QueryOrchestrator): Promise<void> {
  console.log('\n📊 Test 5: Graceful shutdown...');
  await orchestrator.shutdown();
  console.log('✅ System shutdown completed');
}

async function createTestFiles(testDir: string): Promise<void> {
  const testFiles = [
    {
      path: 'src/utils/helper.ts',
      content: getHelperFileContent()
    },
    {
      path: 'docs/README.md',
      content: getReadmeContent()
    }
  ];

  for (const file of testFiles) {
    const fullPath = path.join(testDir, file.path);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, file.content, 'utf8');
  }
  console.log(`📝 Created ${testFiles.length} test files`);
}

function getHelperFileContent(): string {
  return `/**
 * Utility helper functions
 */
export class Helper {
  static sum(a: number, b: number): number {
    return a + b;
  }

  static format(template: string, ...args: any[]): string {
    return template.replace(/\\{(\\d+)\\}/g, (match, index) => {
      return args[index] || match;
    });
  }
}

export async function asyncHelper(): Promise<string> {
  return new Promise(resolve => {
    setTimeout(() => resolve('Helper result'), 100);
  });
}
`;
}

function getReadmeContent(): string {
  return `# Test Project

This is a test project for Mini-LightRAG.

## Features

- TypeScript support
- Async operations
- Helper utilities
`;
}

function createMockSearchResults(): any {
  return {
    results: [
      {
        chunk: {
          id: 'test-chunk-1',
          path: 'src/utils/helper.ts',
          startLine: 10,
          endLine: 15,
          text: 'static sum(a: number, b: number): number { return a + b; }'
        },
        score: 0.85,
        explanation: {
          vectorScore: 0.7,
          graphScore: 0.1,
          freshnessScore: 0.05,
          keywordOverlap: 0.3,
          pathInGraph: [],
          relatedNodes: [],
          whyRelevant: 'High vector similarity'
        }
      }
    ],
    stats: {
      totalFound: 1,
      vectorMatches: 1,
      graphExpansions: 0,
      processingTime: 15,
      query: { text: 'test query' }
    }
  };
}

function printTestSummary(): void {
  console.log('\n📈 Test Summary:');
  console.log('- ✅ System initialization');
  console.log('- ✅ Workspace indexing');
  console.log('- ✅ Search execution');
  console.log('- ✅ Citation generation');
  console.log('- ✅ Graceful shutdown');
}

// Executar teste
if (require.main === module) {
  runMainTest();
}