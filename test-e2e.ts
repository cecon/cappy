/**
 * End-to-end test for the complete indexing pipeline
 */

import { createEmbeddingService } from './src/services/embedding-service';
import { createLanceDBAdapter } from './src/adapters/secondary/vector/lancedb-adapter';
import { createKuzuAdapter } from './src/adapters/secondary/graph/kuzu-adapter';
import { createIndexingService } from './src/services/indexing-service';
import { createParserService } from './src/services/parser-service';
import * as path from 'path';
import * as fs from 'fs';

async function testEndToEnd() {
  console.log('🧪 End-to-End Indexing Pipeline Test\n');
  console.log('═'.repeat(60));

  const workspaceRoot = process.cwd();
  const dataPath = path.join(workspaceRoot, '.cappy', 'data');

  try {
    // 1. Initialize services
    console.log('\n📦 Step 1: Initializing services...');
    console.log('─'.repeat(60));
    
    const embeddingService = createEmbeddingService();
    await embeddingService.initialize();
    console.log(`   Model: ${embeddingService.getInfo().model}`);
    console.log(`   Dimensions: ${embeddingService.getInfo().dimensions}`);

    const lancedbPath = path.join(dataPath, 'lancedb');
    const kuzuPath = path.join(dataPath, 'kuzu');
    
    const vectorStore = createLanceDBAdapter(lancedbPath, embeddingService);
    const graphStore = createKuzuAdapter(kuzuPath);
    
    await vectorStore.initialize();
    await graphStore.initialize();

    const indexingService = createIndexingService(vectorStore, graphStore, embeddingService);
    await indexingService.initialize();

    const parserService = createParserService();

    // 2. Parse test files
    console.log('\n📝 Step 2: Parsing test files...');
    console.log('─'.repeat(60));
    
    const tsFile = path.join(workspaceRoot, '.test-sample.ts');
    const mdFile = path.join(workspaceRoot, '.test-sample.md');

    const tsChunks = await parserService.parseFile(tsFile);
    const mdChunks = await parserService.parseFile(mdFile);

    console.log(`   TypeScript: ${tsChunks.length} chunks`);
    console.log(`   Markdown: ${mdChunks.length} chunks`);

    // 3. Index files
    console.log('\n📊 Step 3: Indexing files...');
    console.log('─'.repeat(60));
    
    await indexingService.indexFile(
      tsFile,
      parserService.getLanguage(tsFile),
      tsChunks
    );

    await indexingService.indexFile(
      mdFile,
      parserService.getLanguage(mdFile),
      mdChunks
    );

    // 4. Test hybrid search
    console.log('\n🔍 Step 4: Testing hybrid search...');
    console.log('─'.repeat(60));
    
    const searchQueries = [
      'How to calculate sum of numbers?',
      'What is a User interface?',
      'Markdown parsing implementation'
    ];

    for (const query of searchQueries) {
      console.log(`\n   Query: "${query}"`);
      const results = await indexingService.hybridSearch(query, 2);
      
      console.log(`   ├─ Direct matches: ${results.directMatches.length}`);
      if (results.directMatches.length > 0) {
        const top = results.directMatches[0];
        console.log(`   │  └─ Top result: ${top.metadata.filePath} (${top.metadata.symbolName || top.metadata.heading})`);
      }
      
      console.log(`   └─ Related chunks: ${results.relatedChunks.length}`);
    }

    // 5. Show statistics
    console.log('\n📈 Step 5: Statistics...');
    console.log('─'.repeat(60));
    
    if ('getStats' in graphStore && typeof graphStore.getStats === 'function') {
      const stats = graphStore.getStats();
      console.log(`   File nodes: ${stats.fileNodes}`);
      console.log(`   Chunk nodes: ${stats.chunkNodes}`);
      console.log(`   Relationships: ${stats.relationships}`);
    }

    // 6. Cleanup
    console.log('\n🧹 Step 6: Cleanup...');
    console.log('─'.repeat(60));
    
    await indexingService.close();
    console.log('   ✅ Services closed');

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 END-TO-END TEST COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Check if test files exist
const workspaceRoot = process.cwd();
const tsFile = path.join(workspaceRoot, '.test-sample.ts');
const mdFile = path.join(workspaceRoot, '.test-sample.md');

if (!fs.existsSync(tsFile) || !fs.existsSync(mdFile)) {
  console.error('❌ Test files not found. Please ensure .test-sample.ts and .test-sample.md exist.');
  process.exit(1);
}

testEndToEnd().catch(console.error);
