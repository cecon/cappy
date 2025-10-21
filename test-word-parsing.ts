#!/usr/bin/env node
/**
 * @fileoverview Test script for Word document parsing
 * @author Cappy Team
 * @since 3.1.0
 */

import { createDocumentEnhancedParser } from './src/adapters/secondary/parsers/document-enhanced-parser';
import type { DocumentChunk } from './src/types/chunk';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Tests Word document parsing and entity extraction
 */
async function testWordParsing() {
  console.log('🧪 Testing Word Document Parsing with Entity Extraction\n');
  console.log('=' .repeat(70));

  // Initialize parser
  const parser = createDocumentEnhancedParser();
  await parser.initialize();

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
    console.log('📝 Creating a sample Word document for testing...\n');
    
    // Create a sample markdown that simulates Word content
    const sampleContent = `# API Authentication Guide

## Overview

This document describes the authentication system for our API.

## Technologies Used

Our authentication system uses the following technologies:
- **JWT** (JSON Web Tokens) for stateless authentication
- **Express** middleware for request handling
- **bcrypt** for password hashing
- **Redis** for session storage

## Implementation

The UserService class handles all authentication logic. It implements the following methods:

- authenticate(username, password): validates credentials
- generateToken(userId): creates a JWT token
- verifyToken(token): validates and decodes tokens

## Security Considerations

The AuthenticationMiddleware intercepts all requests and verifies the JWT token. 
If the token is invalid or expired, the request is rejected with a 401 status.

## Integration with Database

The UserRepository interface provides data access methods. It uses Prisma ORM 
to interact with the PostgreSQL database.

## Error Handling

All authentication errors are caught by the ErrorHandler class and logged 
to the monitoring system using Winston logger.
`;

    console.log('📄 Sample content created (simulating Word document):\n');
    console.log(sampleContent.substring(0, 300) + '...\n');
    console.log('=' .repeat(70));
    
    // Parse the sample content as if it were from a Word document
    console.log('\n🔍 Testing with sample content...\n');
    
    const chunks = await parser['extractChunksWithOverlap'](
      'sample-api-guide.docx',
      sampleContent,
      512,
      100
    );

    // Enrich with entities
    await parser['enrichChunksWithEntities'](chunks);

    await displayResults('sample-api-guide.docx', chunks);
    
    return;
  }

  // Process found Word documents
  for (const wordFile of wordFiles) {
    console.log(`\n📄 Processing: ${path.relative(process.cwd(), wordFile)}`);
    console.log('-'.repeat(70));

    try {
      // Parse with entity extraction
      const chunks = await parser.parseFile(wordFile, true);

      await displayResults(wordFile, chunks);

    } catch (error) {
      console.error(`❌ Error processing ${wordFile}:`, error);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Word document parsing test complete!\n');
}

/**
 * Displays parsing results
 */
async function displayResults(filePath: string, chunks: DocumentChunk[]) {
  console.log(`\n✅ Extracted ${chunks.length} chunks\n`);

  // Analyze entities
  let displayedChunks = 0;
  for (const [index, chunk] of chunks.entries()) {
    const metadata = chunk.metadata;
    
    if (metadata.entities && metadata.entities.length > 0) {
      displayedChunks++;
      console.log(`\n📦 Chunk ${index + 1} (lines ${metadata.lineStart}-${metadata.lineEnd}):`);
      console.log(`   Content preview: ${chunk.content.substring(0, 100)}...`);
      console.log(`   Entities: ${metadata.entities.join(', ')}`);
      
      if (metadata.entityTypes) {
        console.log(`   Types:`);
        for (const [entity, type] of Object.entries(metadata.entityTypes)) {
          console.log(`      - ${entity}: ${type}`);
        }
      }
      
      if (metadata.relationships && metadata.relationships.length > 0) {
        console.log(`   Relationships:`);
        for (const rel of metadata.relationships.slice(0, 5)) {
          console.log(`      - ${rel.from} --[${rel.type}]--> ${rel.to} (confidence: ${rel.confidence.toFixed(2)})`);
        }
        if (metadata.relationships.length > 5) {
          console.log(`      ... and ${metadata.relationships.length - 5} more`);
        }
      }

      // Limit display to first 3 chunks with entities
      if (displayedChunks >= 3) {
        if (chunks.filter(c => c.metadata.entities && c.metadata.entities.length > 0).length > 3) {
          console.log(`\n   ... (showing first 3 chunks with entities)`);
        }
        break;
      }
    }
  }

  // Summary
  const allEntities = new Set<string>();
  const entityTypeCount: Record<string, number> = {};
  let totalRelationships = 0;

  for (const chunk of chunks) {
    const metadata = chunk.metadata;
    if (metadata.entities) {
      for (const entity of metadata.entities) {
        allEntities.add(entity);
      }
    }
    if (metadata.entityTypes) {
      for (const type of Object.values(metadata.entityTypes)) {
        entityTypeCount[type as string] = (entityTypeCount[type as string] || 0) + 1;
      }
    }
    if (metadata.relationships) {
      totalRelationships += metadata.relationships.length;
    }
  }

  console.log(`\n📊 Summary for ${path.basename(filePath)}:`);
  console.log(`   Total chunks: ${chunks.length}`);
  console.log(`   Chunks with entities: ${chunks.filter(c => c.metadata.entities && c.metadata.entities.length > 0).length}`);
  console.log(`   Total unique entities: ${allEntities.size}`);
  
  if (Object.keys(entityTypeCount).length > 0) {
    console.log(`   Entity types:`);
    for (const [type, count] of Object.entries(entityTypeCount).sort((a, b) => b[1] - a[1])) {
      console.log(`      - ${type}: ${count}`);
    }
  }
  
  console.log(`   Total relationships: ${totalRelationships}`);
  
  if (allEntities.size > 0) {
    const entityList = Array.from(allEntities).slice(0, 15).join(', ');
    console.log(`   Key entities: ${entityList}${allEntities.size > 15 ? '...' : ''}`);
  }
}

// Run test
testWordParsing().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
