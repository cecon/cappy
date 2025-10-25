/**
 * @fileoverview Example usage of AST Entity Extractor
 * @module test/examples
 * @author Cappy Team
 */

import { createASTEntityExtractor } from '../../src/nivel2/infrastructure/services/entity-extraction';
import * as path from 'path';

async function demonstrateASTEntityExtractor() {
  console.log('🚀 AST Entity Extractor Demonstration\n');

  const workspaceRoot = path.join(__dirname, '../..');
  const extractor = createASTEntityExtractor(workspaceRoot);

  // Example file to analyze
  const filePath = path.join(
    workspaceRoot,
    'src/nivel2/infrastructure/services/ast-relationship-extractor.ts'
  );

  console.log(`📄 Analyzing file: ${filePath}\n`);

  const entities = await extractor.extractFromFile(filePath);

  // Group entities by type
  const byType = entities.reduce((acc, entity) => {
    const key = entity.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entity);
    return acc;
  }, {} as Record<string, typeof entities>);

  console.log('📊 Entity Summary:');
  console.log('─'.repeat(80));
  
  for (const [type, items] of Object.entries(byType)) {
    console.log(`\n${type.toUpperCase()} (${items.length} found):`);
    
    items.slice(0, 5).forEach(entity => {
      console.log(`  • ${entity.name}`);
      console.log(`    Category: ${entity.category}`);
      console.log(`    Location: ${entity.source}:${entity.line}:${entity.column}`);
      console.log(`    Confidence: ${entity.confidence}`);
      
      if (entity.isExported !== undefined) {
        console.log(`    Exported: ${entity.isExported}`);
      }
      
      if (entity.parameters) {
        console.log(`    Parameters: ${entity.parameters.map(p => `${p.name}${p.type ? `: ${p.type}` : ''}`).join(', ')}`);
      }
      
      if (entity.returnType) {
        console.log(`    Returns: ${entity.returnType}`);
      }
      
      if (entity.variableType) {
        console.log(`    Type: ${entity.variableType}`);
      }
      
      if (entity.props && entity.props.length > 0) {
        console.log(`    Props: ${entity.props.join(', ')}`);
      }
      
      if (entity.specifiers && entity.specifiers.length > 0) {
        console.log(`    Specifiers: ${entity.specifiers.join(', ')}`);
      }
      
      if (entity.relationships && entity.relationships.length > 0) {
        console.log(`    Relationships:`);
        entity.relationships.forEach(rel => {
          console.log(`      → ${rel.type} ${rel.target} (confidence: ${rel.confidence})`);
        });
      }
      
      console.log('');
    });
    
    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more\n`);
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`✅ Total entities extracted: ${entities.length}\n`);

  // Category breakdown
  const byCategory = entities.reduce((acc, entity) => {
    const key = entity.category;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📦 Category Breakdown:');
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`  ${category}: ${count}`);
  }

  // Exported entities
  const exported = entities.filter(e => e.isExported);
  console.log(`\n📤 Exported entities: ${exported.length}`);
  exported.slice(0, 10).forEach(e => {
    console.log(`  • ${e.name} (${e.type})`);
  });

  // Functions with parameters
  const functionsWithParams = entities.filter(e => e.type === 'function' && e.parameters && e.parameters.length > 0);
  console.log(`\n⚙️  Functions with parameters: ${functionsWithParams.length}`);
  functionsWithParams.slice(0, 5).forEach(e => {
    const params = e.parameters!.map(p => `${p.name}${p.type ? `: ${p.type}` : ''}`).join(', ');
    console.log(`  • ${e.name}(${params})${e.returnType ? ` → ${e.returnType}` : ''}`);
  });

  // External imports
  const externalImports = entities.filter(e => e.type === 'package' && e.category === 'external');
  console.log(`\n📦 External packages: ${externalImports.length}`);
  externalImports.forEach(e => {
    console.log(`  • ${e.name}${e.specifiers && e.specifiers.length > 0 ? ` (${e.specifiers.join(', ')})` : ''}`);
  });

  console.log('\n✨ Demonstration complete!\n');
}

// Run the demonstration
if (require.main === module) {
  demonstrateASTEntityExtractor().catch(console.error);
}

export { demonstrateASTEntityExtractor };
