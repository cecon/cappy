#!/usr/bin/env node
/**
 * @fileoverview Standalone test for Word document parsing (without entity extraction)
 * Tests the Word parsing capability independently
 * @author Cappy Team
 * @since 3.1.0
 */

import mammoth from 'mammoth';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Simulates chunk extraction with overlap
 */
function extractChunksWithOverlap(
  filePath: string,
  content: string,
  maxTokens: number,
  overlapTokens: number
): Array<{id: string; content: string; lineStart: number; lineEnd: number}> {
  const chunks: Array<{id: string; content: string; lineStart: number; lineEnd: number}> = [];
  const lines = content.split('\n');
  const tokensPerLine = 15; // Rough estimate
  
  const linesPerChunk = Math.floor(maxTokens / tokensPerLine);
  const overlapLines = Math.floor(overlapTokens / tokensPerLine);
  
  let lineIndex = 0;
  let chunkNumber = 0;
  
  while (lineIndex < lines.length) {
    const endLine = Math.min(lineIndex + linesPerChunk, lines.length);
    const chunkLines = lines.slice(lineIndex, endLine);
    const chunkContent = chunkLines.join('\n').trim();
    
    if (chunkContent.length > 0) {
      const fileName = path.basename(filePath);
      const chunkId = `chunk:${fileName}:${chunkNumber}:${lineIndex + 1}-${endLine}`;
      
      chunks.push({
        id: chunkId,
        content: chunkContent,
        lineStart: lineIndex + 1,
        lineEnd: endLine
      });
      
      chunkNumber++;
    }
    
    lineIndex += linesPerChunk - overlapLines;
    
    if (lineIndex < lines.length && lineIndex + linesPerChunk <= endLine) {
      lineIndex = endLine;
    }
  }
  
  return chunks;
}

/**
 * Tests Word document parsing
 */
async function testWordParsing() {
  console.log('🧪 Testing Word Document Parsing (Standalone)\n');
  console.log('=' .repeat(70));

  // Look for Word documents in the workspace
  const possibleLocations = [
    'docs',
    'test-samples',
    '.'
  ];

  const wordFiles: string[] = [];

  for (const location of possibleLocations) {
    const dirPath = path.join(process.cwd(), location);
    
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.docx') || file.endsWith('.doc')) {
          wordFiles.push(path.join(dirPath, file));
        }
      }
    }
  }

  if (wordFiles.length === 0) {
    console.log('\n⚠️  No Word documents found in workspace');
    console.log('📝 Testing with sample content...\n');
    
    const sampleContent = `API Authentication Guide

Overview
This document describes the authentication system for our API.

Technologies Used
Our authentication system uses the following technologies:
- JWT (JSON Web Tokens) for stateless authentication
- Express middleware for request handling
- bcrypt for password hashing
- Redis for session storage

Implementation
The UserService class handles all authentication logic. It implements the following methods:

- authenticate(username, password): validates credentials
- generateToken(userId): creates a JWT token
- verifyToken(token): validates and decodes tokens

Security Considerations
The AuthenticationMiddleware intercepts all requests and verifies the JWT token.
If the token is invalid or expired, the request is rejected with a 401 status.

Integration with Database
The UserRepository interface provides data access methods. It uses Prisma ORM
to interact with the PostgreSQL database.

Error Handling
All authentication errors are caught by the ErrorHandler class and logged
to the monitoring system using Winston logger.`;

    await testContent('sample-api-guide.docx', sampleContent);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Word document parsing test complete!\n');
    console.log('💡 To test entity extraction, run the test inside VS Code extension context');
    return;
  }

  // Process found Word documents
  for (const wordFile of wordFiles) {
    console.log(`\n📄 Processing: ${path.relative(process.cwd(), wordFile)}`);
    console.log('-'.repeat(70));

    try {
      const ext = path.extname(wordFile).toLowerCase();
      
      if (ext === '.doc') {
        console.warn(`⚠️ .doc format has limited support. Consider converting to .docx`);
      }

      // Read file
      const buffer = fs.readFileSync(wordFile);

      // Extract text using mammoth
      const result = await mammoth.extractRawText({ buffer });
      const wordContent = result.value;

      if (!wordContent || wordContent.trim().length === 0) {
        console.warn(`⚠️ No text content extracted from: ${wordFile}`);
        continue;
      }

      console.log(`   ✅ Extracted ${wordContent.length} characters from Word document`);

      await testContent(wordFile, wordContent);

    } catch (error) {
      console.error(`❌ Error processing ${wordFile}:`, error);
      
      if (error instanceof Error && error.message.includes('Unsupported file format')) {
        console.error(`   💡 Tip: Make sure the file is a valid .docx or .doc format`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Word document parsing test complete!\n');
  console.log('💡 To test entity extraction, run: npm run test:entity-extraction');
}

/**
 * Tests content chunking
 */
async function testContent(filePath: string, content: string) {
  const chunks = extractChunksWithOverlap(filePath, content, 512, 100);

  console.log(`\n✅ Extracted ${chunks.length} chunks\n`);

  // Display first few chunks
  for (const [index, chunk] of chunks.slice(0, 3).entries()) {
    console.log(`📦 Chunk ${index + 1}:`);
    console.log(`   Lines: ${chunk.lineStart}-${chunk.lineEnd}`);
    console.log(`   Length: ${chunk.content.length} characters`);
    console.log(`   Preview: ${chunk.content.substring(0, 150)}...`);
    console.log();
  }

  if (chunks.length > 3) {
    console.log(`   ... and ${chunks.length - 3} more chunks\n`);
  }

  // Summary
  const totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0);
  const avgCharsPerChunk = Math.round(totalChars / chunks.length);

  console.log(`📊 Summary for ${path.basename(filePath)}:`);
  console.log(`   Total chunks: ${chunks.length}`);
  console.log(`   Total characters: ${totalChars}`);
  console.log(`   Average chars per chunk: ${avgCharsPerChunk}`);
  console.log(`   Lines processed: ${chunks[chunks.length - 1]?.lineEnd || 0}`);
}

// Run test
testWordParsing().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
