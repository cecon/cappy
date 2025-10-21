#!/usr/bin/env node
/**
 * @fileoverview Test script for entity extraction from documentation
 * @author Cappy Team
 * @since 3.1.0
 */

import { createDocumentEnhancedParser } from './src/adapters/secondary/parsers/document-enhanced-parser';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Tests entity extraction on Cappy documentation
 */
async function testEntityExtraction() {
  console.log('🧪 Testing Entity Extraction from Cappy Documentation\n');
  console.log('=' .repeat(70));

  // Initialize parser
  const parser = createDocumentEnhancedParser();
  await parser.initialize();

  // Test files
  const testFiles = [
    'docs/COPILOT_INTEGRATION.md',
    'docs/HYBRID_RETRIEVER.md',
    'docs/WORKSPACE_SCANNER.md'
  ];

  for (const testFile of testFiles) {
    const fullPath = path.join(process.cwd(), testFile);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipping ${testFile} (not found)`);
      continue;
    }

    console.log(`\n📄 Processing: ${testFile}`);
    console.log('-'.repeat(70));

    try {
      // Parse with entity extraction
      const chunks = await parser.parseFile(fullPath, true);

      console.log(`\n✅ Extracted ${chunks.length} chunks\n`);

      // Analyze entities
      for (const [index, chunk] of chunks.entries()) {
        const metadata = chunk.metadata as Record<string, unknown>;
        
        if (Array.isArray(metadata.entities) && metadata.entities.length > 0) {
          console.log(`\n📦 Chunk ${index + 1} (lines ${metadata.lineStart}-${metadata.lineEnd}):`);
          console.log(`   Entities: ${metadata.entities.join(', ')}`);
          
          if (metadata.entityTypes) {
            console.log(`   Types:`);
            for (const [entity, type] of Object.entries(metadata.entityTypes)) {
              console.log(`      - ${entity}: ${type}`);
            }
          }
          
          if (Array.isArray(metadata.relationships) && metadata.relationships.length > 0) {
            console.log(`   Relationships:`);
            for (const rel of metadata.relationships) {
              console.log(`      - ${rel.from} --[${rel.type}]--> ${rel.to} (confidence: ${rel.confidence.toFixed(2)})`);
            }
          }
        }
      }

      // Summary
      const allEntities = new Set<string>();
      const entityTypeCount: Record<string, number> = {};
      let totalRelationships = 0;

      for (const chunk of chunks) {
        const metadata = chunk.metadata as Record<string, unknown>;
        if (Array.isArray(metadata.entities)) {
          for (const entity of metadata.entities) {
            allEntities.add(entity);
          }
        }
        if (metadata.entityTypes) {
          for (const type of Object.values(metadata.entityTypes)) {
            entityTypeCount[type as string] = (entityTypeCount[type as string] || 0) + 1;
          }
        }
        if (Array.isArray(metadata.relationships)) {
          totalRelationships += metadata.relationships.length;
        }
      }

      console.log(`\n📊 Summary for ${testFile}:`);
      console.log(`   Total unique entities: ${allEntities.size}`);
      console.log(`   Entity types:`);
      for (const [type, count] of Object.entries(entityTypeCount).sort((a, b) => b[1] - a[1])) {
        console.log(`      - ${type}: ${count}`);
      }
      console.log(`   Total relationships: ${totalRelationships}`);
      console.log(`   Entities: ${Array.from(allEntities).slice(0, 20).join(', ')}${allEntities.size > 20 ? '...' : ''}`);

    } catch (error) {
      console.error(`❌ Error processing ${testFile}:`, error);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Entity extraction test complete!\n');
}

// Run test
testEntityExtraction().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
