# External Package Tracking - Implementation Summary

## 📦 Overview

This document describes the implementation of external package dependency tracking in Cappy's graph system. The feature enables high-confidence resolution and tracking of npm/pnpm/yarn/bun packages imported by the codebase.

## 🎯 Goals Achieved

1. **High-confidence package resolution** using lockfiles and node_modules
2. **Detailed package metadata** (version, manager, integrity, workspace info)
3. **Separate package nodes** in the graph with `type="package"`
4. **IMPORTS_PKG relationship** type for file → package edges
5. **Cache invalidation** based on package.json/lockfile changes

## 🏗️ Architecture

### New Components

#### 1. `ExternalPackageResolver` (`src/services/external-package-resolver.ts`)

Central service for resolving external package dependencies with multiple resolution strategies:

**Resolution Priority (high → low confidence):**

1. **Lockfile** (confidence: 1.0)
   - `pnpm-lock.yaml`
   - `package-lock.json`
   - `yarn.lock`
   - `bun.lockb` (limited support - binary format)

2. **node_modules** (confidence: 0.95)
   - Reads `node_modules/<package>/package.json`
   - Walks up directory tree

3. **package.json** (confidence: 0.7)
   - Only version range available
   - Fallback option

4. **URL/CDN** (confidence: 0.8)
   - Extracts version from URL
   - Example: `https://esm.sh/react@18.3.1`

5. **Git** (confidence: 0.9)
   - Extracts commit hash
   - Example: `github:user/repo#abc123`

**Key Features:**
- ✅ Parses all major package managers
- ✅ Supports workspace dependencies (`workspace:*`)
- ✅ Extracts subpaths (e.g., `react/jsx-runtime`)
- ✅ Caches lockfile and package.json content
- ✅ Hash-based cache invalidation

**API:**
```typescript
const resolver = new ExternalPackageResolver(workspaceRoot);

// Check if import is external
const isExternal = resolver.isExternalImport('react'); // true
const isInternal = resolver.isExternalImport('./utils'); // false

// Resolve package info
const resolution = await resolver.resolveExternalImport('react', filePath);
/*
{
  name: "react",
  subpath: null,
  range: "^18.2.0",
  resolved: "18.3.1",
  manager: "pnpm",
  lockfile: "pnpm-lock.yaml",
  integrity: "sha512-...",
  workspace: null,
  commit: null,
  url: null,
  source: "lockfile",
  confidence: 1.0
}
*/
```

#### 2. Updated `ASTRelationshipExtractor`

**Changes:**
- Now accepts `workspaceRoot` in constructor
- New method: `extractImportsWithResolution()` replaces old `extractImports()`
- Returns `ImportInfo[]` instead of simple `{source, specifiers}[]`

**ImportInfo Interface:**
```typescript
interface ImportInfo {
  source: string;           // Import specifier
  specifiers: string[];     // Named imports
  isExternal: boolean;      // true for npm packages
  packageResolution?: PackageResolution; // Only for external imports
}
```

**New Behavior:**
- Analyzes each import and determines if external
- For external imports, calls `ExternalPackageResolver`
- Creates `IMPORTS_PKG` relationships with full metadata
- Logs summary: `Found 5 imports (3 external, 2 internal)`

#### 3. Updated `SQLiteAdapter`

**New Method:**
```typescript
async createPackageNode(
  pkgId: string,           // "pkg:react@18.3.1"
  name: string,            // "react"
  version: string | null,  // "18.3.1"
  metadata: Record<string, unknown> // manager, integrity, etc.
): Promise<void>
```

**Auto-creation in `createRelationships()`:**
- Automatically detects `IMPORTS_PKG` relationships
- Creates package nodes on-the-fly
- Stores in same `nodes` table with `type="package"`

**Package Node Structure:**
```sql
INSERT INTO nodes (id, type, label, properties) VALUES (
  'pkg:react@18.3.1',
  'package',
  'react@18.3.1',
  '{"name":"react","version":"18.3.1","manager":"pnpm",...}'
)
```

#### 4. Updated Type Definitions

**`src/types/chunk.ts`:**

```typescript
// Extended RelationType
export type RelationType = 
  | 'CONTAINS' 
  | 'DOCUMENTS' 
  | 'REFERENCES' 
  | 'DEFINES' 
  | 'RELATES_TO' 
  | 'IMPORTS_PKG'; // ← NEW

// Extended GraphRelationship properties
export interface GraphRelationship {
  from: string;
  to: string;
  type: RelationType;
  properties?: Record<string, string | number | boolean | string[] | null>; // ← Extended
}
```

## 📊 Graph Structure

### Package Node Example

```json
{
  "id": "pkg:react@18.3.1",
  "type": "package",
  "label": "react@18.3.1",
  "properties": {
    "name": "react",
    "version": "18.3.1",
    "manager": "pnpm",
    "lockfile": "pnpm-lock.yaml",
    "integrity": "sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ==",
    "source": "lockfile",
    "confidence": 1.0
  }
}
```

### IMPORTS_PKG Edge Example

```json
{
  "from": "/path/to/App.tsx",
  "to": "pkg:react@18.3.1",
  "type": "IMPORTS_PKG",
  "properties": {
    "specifier": "react",
    "subpath": null,
    "range": "^18.2.0",
    "resolved": "18.3.1",
    "manager": "pnpm",
    "lockfile": "pnpm-lock.yaml",
    "integrity": "sha512-...",
    "workspace": null,
    "commit": null,
    "url": null,
    "source": "lockfile",
    "confidence": 1.0,
    "specifiers": ["useState", "useEffect"]
  }
}
```

### Example Query Results

**"Who uses react?"** (incoming edges)
```sql
SELECT from_id, properties 
FROM edges 
WHERE type = 'IMPORTS_PKG' 
  AND to_id = 'pkg:react@18.3.1';
```

**"What packages does App.tsx use?"** (outgoing edges)
```sql
SELECT to_id, properties 
FROM edges 
WHERE type = 'IMPORTS_PKG' 
  AND from_id = '/path/to/App.tsx';
```

## 🔄 Integration Points

### Services Updated

1. **`WorkspaceScanner`**
   - Passes `workspaceRoot` to `ASTRelationshipExtractor`

2. **`IndexingService`**
   - Now requires `workspaceRoot` parameter
   - Passes to `ASTRelationshipExtractor` during file analysis

3. **`FileProcessingWorker`**
   - Uses updated `IndexingService` with workspace root

### Commands Updated

1. **`process-single-file.ts`**
   - Creates resolver with workspace root
   - Processes package imports

2. **`reanalyze-relationships.ts`**
   - Re-analyzes with package resolution

3. **`diagnose-graph.ts`**
   - Shows package import statistics

## 📝 Usage Examples

### Analyzing a File

```typescript
import { ASTRelationshipExtractor } from './services/ast-relationship-extractor';

const extractor = new ASTRelationshipExtractor('/workspace/root');
const analysis = await extractor.analyze('/workspace/src/App.tsx');

console.log(analysis.imports);
/*
[
  {
    source: 'react',
    specifiers: ['useState', 'useEffect'],
    isExternal: true,
    packageResolution: {
      name: 'react',
      resolved: '18.3.1',
      manager: 'pnpm',
      confidence: 1.0,
      ...
    }
  },
  {
    source: './utils',
    specifiers: ['helper'],
    isExternal: false
  }
]
*/
```

### Creating Package Nodes Manually

```typescript
import { SQLiteAdapter } from './adapters/secondary/graph/sqlite-adapter';

const graphStore = new SQLiteAdapter('/path/to/db');
await graphStore.initialize();

// Create package node
await graphStore.createPackageNode(
  'pkg:lodash@4.17.21',
  'lodash',
  '4.17.21',
  {
    manager: 'npm',
    source: 'lockfile',
    confidence: 1.0
  }
);
```

### Querying Package Usage

```typescript
// Get all files that import a specific package
const edges = await graphStore.getSubgraph(['pkg:react@18.3.1'], 1);
const importers = edges.edges
  .filter(e => e.type === 'IMPORTS_PKG' && e.target === 'pkg:react@18.3.1')
  .map(e => e.source);

console.log('Files importing react:', importers);
```

## 🔧 Cache Invalidation

The resolver caches lockfile and package.json content with hash-based invalidation:

```typescript
// Clear cache when files change
resolver.clearCache();

// Or create new resolver instance
const newResolver = new ExternalPackageResolver(workspaceRoot);
```

**When to invalidate:**
- `package.json` changes
- Any lockfile changes (`pnpm-lock.yaml`, `package-lock.json`, etc.)
- `node_modules` updates

## 📈 Benefits

1. **Accurate Dependency Tracking**
   - Know exactly which packages each file uses
   - Identify unused dependencies
   - Track workspace dependencies

2. **Impact Analysis**
   - "What breaks if I upgrade React?"
   - "Which files use this deprecated package?"
   - "What's the blast radius of removing this dependency?"

3. **Monorepo Support**
   - Tracks internal workspace dependencies
   - Distinguishes external vs internal packages

4. **Multi-Manager Support**
   - Works with pnpm, npm, yarn, bun
   - Handles URL and git dependencies

5. **High Confidence**
   - Lockfile parsing provides exact versions
   - Fallback strategies ensure best-effort resolution

## 🚀 Future Enhancements

### Potential Improvements

1. **Version Range Analysis**
   - Track which version ranges are compatible
   - Warn about conflicting peer dependencies

2. **Transitive Dependencies**
   - Build full dependency tree
   - Visualize deep dependency chains

3. **License Tracking**
   - Extract license from package.json
   - Compliance reporting

4. **Security Scanning**
   - Integrate with npm audit
   - Track vulnerable packages

5. **Bundle Analysis**
   - Estimate bundle size impact
   - Identify heavy dependencies

6. **Workspace Graph**
   - Internal package dependency graph
   - Monorepo visualization

## 🧪 Testing

### Manual Testing

```bash
# Process a single file
> Cappy: Process Single File
# Select a file that imports external packages

# Check graph diagnostics
> Cappy: Diagnose Graph
# Look for "package" type nodes and IMPORTS_PKG edges

# Re-analyze all relationships
> Cappy: Reanalyze Relationships
# Rebuilds all package edges
```

### Expected Output

```
📊 Found 8 imports (5 external, 3 internal), 2 exports, 4 calls, 6 type refs
  📥 Internal imports: ./utils, ../components/Button, ../hooks/useData
  🔗 Created 15 relationships (5 package imports, 10 code references)
```

## 📚 Dependencies

### New Dependencies

- **`yaml`** - For parsing `pnpm-lock.yaml` and `yarn.lock`
  ```bash
  npm install yaml
  ```

### Existing Dependencies

- `@typescript-eslint/parser` - AST parsing
- `sql.js` - SQLite storage

## 🎓 Learning Resources

- [npm package.json spec](https://docs.npmjs.com/cli/v9/configuring-npm/package-json)
- [pnpm lockfile format](https://pnpm.io/git#lockfiles)
- [yarn.lock format](https://classic.yarnpkg.com/lang/en/docs/yarn-lock/)
- [npm package-lock.json](https://docs.npmjs.com/cli/v9/configuring-npm/package-lock-json)

## ✅ Implementation Checklist

- [x] Create `ExternalPackageResolver` service
- [x] Support pnpm, npm, yarn lockfile parsing
- [x] Extend `ASTRelationshipExtractor` with package resolution
- [x] Add `IMPORTS_PKG` relationship type
- [x] Create package nodes in SQLite
- [x] Update all service constructors with `workspaceRoot`
- [x] Update all commands to pass workspace root
- [x] Extend type definitions
- [x] Add cache invalidation
- [x] Support workspace dependencies
- [x] Support URL/git dependencies
- [x] Documentation

## 🐛 Known Limitations

1. **Bun lockfile** - Limited support (binary format)
2. **Dynamic imports** - Only static imports tracked
3. **Conditional imports** - All branches considered
4. **Type-only imports** - Treated same as runtime imports

---

**Implementation Date:** October 19, 2025  
**Version:** Cappy 3.0.4+  
**Status:** ✅ Complete
