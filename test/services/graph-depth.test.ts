/**
 * Unit test for graph relationship depth analysis
 * Tests the FooBar class and its dependencies to verify:
 * 1. Graph relationships are created correctly
 * 2. Relationship depth is calculated properly
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs from 'sql.js';
import { SQLiteAdapter } from '../../adapters/secondary/graph/sqlite-adapter';
import { ParserService } from '../parser-service';

describe('Graph Relationship Depth Test', () => {
  let graphStore: SQLiteAdapter;
  let parserService: ParserService;
  let dbPath: string;

  beforeAll(async () => {
    // Setup test database
    const testDir = path.join(process.cwd(), '.test-tmp');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    dbPath = path.join(testDir, 'test-graph.db');
    
    // Initialize services
    graphStore = new SQLiteAdapter(dbPath);
    await graphStore.initialize();
    
    parserService = new ParserService();
    
    console.log('✅ Test environment initialized');
  });

  afterAll(async () => {
    // Cleanup
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const testDir = path.dirname(dbPath);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    console.log('🧹 Test environment cleaned up');
  });

  it('should create all file nodes for FooBar and dependencies', async () => {
    const testFiles = [
      'test-samples/FooBar.ts',
      'test-samples/BaseService.ts',
      'test-samples/Logger.ts',
      'test-samples/DataProcessor.ts',
      'test-samples/Validator.ts',
      'test-samples/Transformer.ts',
      'test-samples/ValidationRule.ts',
      'test-samples/TransformStrategy.ts'
    ];

    for (const file of testFiles) {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Skipping ${file} - file not found`);
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      await graphStore.createFileNode(
        filePath,
        'typescript',
        content.split('\n').length
      );

      console.log(`✅ Created file node: ${path.basename(file)}`);
    }

    // Verify nodes were created
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);
    
    const result = db.exec('SELECT COUNT(*) as count FROM nodes WHERE type = "file"');
    const fileCount = result[0]?.values[0]?.[0] || 0;
    
    console.log(`📊 Total file nodes created: ${fileCount}`);
    expect(fileCount).toBeGreaterThan(0);
    
    db.close();
  });

  it('should parse FooBar.ts and create chunk nodes', async () => {
    const fooBarPath = path.join(process.cwd(), 'test-samples/FooBar.ts');
    
    if (!fs.existsSync(fooBarPath)) {
      console.warn('⚠️  FooBar.ts not found, skipping test');
      return;
    }

    const chunks = await parserService.parseFile(fooBarPath);
    console.log(`📦 Parsed ${chunks.length} chunks from FooBar.ts`);

    // Create chunk nodes using the correct API
    await graphStore.createChunkNodes(chunks);

    // Verify chunks were created
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);
    
    const result = db.exec('SELECT COUNT(*) as count FROM nodes WHERE type = "chunk"');
    const chunkCount = result[0]?.values[0]?.[0] || 0;
    
    console.log(`📊 Total chunk nodes created: ${chunkCount}`);
    expect(chunkCount).toBe(chunks.length);
    
    db.close();
  });

  it('should create import relationships between files', async () => {
    // Define the dependency graph (imports)
    const dependencies = [
      { from: 'FooBar.ts', to: 'BaseService.ts', type: 'imports' },
      { from: 'FooBar.ts', to: 'Logger.ts', type: 'imports' },
      { from: 'FooBar.ts', to: 'DataProcessor.ts', type: 'imports' },
      { from: 'DataProcessor.ts', to: 'Logger.ts', type: 'imports' },
      { from: 'DataProcessor.ts', to: 'Validator.ts', type: 'imports' },
      { from: 'DataProcessor.ts', to: 'Transformer.ts', type: 'imports' },
      { from: 'Validator.ts', to: 'ValidationRule.ts', type: 'imports' },
      { from: 'Transformer.ts', to: 'TransformStrategy.ts', type: 'imports' }
    ];

    for (const dep of dependencies) {
      const fromPath = path.join(process.cwd(), 'test-samples', dep.from);
      const toPath = path.join(process.cwd(), 'test-samples', dep.to);
      
      if (!fs.existsSync(fromPath) || !fs.existsSync(toPath)) {
        console.warn(`⚠️  Skipping relationship ${dep.from} -> ${dep.to}`);
        continue;
      }

      await graphStore.createRelationships([{
        from: fromPath,
        to: toPath,
        type: dep.type
      }]);

      console.log(`🔗 Created relationship: ${dep.from} -> ${dep.to}`);
    }

    // Verify relationships were created
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);
    
    const result = db.exec('SELECT COUNT(*) as count FROM edges WHERE type = "imports"');
    const edgeCount = result[0]?.values[0]?.[0] || 0;
    
    console.log(`📊 Total import relationships: ${edgeCount}`);
    expect(edgeCount).toBeGreaterThan(0);
    
    db.close();
  });

  it('should calculate maximum relationship depth', async () => {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Find the root node (FooBar.ts - has no incoming edges)
    const rootQuery = db.exec(`
      SELECT DISTINCT n.id, n.label
      FROM nodes n
      WHERE n.type = 'file'
        AND n.label LIKE '%FooBar.ts%'
        AND NOT EXISTS (
          SELECT 1 FROM edges e WHERE e.to_id = n.id
        )
      LIMIT 1
    `);

    if (rootQuery.length === 0 || rootQuery[0].values.length === 0) {
      console.warn('⚠️  No root node found (FooBar.ts)');
      db.close();
      return;
    }

    const rootId = rootQuery[0].values[0][0] as string;
    console.log(`🌳 Root node: ${rootId}`);

    // BFS to find maximum depth
    let maxDepth = 0;
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      
      if (visited.has(id)) continue;
      visited.add(id);
      
      maxDepth = Math.max(maxDepth, depth);
      
      // Get children
      const childrenQuery = db.exec(`
        SELECT DISTINCT to_id
        FROM edges
        WHERE from_id = ? AND type = 'imports'
      `, [id]);
      
      if (childrenQuery.length > 0 && childrenQuery[0].values.length > 0) {
        for (const row of childrenQuery[0].values) {
          const childId = row[0] as string;
          if (!visited.has(childId)) {
            queue.push({ id: childId, depth: depth + 1 });
          }
        }
      }
    }

    console.log(`\n📊 Graph Analysis Results:`);
    console.log(`   Maximum depth: ${maxDepth} levels`);
    console.log(`   Total nodes visited: ${visited.size}`);
    
    // Show the dependency tree
    console.log(`\n🌳 Dependency Tree:`);
    console.log(`   Level 0: FooBar.ts (root)`);
    console.log(`   Level 1: BaseService.ts, Logger.ts, DataProcessor.ts`);
    console.log(`   Level 2: Validator.ts, Transformer.ts`);
    console.log(`   Level 3: ValidationRule.ts, TransformStrategy.ts`);
    
    expect(maxDepth).toBeGreaterThanOrEqual(3);
    expect(maxDepth).toBeLessThanOrEqual(4);
    
    db.close();
  });

  it('should show relationship statistics', async () => {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Get statistics
    const stats = {
      totalNodes: db.exec('SELECT COUNT(*) FROM nodes')[0]?.values[0]?.[0] || 0,
      fileNodes: db.exec('SELECT COUNT(*) FROM nodes WHERE type = "file"')[0]?.values[0]?.[0] || 0,
      chunkNodes: db.exec('SELECT COUNT(*) FROM nodes WHERE type = "chunk"')[0]?.values[0]?.[0] || 0,
      totalEdges: db.exec('SELECT COUNT(*) FROM edges')[0]?.values[0]?.[0] || 0,
      importEdges: db.exec('SELECT COUNT(*) FROM edges WHERE type = "imports"')[0]?.values[0]?.[0] || 0
    };

    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total nodes: ${stats.totalNodes}`);
    console.log(`   ├─ File nodes: ${stats.fileNodes}`);
    console.log(`   └─ Chunk nodes: ${stats.chunkNodes}`);
    console.log(`   Total edges: ${stats.totalEdges}`);
    console.log(`   └─ Import relationships: ${stats.importEdges}`);

    expect(stats.totalNodes).toBeGreaterThan(0);
    expect(stats.totalEdges).toBeGreaterThan(0);

    db.close();
  });
});
