/**
 * Test script for PDF parser
 */

import { createDocumentEnhancedParser } from './src/adapters/secondary/parsers/document-enhanced-parser';
import * as path from 'path';

async function testPDFParser() {
  console.log('🧪 Testing PDF Parser...\n');

  const parser = createDocumentEnhancedParser();
  
  // You can test with a sample PDF file
  // Replace with an actual PDF path in your workspace
  const testPdfPath = path.join(__dirname, 'test-samples', 'sample.pdf');
  
  console.log(`📄 Testing with: ${testPdfPath}\n`);

  try {
    const chunks = await parser.parseFile(testPdfPath, true);
    
    console.log(`\n✅ Success! Extracted ${chunks.length} chunks`);
    
    if (chunks.length > 0) {
      console.log('\n📊 First chunk preview:');
      console.log('  ID:', chunks[0].id);
      console.log('  Content length:', chunks[0].content.length);
      console.log('  Metadata:', JSON.stringify(chunks[0].metadata, null, 2));
      
      if (chunks[0].content.length > 200) {
        console.log('  Preview:', chunks[0].content.substring(0, 200) + '...');
      } else {
        console.log('  Content:', chunks[0].content);
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPDFParser().catch(console.error);
