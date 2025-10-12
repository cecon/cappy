/**
 * Test script for parsers
 */

import { createParserService } from './src/services/parser-service';
import * as path from 'path';

async function test() {
  console.log('🧪 Testing Parsers...\n');
  
  const parserService = createParserService();
  const workspaceRoot = process.cwd();
  
  // Test TypeScript parser
  console.log('📝 Testing TypeScript Parser:');
  console.log('═'.repeat(50));
  const tsFile = path.join(workspaceRoot, '.test-sample.ts');
  const tsChunks = await parserService.parseFile(tsFile);
  console.log(`\n✅ TypeScript: Found ${tsChunks.length} JSDoc chunks\n`);
  
  tsChunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}:`);
    console.log(`  ID: ${chunk.id}`);
    console.log(`  Symbol: ${chunk.metadata.symbolName} (${chunk.metadata.symbolKind})`);
    console.log(`  Lines: ${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}`);
    console.log(`  Content preview: ${chunk.content.substring(0, 100)}...`);
    console.log('');
  });
  
  // Test Markdown parser
  console.log('\n📝 Testing Markdown Parser:');
  console.log('═'.repeat(50));
  const mdFile = path.join(workspaceRoot, '.test-sample.md');
  const mdChunks = await parserService.parseFile(mdFile);
  console.log(`\n✅ Markdown: Found ${mdChunks.length} sections\n`);
  
  mdChunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}:`);
    console.log(`  ID: ${chunk.id}`);
    console.log(`  Heading: ${chunk.metadata.heading} (Level ${chunk.metadata.headingLevel})`);
    console.log(`  Lines: ${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}`);
    console.log(`  Content preview: ${chunk.content.substring(0, 100)}...`);
    console.log('');
  });
  
  console.log('\n🎉 Parser tests completed!');
}

test().catch(console.error);
