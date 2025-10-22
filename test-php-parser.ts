/**
 * Test script for PHP parser
 */

import { createPHPParser } from './src/adapters/secondary/parsers/php-parser';
import * as path from 'path';

async function testPHPParser() {
  console.log('🧪 Testing PHP Parser...\n');

  const parser = createPHPParser();
  const testFile = path.join(__dirname, 'test-samples', 'test-php-parser.php');

  try {
    const chunks = await parser.parseFile(testFile);

    console.log(`✅ Parsed ${chunks.length} PHPDoc chunks\n`);

    // Display each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Chunk ${i + 1}/${chunks.length}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`ID: ${chunk.id}`);
      console.log(`Symbol: ${chunk.metadata.symbolName}`);
      console.log(`Kind: ${chunk.metadata.symbolKind}`);
      if (chunk.metadata.visibility) {
        console.log(`Visibility: ${chunk.metadata.visibility}`);
      }
      console.log(`Lines: ${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}`);
      console.log(`\nContent:\n${chunk.content}`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ PHP Parser test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testPHPParser();
