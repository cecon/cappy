/**
 * Script to analyze graph database and find maximum relationship depth
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function analyzeGraphDepth() {
  try {
    const workspaceRoot = process.cwd();
    
    // Try multiple possible locations
    let dbPath = path.join(workspaceRoot, '.cappy', 'data', 'graph-store.db');
    if (!fs.existsSync(dbPath)) {
      dbPath = path.join(workspaceRoot, '.cappy', 'data', 'kuzu', 'graph-store.db');
    }
    if (!fs.existsSync(dbPath)) {
      dbPath = path.join(workspaceRoot, '.cappy', 'data', 'graph.db');
    }

    console.log('🔍 Analyzing graph database at:', dbPath);

    if (!fs.existsSync(dbPath)) {
      console.log('❌ Database file not found');
      return;
    }

    const stats = fs.statSync(dbPath);
    console.log(`📊 Database size: ${stats.size} bytes`);

    if (stats.size === 0) {
      console.log('⚠️  Database is empty');
      return;
    }

    // Initialize sql.js
    const SQL = await initSqlJs();
    
    // Load database
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // List all tables
    console.log('\n📋 Tables in database:');
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    if (tables.length > 0 && tables[0].values.length > 0) {
      tables[0].values.forEach(row => {
        console.log(`  - ${row[0]}`);
      });
    } else {
      console.log('  (no tables found)');
      db.close();
      return;
    }

    // Check for nodes table
    const nodesCount = db.exec("SELECT COUNT(*) FROM nodes");
    const totalNodes = nodesCount[0]?.values[0]?.[0] || 0;
    console.log(`\n📦 Total nodes: ${totalNodes}`);

    // Check for edges/relationships table
    let edgesTable = 'edges';
    try {
      db.exec("SELECT 1 FROM edges LIMIT 1");
    } catch (e) {
      try {
        db.exec("SELECT 1 FROM relationships LIMIT 1");
        edgesTable = 'relationships';
      } catch (e2) {
        console.log('❌ No edges or relationships table found');
        db.close();
        return;
      }
    }

    const edgesCount = db.exec(`SELECT COUNT(*) FROM ${edgesTable}`);
    const totalEdges = edgesCount[0]?.values[0]?.[0] || 0;
    console.log(`🔗 Total edges: ${totalEdges}`);

    if (totalEdges === 0) {
      console.log('\n✅ No relationships in the graph yet');
      db.close();
      return;
    }

    // Analyze relationship types
    console.log('\n📊 Relationship types:');
    const typeQuery = db.exec(`SELECT type, COUNT(*) as count FROM ${edgesTable} GROUP BY type ORDER BY count DESC`);
    if (typeQuery.length > 0 && typeQuery[0].values.length > 0) {
      typeQuery[0].values.forEach(row => {
        console.log(`  - ${row[0]}: ${row[1]} relationships`);
      });
    }

    // Find maximum depth by traversing the graph
    console.log('\n🔍 Analyzing graph depth...');
    
    // Get all nodes that have no incoming edges (root nodes)
    const rootNodesQuery = db.exec(`
      SELECT DISTINCT n.id, n.type 
      FROM nodes n 
      LEFT JOIN ${edgesTable} e ON n.id = e.target_id 
      WHERE e.id IS NULL
      LIMIT 10
    `);

    if (rootNodesQuery.length === 0 || rootNodesQuery[0].values.length === 0) {
      console.log('  Using first 10 nodes as starting points...');
      var startNodes = db.exec('SELECT id, type FROM nodes LIMIT 10');
    } else {
      console.log(`  Found ${rootNodesQuery[0].values.length} root nodes (no incoming edges)`);
      var startNodes = rootNodesQuery;
    }

    let maxDepth = 0;
    let maxDepthPath = [];

    // BFS to find maximum depth
    if (startNodes.length > 0 && startNodes[0].values.length > 0) {
      for (const [nodeId, nodeType] of startNodes[0].values) {
        const depth = findMaxDepthBFS(db, edgesTable, nodeId);
        if (depth > maxDepth) {
          maxDepth = depth;
          maxDepthPath = [{ id: nodeId, type: nodeType }];
        }
      }
    }

    console.log(`\n🎯 Maximum relationship depth: ${maxDepth} levels`);
    
    if (maxDepth > 0) {
      console.log(`\n📍 Deepest path starts from:`);
      maxDepthPath.forEach(node => {
        console.log(`   ${node.type}: ${node.id}`);
      });
    }

    // Additional statistics
    console.log('\n📈 Graph Statistics:');
    const avgDegree = db.exec(`
      SELECT AVG(degree) as avg_degree FROM (
        SELECT source_id, COUNT(*) as degree 
        FROM ${edgesTable} 
        GROUP BY source_id
      )
    `);
    if (avgDegree.length > 0 && avgDegree[0].values[0]) {
      console.log(`  - Average outgoing edges per node: ${avgDegree[0].values[0][0].toFixed(2)}`);
    }

    const maxOutgoing = db.exec(`
      SELECT source_id, COUNT(*) as degree 
      FROM ${edgesTable} 
      GROUP BY source_id 
      ORDER BY degree DESC 
      LIMIT 1
    `);
    if (maxOutgoing.length > 0 && maxOutgoing[0].values[0]) {
      console.log(`  - Maximum outgoing edges from a node: ${maxOutgoing[0].values[0][1]}`);
    }

    db.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

// BFS to find maximum depth from a starting node
function findMaxDepthBFS(db, edgesTable, startNodeId) {
  const visited = new Set();
  const queue = [{ id: startNodeId, depth: 0 }];
  let maxDepth = 0;

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    
    if (visited.has(id)) continue;
    visited.add(id);
    
    maxDepth = Math.max(maxDepth, depth);
    
    // Get children (limit to prevent infinite loops in cyclic graphs)
    if (depth < 100) {
      try {
        const children = db.exec(`
          SELECT DISTINCT target_id 
          FROM ${edgesTable} 
          WHERE source_id = ?
        `, [id]);
        
        if (children.length > 0 && children[0].values.length > 0) {
          children[0].values.forEach(row => {
            const childId = row[0];
            if (!visited.has(childId)) {
              queue.push({ id: childId, depth: depth + 1 });
            }
          });
        }
      } catch (e) {
        // Skip on error
      }
    }
  }

  return maxDepth;
}

analyzeGraphDepth();
