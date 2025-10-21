/**
 * @fileoverview Example usage of DocumentEnhancedParser with PDF support
 * @module examples/pdf-parser-example
 */

import { createDocumentEnhancedParser, DocumentEnhancedParser } from '../adapters/secondary/parsers/document-enhanced-parser';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Example 1: Parse a PDF file with entity extraction
 */
async function example1_ParsePDFWithEntities() {
  console.log('\n📘 Example 1: Parse PDF with Entity Extraction\n');
  
  const parser = createDocumentEnhancedParser();
  const pdfPath = path.join(__dirname, '../test-samples/sample.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.log(`⚠️ Sample PDF not found: ${pdfPath}`);
    console.log('   Create a sample.pdf file in test-samples/ to run this example');
    return;
  }
  
  try {
    const chunks = await parser.parseFile(pdfPath, true);
    
    console.log(`✅ Successfully parsed PDF`);
    console.log(`   📊 Total chunks: ${chunks.length}`);
    
    if (chunks.length > 0) {
      console.log(`\n   First chunk details:`);
      console.log(`   - ID: ${chunks[0].id}`);
      console.log(`   - Content length: ${chunks[0].content.length} chars`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log(`   - PDF Pages: ${(chunks[0].metadata as any).pdfPages}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log(`   - PDF Title: ${(chunks[0].metadata as any).pdfInfo?.title || 'N/A'}`);
      console.log(`   - Entities found: ${chunks[0].metadata.entities?.length || 0}`);
      
      if (chunks[0].metadata.entities && chunks[0].metadata.entities.length > 0) {
        console.log(`   - Sample entities: ${chunks[0].metadata.entities.slice(0, 5).join(', ')}`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example 2: Parse multiple documents (PDF, Word, Markdown)
 */
async function example2_ParseMultipleFormats() {
  console.log('\n📚 Example 2: Parse Multiple Document Formats\n');
  
  const parser = createDocumentEnhancedParser();
  const testFiles = [
    '../test-samples/sample.pdf',
    '../test-samples/sample.docx',
    '../test-samples/sample.md',
  ];
  
  for (const file of testFiles) {
    const filePath = path.join(__dirname, file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⏭️  Skipping ${path.basename(file)} (not found)`);
      continue;
    }
    
    try {
      const ext = path.extname(file);
      console.log(`\n📄 Processing ${path.basename(file)} (${ext})...`);
      
      const chunks = await parser.parseFile(filePath, false); // No entity extraction for speed
      
      console.log(`   ✅ ${chunks.length} chunks extracted`);
      
      if (chunks.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalChars = chunks.reduce((sum: number, chunk: any) => sum + chunk.content.length, 0);
        console.log(`   📝 Total characters: ${totalChars.toLocaleString()}`);
        console.log(`   📊 Avg chunk size: ${Math.round(totalChars / chunks.length)} chars`);
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
    }
  }
}

/**
 * Example 3: Check if files are supported
 */
function example3_CheckSupportedFiles() {
  console.log('\n🔍 Example 3: Check File Support\n');
  
  const testPaths = [
    'document.pdf',
    'document.docx',
    'document.doc',
    'document.md',
    'document.txt',
    'document.xlsx',
    'image.png'
  ];
  
  console.log('Checking file support:');
  
  for (const file of testPaths) {
    const isSupported = DocumentEnhancedParser.isSupported(file);
    const icon = isSupported ? '✅' : '❌';
    console.log(`   ${icon} ${file}`);
  }
  
  console.log(`\n📋 Supported extensions:`);
  const extensions = DocumentEnhancedParser.getSupportedExtensions();
  console.log(`   ${extensions.join(', ')}`);
}

/**
 * Example 4: Extract PDF metadata only
 */
async function example4_ExtractPDFMetadata() {
  console.log('\n📋 Example 4: Extract PDF Metadata\n');
  
  const parser = createDocumentEnhancedParser();
  const pdfPath = path.join(__dirname, '../test-samples/sample.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.log(`⚠️ Sample PDF not found: ${pdfPath}`);
    return;
  }
  
  try {
    // Parse without entity extraction for faster processing
    const chunks = await parser.parseFile(pdfPath, false);
    
    if (chunks.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata = chunks[0].metadata as any;
      
      console.log('📄 PDF Information:');
      console.log(`   Title: ${metadata.pdfInfo?.title || 'N/A'}`);
      console.log(`   Author: ${metadata.pdfInfo?.author || 'N/A'}`);
      console.log(`   Subject: ${metadata.pdfInfo?.subject || 'N/A'}`);
      console.log(`   Creator: ${metadata.pdfInfo?.creator || 'N/A'}`);
      console.log(`   Producer: ${metadata.pdfInfo?.producer || 'N/A'}`);
      console.log(`   Created: ${metadata.pdfInfo?.creationDate || 'N/A'}`);
      console.log(`   Modified: ${metadata.pdfInfo?.modDate || 'N/A'}`);
      console.log(`   Pages: ${metadata.pdfPages || 'N/A'}`);
      console.log(`   Chunks: ${chunks.length}`);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalChars = chunks.reduce((sum: number, chunk: any) => sum + chunk.content.length, 0);
      console.log(`   Total text: ${totalChars.toLocaleString()} characters`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 DocumentEnhancedParser - PDF Support Examples\n');
  console.log('='.repeat(60));
  
  // Run examples
  await example1_ParsePDFWithEntities();
  await example2_ParseMultipleFormats();
  example3_CheckSupportedFiles();
  await example4_ExtractPDFMetadata();
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ All examples completed!\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_ParsePDFWithEntities,
  example2_ParseMultipleFormats,
  example3_CheckSupportedFiles,
  example4_ExtractPDFMetadata
};
