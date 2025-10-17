# Kuzu WASM - Critical Issue in VS Code Extension Host

## Problem Summary

**kuzu-wasm v0.11.3 is incompatible with VS Code Extension Host on Windows** due to an internal `getcwd()` bug in the WASM worker threads.

## Technical Details

### Root Cause
The kuzu-wasm module internally calls `getcwd()` (get current working directory) from within WASM worker threads. These workers:
1. Don't inherit the CWD from the parent Node.js process
2. Run asynchronously, making CWD management impossible
3. Fail with: `filesystem error: in current_path: call to getcwd failed: No such file or directory`

### Evidence from Logs

```
✅ Database object created with absolute path
✅ Connection object created
📊 Creating File table...
❌ Error: filesystem error: in current_path: call to getcwd failed
```

**Key observations:**
- Database and Connection objects are created successfully
- Error occurs on **first query** (`conn.query()`)
- Error happens **inside** Connection.query() → Connection.init() → Database.init()
- Absolute paths don't help - the worker still calls `getcwd()` internally

### Stack Trace
```
at Database.init (node_modules\kuzu-wasm\nodejs\database.js:77:5)
at Database._getDatabaseObjectId (node_modules\kuzu-wasm\nodejs\database.js:91:7)
at Connection.init (node_modules\kuzu-wasm\nodejs\connection.js:49:7)
at Connection._getConnectionObjectId (node_modules\kuzu-wasm\nodejs\connection.js:64:7)
at Connection.query (node_modules\kuzu-wasm\nodejs\connection.js:116:26)
```

## Attempted Solutions (All Failed)

### 1. ❌ Using Absolute Paths
```typescript
this.db = new kuzu.Database("d:\\full\\absolute\\path\\graph");
```
**Result:** Same error - workers still call getcwd()

### 2. ❌ Changing CWD Before Operations
```typescript
process.chdir(parentDir);
this.db = new kuzu.Database(relativePath);
```
**Result:** Same error - workers don't inherit CWD

### 3. ❌ Permanent CWD Change (No Restoration)
```typescript
process.chdir(dbDir); // never restore
```
**Result:** Same error - worker threads isolated

### 4. ❌ Eager Initialization with Delays
```typescript
await (this.db as any)._getDatabaseObjectId?.();
await new Promise(resolve => setTimeout(resolve, 100));
```
**Result:** Same error - timing doesn't help

### 5. ❌ CWD Verification Loop
All verification showed CWD was correct in main process, but worker threads still failed.

## Why VS Code Extension Host?

The issue is specific to VS Code Extension Host because:
1. Extension Host starts with invalid CWD: `C:\Users\...\Microsoft VS Code` (may not exist)
2. Extension runs in sandboxed environment with restricted filesystem access
3. Worker threads have even more restricted environment

## Recommended Solutions

### Option 1: Use DuckDB Instead (Recommended)
DuckDB has better Node.js support and doesn't have CWD issues:
```typescript
import * as duckdb from 'duckdb';
const db = new duckdb.Database(':memory:'); // or file path
```

**Pros:**
- Native Node.js bindings (no WASM workers)
- Better performance
- More stable
- Graph queries via extension or pure SQL

**Cons:**
- Not a native graph database (need to model relationships as tables)
- Slightly more complex queries

### Option 2: Use Neo4j Driver
Connect to external Neo4j instance:
```typescript
import neo4j from 'neo4j-driver';
const driver = neo4j.driver('bolt://localhost:7687', auth);
```

**Pros:**
- True graph database
- Production-ready
- No CWD issues (client-server)

**Cons:**
- Requires external service
- More complex setup
- Not embedded

### Option 3: Use LanceDB for Relationships (Current Workaround)
Store relationships as vectors/metadata in LanceDB:
```typescript
await table.add([{
  id: 'rel-1',
  type: 'CONTAINS',
  from: 'file-1',
  to: 'chunk-1',
  vector: [0, 0, ...] // dummy or relationship embedding
}]);
```

**Pros:**
- Already working in project
- Single database for vectors + relationships
- No additional dependencies

**Cons:**
- Not optimized for graph traversal
- Complex queries harder

### Option 4: File-Based Graph (JSON/SQLite)
Store graph structure in JSON or SQLite:
```typescript
// JSON approach
const graph = {
  nodes: [...],
  edges: [...]
};
fs.writeFileSync('graph.json', JSON.stringify(graph));
```

**Pros:**
- Simple
- No CWD issues
- Easy to debug

**Cons:**
- Poor performance for large graphs
- Manual query implementation

## Implementation Recommendation

**For Cappy Framework:**

1. **Short-term:** Use LanceDB for relationships (Option 3)
   - Add relationship documents with special type
   - Query using filters on `type`, `from`, `to`
   - Good enough for MVP

2. **Long-term:** Migrate to DuckDB (Option 1)
   - Better for production
   - Can model graph as tables:
     - `nodes` table (id, type, properties)
     - `edges` table (from_id, to_id, type, properties)
   - Use recursive CTEs for graph traversal

## Files to Modify

If switching away from Kuzu:

1. `src/adapters/secondary/graph/kuzu-adapter.ts` → rename to `graph-adapter.ts`
2. Update `GraphStorePort` interface if needed
3. Update `package.json` dependencies
4. Update initialization in extension.ts

## References

- Issue discovered: 2025-10-16
- Kuzu version: 0.11.3
- VS Code version: Latest
- Platform: Windows
- Multiple debugging sessions with detailed CWD logging

---

**Conclusion:** kuzu-wasm is not viable for VS Code extensions on Windows. Use DuckDB or LanceDB instead.
