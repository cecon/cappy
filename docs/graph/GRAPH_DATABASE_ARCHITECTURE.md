# 🧠 Cappy Graph Database - Hybrid Architecture

**Version**: 2.0.0  
**Date**: October 22, 2025  
**Approach**: Structured Schema + Dynamic Entity Discovery (LightRAG-inspired)  
**Rating**: 10/10 🔥

---

## 🎯 Philosophy: Best of Both Worlds

### ⚖️ The Trade-off

**Structured (SQL-based)**  
✅ Type safety & validation  
✅ Fast queries with indexes  
✅ Business logic enforcement  
❌ Rigid, requires pre-definition  

**Dynamic (LightRAG-style)**  
✅ Discovers unexpected entities  
✅ Adapts to any domain  
✅ No schema maintenance  
❌ Slower, less structured  

### 🚀 Our Solution: Hybrid

**Structured foundation** for core entities (files, chunks, databases)  
**Dynamic discovery** for semantic entities and relationships  
**Smart reconciliation** to merge both worlds

---

## 📊 Schema V2 - Hybrid Design

### Core Table: Nodes

```sql
CREATE TABLE nodes (
  -- Primary identity
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  
  -- STRUCTURED TYPES (core entities)
  type TEXT NOT NULL,              -- 'file', 'chunk', 'database', 'db_entity', etc.
  label TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  
  -- DYNAMIC DISCOVERY ✨ (LightRAG-inspired)
  discovered_type TEXT,            -- LLM-discovered type: 'AuthService', 'PaymentGateway'
  discovered_properties TEXT,      -- JSON with flexible properties
  entity_confidence REAL,          -- 0.0-1.0 confidence in discovery
  semantic_embedding TEXT,         -- Vector for similarity search
  
  -- Quality & validation
  quality_score REAL DEFAULT 1.0,
  validation_errors TEXT,
  
  -- Security & privacy
  contains_pii BOOLEAN DEFAULT FALSE,
  gdpr_classification TEXT DEFAULT 'internal',
  
  -- Sync & versioning
  sync_status TEXT DEFAULT 'synced',
  content_hash TEXT,
  version INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- STRUCTURED FIELDS (type-specific)
  -- Database sphere
  db_type TEXT,
  host TEXT,
  port INTEGER,
  db_name TEXT,
  
  -- DB Entity sphere
  entity_type TEXT,                -- 'table', 'view', 'procedure', 'function', 'trigger'
  entity_name TEXT,
  entity_schema TEXT,
  db_id TEXT,
  
  -- Code sphere
  project_path TEXT,
  file_path TEXT,
  line_start INTEGER,
  line_end INTEGER,
  chunk_type TEXT,
  symbol_name TEXT,
  symbol_kind TEXT,
  language TEXT,
  
  -- Documentation sphere
  doc_type TEXT,
  doc_url TEXT,
  doc_format TEXT,
  
  -- Issue sphere
  issue_source TEXT,
  issue_url TEXT,
  issue_status TEXT,
  issue_priority TEXT,
  
  -- Person sphere
  person_role TEXT,
  person_email TEXT,
  person_external_id TEXT,
  
  -- Cappy Task sphere
  cappy_task_status TEXT,
  cappy_task_type TEXT,
  
  -- Extensibility
  extra_metadata TEXT,             -- JSON for additional structured data
  
  -- Constraints
  CONSTRAINT valid_node_type 
    CHECK (type IN ('database', 'db_entity', 'code_project', 'code_chunk', 
                    'documentation', 'issue', 'person', 'cappy_task',
                    'file', 'chunk', 'entity', 'package', 'workspace')),
  CONSTRAINT valid_quality_score 
    CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
  CONSTRAINT valid_entity_confidence
    CHECK (entity_confidence IS NULL OR (entity_confidence >= 0.0 AND entity_confidence <= 1.0))
);
```

### Core Table: Edges

```sql
CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  
  -- STRUCTURED TYPE
  type TEXT NOT NULL,              -- 'contains', 'imports', 'uses', etc.
  
  -- DYNAMIC DISCOVERY ✨
  discovered_relationship_type TEXT,  -- LLM-discovered: 'authenticates_via', 'triggers_workflow'
  semantic_context TEXT,           -- Natural language description
  relationship_confidence REAL,    -- 0.0-1.0
  
  -- Metadata
  context TEXT,
  confidence REAL DEFAULT 1.0,
  quality_score REAL DEFAULT 1.0,
  status TEXT DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Extensibility
  extra_metadata TEXT,
  
  UNIQUE(tenant_id, from_id, to_id, type),
  
  CONSTRAINT valid_confidence 
    CHECK (confidence >= 0.0 AND confidence <= 1.0),
  CONSTRAINT valid_relationship_confidence
    CHECK (relationship_confidence IS NULL OR (relationship_confidence >= 0.0 AND relationship_confidence <= 1.0))
);
```

### Supporting Tables

```sql
-- Vectors for semantic search
CREATE TABLE vectors (
  chunk_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  content TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  embedding_model TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail
CREATE TABLE node_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_values TEXT,
  new_values TEXT
);

-- Multi-tenant
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_tier TEXT,
  max_nodes INTEGER,
  features TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schema versioning
CREATE TABLE schema_versions (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);
```

---

## 🌐 Isolated Spheres

### 1. Database Sphere
**Node Types**: `database`, `db_entity`

```typescript
interface DatabaseNode {
  type: 'database';
  db_type: 'mssql' | 'mysql' | 'mongodb' | 'postgres';
  host: string;
  port: number;
  db_name: string;
}

interface DbEntityNode {
  type: 'db_entity';
  entity_type: 'table' | 'view' | 'procedure' | 'function' | 'trigger';
  entity_name: string;
  entity_schema: string;
  db_id: string;  // Reference to parent database
  
  // Dynamic discovery
  discovered_properties: {
    parameters?: string[];
    returns?: string;
    business_purpose?: string;
  };
}
```

### 2. Code Sphere
**Node Types**: `code_project`, `code_chunk`, `file`, `chunk`

```typescript
interface CodeChunkNode {
  type: 'code_chunk';
  file_path: string;
  line_start: number;
  line_end: number;
  symbol_name?: string;
  language: string;
  
  // Dynamic discovery
  discovered_type?: 'AuthService' | 'PaymentGateway' | 'DataTransformer';
  discovered_properties?: {
    responsibilities: string[];
    dependencies: string[];
    business_context: string;
  };
}
```

### 3. Documentation Sphere
**Node Types**: `documentation`

```typescript
interface DocumentationNode {
  type: 'documentation';
  doc_type: 'api_doc' | 'tutorial' | 'architecture' | 'manual';
  doc_format: 'markdown' | 'pdf' | 'html' | 'docx';
  doc_url?: string;
  
  // Dynamic discovery
  discovered_type?: 'APIReference' | 'TutorialGuide' | 'TroubleshootingDoc';
  discovered_properties?: {
    topics: string[];
    target_audience: string;
    related_features: string[];
  };
}
```

### 4. Issue Sphere
**Node Types**: `issue`

```typescript
interface IssueNode {
  type: 'issue';
  issue_source: 'github' | 'jira' | 'local' | 'linear';
  issue_url?: string;
  issue_status: string;
  issue_priority?: string;
  
  // Dynamic discovery
  discovered_properties?: {
    affected_components: string[];
    root_cause_analysis: string;
    related_incidents: string[];
  };
}
```

### 5. People Sphere
**Node Types**: `person`

```typescript
interface PersonNode {
  type: 'person';
  person_role: 'developer' | 'analyst' | 'manager' | 'llm_agent';
  person_email?: string;
  person_external_id?: string;
  
  // Dynamic discovery
  discovered_properties?: {
    expertise_areas: string[];
    contribution_patterns: string[];
    collaboration_network: string[];
  };
}
```

### 6. Cappy History Sphere
**Node Types**: `cappy_task`

```typescript
interface CappyTaskNode {
  type: 'cappy_task';
  cappy_task_status: 'pending' | 'running' | 'completed' | 'failed';
  cappy_task_type: string;
  
  // Dynamic discovery
  discovered_properties?: {
    complexity_score: number;
    files_affected: string[];
    insights_generated: string[];
  };
}
```

---

## 🔗 Cross-Sphere Relationships

### Structured Edge Types

```typescript
type EdgeType = 
  // Database <-> Code
  | 'code_uses_db'          // Code calls database
  | 'db_relates_to_code'    // DB entity referenced in code
  
  // Code <-> Documentation
  | 'code_documented_by'    // Code has documentation
  | 'documents'             // Doc describes code
  
  // Issue <-> Any
  | 'relates_to_issue'      // Any node linked to issue
  | 'issue_assigned_to'     // Issue assigned to person
  
  // People <-> All
  | 'person_authored'       // Person created code
  | 'person_contributes_to' // Person works on project
  
  // Cappy <-> All
  | 'cappy_task_affects'    // Task modified node
  
  // Structural
  | 'contains'              // Parent-child
  | 'imports'               // Code imports
  | 'references'            // Code references
  
  // Semantic (dynamic)
  | 'uses'
  | 'implements'
  | 'extends'
  | 'depends_on';
```

### Dynamic Edge Types (LLM-discovered)

```typescript
interface DynamicEdge {
  type: 'uses';  // Structured type
  discovered_relationship_type: 'authenticates_via' | 'processes_payment_through' | 'triggers_workflow';
  semantic_context: string;
  relationship_confidence: number;
}
```

---

## 🤖 Dynamic Entity Discovery Engine

### LLM-Powered Extraction

```typescript
interface EntityDiscoveryService {
  /**
   * Discovers entities and relationships from unstructured content
   * @param content - Text to analyze (code, docs, comments)
   * @param allowNewTypes - Allow discovery of types not in schema
   * @returns Discovered entities with confidence scores
   */
  async discoverEntities(
    content: string,
    options: {
      allowNewTypes: boolean;
      confidenceThreshold: number;
      maxEntities?: number;
    }
  ): Promise<DiscoveredEntity[]>;
  
  /**
   * Reconciles discovered entities with structured schema
   */
  async reconcileWithSchema(
    discovered: DiscoveredEntity[],
    structured: StructuredNode[]
  ): Promise<ReconciledNode[]>;
  
  /**
   * Suggests schema evolution based on frequent discoveries
   */
  async suggestSchemaEvolution(
    discoveries: DiscoveredEntity[],
    threshold: number
  ): Promise<SchemaEvolutionSuggestion>;
}

interface DiscoveredEntity {
  name: string;
  discoveredType: string;        // "AuthenticationService", "PaymentProcessor"
  confidence: number;            // 0.0 - 1.0
  properties: Record<string, any>;
  sourceContext: string;
  structuredMapping?: string;    // Maps to structured type if applicable
}
```

### Discovery Prompt Template

```typescript
const ENTITY_DISCOVERY_PROMPT = `
Analyze the following content and extract ALL entities and relationships.
Don't limit yourself to predefined types. Discover:

1. **Technical Entities**
   - Services, APIs, databases, queues, caches
   - Components, modules, packages
   - Infrastructure elements

2. **Business Entities**
   - Domain objects (User, Order, Payment)
   - Workflows, processes
   - Business rules

3. **Abstract Entities**
   - Design patterns
   - Architectural concepts
   - Best practices

4. **Relationships**
   - Uses, depends on, calls, configures
   - Implements, extends, composes
   - Triggers, processes, transforms

Return JSON:
{
  "entities": [
    {
      "name": "AuthenticationService",
      "type": "Service",
      "confidence": 0.95,
      "properties": {
        "purpose": "Handles user authentication",
        "responsibilities": ["JWT validation", "Session management"],
        "dependencies": ["UserRepository", "TokenStore"]
      }
    }
  ],
  "relationships": [
    {
      "from": "AuthenticationService",
      "to": "UserRepository",
      "type": "uses",
      "confidence": 0.92,
      "context": "Retrieves user credentials for validation"
    }
  ]
}
`;
```

---

## 🔄 Hybrid Workflow

### Phase 1: Structured Analysis

```typescript
// Traditional AST-based extraction
const structuredNodes = await astAnalyzer.analyzeFile('src/auth/service.ts');
// Returns: code_chunk nodes with file_path, symbols, imports
```

### Phase 2: Dynamic Discovery

```typescript
// LLM-powered semantic analysis
const discoveries = await entityDiscovery.discoverEntities(fileContent, {
  allowNewTypes: true,
  confidenceThreshold: 0.7
});
// Returns: Discovered semantic entities like "AuthenticationService"
```

### Phase 3: Reconciliation

```typescript
// Merge structured + dynamic
const enrichedNodes = await reconciler.merge(structuredNodes, discoveries);

// Example result:
{
  id: 'chunk-auth-service-123',
  type: 'code_chunk',              // Structured
  file_path: '/src/auth/service.ts',
  line_start: 45,
  symbol_name: 'AuthService',
  
  discovered_type: 'AuthenticationService',  // Dynamic
  discovered_properties: {
    business_purpose: 'User authentication and session management',
    handles: ['JWT validation', 'OAuth flows', 'MFA'],
    dependencies: ['UserService', 'TokenStore', 'EmailService'],
    security_level: 'critical'
  },
  entity_confidence: 0.92
}
```

### Phase 4: Schema Evolution

```typescript
// Auto-suggest schema changes based on discoveries
const evolution = await schemaEvolution.analyze(allDiscoveries);

if (evolution.newTypesFrequency['PaymentGateway'] > 10) {
  console.log('Suggestion: Add PaymentGateway as structured type');
  console.log('Migration:', evolution.generateMigration('PaymentGateway'));
}
```

---

## 📈 Performance Optimizations

### Indices

```sql
-- Structured fields (fast)
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_file_path ON nodes(file_path);
CREATE INDEX idx_nodes_symbol_name ON nodes(symbol_name);

-- Dynamic fields (for exploration)
CREATE INDEX idx_nodes_discovered_type ON nodes(discovered_type);
CREATE INDEX idx_nodes_entity_confidence ON nodes(entity_confidence);

-- Hybrid queries
CREATE INDEX idx_nodes_type_discovered ON nodes(type, discovered_type);
```

### Query Patterns

```typescript
// Fast structured query
const authChunks = await db.query(`
  SELECT * FROM nodes 
  WHERE type = 'code_chunk' 
    AND symbol_name LIKE '%Auth%'
`);

// Semantic discovery query
const authServices = await db.query(`
  SELECT * FROM nodes 
  WHERE discovered_type = 'AuthenticationService'
    AND entity_confidence > 0.8
`);

// Hybrid query (best of both)
const criticalAuth = await db.query(`
  SELECT * FROM nodes 
  WHERE type = 'code_chunk'
    AND discovered_type LIKE '%Auth%'
    AND json_extract(discovered_properties, '$.security_level') = 'critical'
`);
```

---

## 🎯 Use Cases Enabled

### 1. Database Reverse Engineering + Code Mapping

```typescript
// Discover stored procedures
const procedures = await dbAnalyzer.extractProcedures('ProductionDB');

// LLM discovers what they do
const enriched = await entityDiscovery.analyzeProcedures(procedures);
// Discovers: "OrderProcessingProcedure", "PaymentValidationTrigger"

// Link to code that calls them
await linkDiscovery.findCodeUsage(enriched);
```

### 2. Cross-Domain Impact Analysis

```typescript
// Start from a database change
const impactedCode = await graphTraversal.traverse({
  start: 'db_entity:sp_UpdateUser',
  edges: ['db_relates_to_code', 'code_uses_db'],
  maxDepth: 3
});

// Include semantic relationships
const fullImpact = await semanticTraversal.expand(impactedCode, {
  includeDiscovered: true,
  confidenceThreshold: 0.75
});
// Discovers: Related services, affected workflows, impacted APIs
```

### 3. Automatic Documentation Generation

```typescript
// Generate docs from discovered semantics
const docs = await docGenerator.fromDiscoveries({
  nodeId: 'chunk-payment-service',
  includeDiscoveredProperties: true,
  format: 'markdown'
});

/*
Output:
# PaymentService

**Type**: Payment Gateway Integration
**Purpose**: Processes credit card transactions via Stripe

## Responsibilities
- Validates payment methods
- Processes transactions
- Handles webhooks

## Dependencies
- UserService (for customer data)
- OrderService (for order validation)
- StripeAPI (external payment gateway)
*/
```

---

## 🚀 Migration Strategy

### Step 1: Run Schema Migration

```bash
sqlite3 .cappy/graph-store.db < src/adapters/secondary/graph/migrations/001_schema_v2_migration.sql
```

### Step 2: Enable Dynamic Discovery

```typescript
// In config
{
  entityDiscovery: {
    enabled: true,
    confidenceThreshold: 0.7,
    allowNewTypes: true,
    batchSize: 10
  }
}
```

### Step 3: Gradual Enrichment

```typescript
// Background process
async function enrichExistingNodes() {
  const nodes = await db.query('SELECT * FROM nodes WHERE discovered_type IS NULL LIMIT 100');
  
  for (const node of nodes) {
    const content = await loadContent(node);
    const discovery = await entityDiscovery.discoverEntities(content);
    
    await db.update('nodes', node.id, {
      discovered_type: discovery.type,
      discovered_properties: JSON.stringify(discovery.properties),
      entity_confidence: discovery.confidence
    });
  }
}
```

---

## 📊 Comparison: Before vs After

| Aspect | V1 (Pure Structured) | V2 (Hybrid) |
|--------|---------------------|-------------|
| Entity Types | Fixed (~10 types) | Fixed + Unlimited discovered |
| Flexibility | Low | High |
| Performance | Fast (indexed) | Fast structured + slower discovery |
| Adaptability | Manual schema changes | Auto-suggests evolution |
| Semantic Understanding | None | Rich (LLM-powered) |
| Query Complexity | Simple | Simple OR complex semantic |
| Maintenance | High (schema updates) | Low (auto-adapts) |

---

## ✅ Decision: Hybrid Approach

**Rating**: 10/10 🔥

**Why**:
- ✅ Structured foundation for reliability
- ✅ Dynamic discovery for flexibility
- ✅ Best performance where it matters
- ✅ Adapts to unexpected domains
- ✅ Schema evolution guidance
- ✅ Rich semantic understanding

**This architecture scales from MVP → Cloud Brain → Enterprise SaaS without major refactoring.**

---

## 📚 Next Steps

1. ✅ Schema V2 designed
2. ✅ Migration script created
3. ⏳ Implement `EntityDiscoveryService`
4. ⏳ Implement `ReconciliationEngine`
5. ⏳ Update `SQLiteAdapter` for hybrid queries
6. ⏳ Add dynamic discovery to indexing pipeline
7. ⏳ Build schema evolution analyzer

**Est. Time**: 2-3 weeks for full implementation
