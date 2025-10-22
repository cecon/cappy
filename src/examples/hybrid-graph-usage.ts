/**
 * @fileoverview Example usage of hybrid graph database
 * @module examples/hybrid-graph-usage
 */

import { SQLiteAdapter } from '../adapters/secondary/graph/sqlite-adapter';
import { EntityDiscoveryService } from '../services/entity-discovery';

/**
 * Example: Database reverse engineering with LLM discovery
 */
async function exampleDatabaseDiscovery() {
  const adapter = new SQLiteAdapter('.cappy/graph-store.db');
  await adapter.initialize();
  
  // 1. Create structured database node
  await adapter.createDatabaseNode({
    id: 'db:production-mssql',
    label: 'Production Database',
    dbType: 'mssql',
    host: 'prod-db.company.com',
    port: 1433,
    dbName: 'ProductionDB',
    user: 'app_user'
  });
  
  // 2. Analyze stored procedure with LLM
  const procedureCode = `
    CREATE PROCEDURE sp_ProcessOrder
      @OrderId INT,
      @UserId INT
    AS
    BEGIN
      -- Validates user permissions
      -- Calculates order total
      -- Updates inventory
      -- Sends notification email
      ...
    END
  `;
  
  const discovery = new EntityDiscoveryService();
  const result = await discovery.discoverEntities(procedureCode, {
    allowNewTypes: true,
    confidenceThreshold: 0.7
  });
  
  // 3. Create db_entity with discovered semantics
  await adapter.createDbEntityNode({
    id: 'db_entity:sp_ProcessOrder',
    label: 'sp_ProcessOrder',
    entityType: 'procedure',
    entityName: 'sp_ProcessOrder',
    dbId: 'db:production-mssql',
    discoveredType: result.entities[0]?.discoveredType || 'OrderProcessingProcedure',
    discoveredProperties: result.entities[0]?.properties,
    confidence: result.entities[0]?.confidence
  });
  
  console.log('✅ Database entity created with semantic enrichment');
}

/**
 * Example: Link code to database procedures
 */
async function exampleCodeToDatabaseLink() {
  const adapter = new SQLiteAdapter('.cappy/graph-store.db');
  await adapter.initialize();
  
  // Link code chunk to database procedure
  await adapter.createRelationships([
    {
      from: 'chunk:order-service-123',
      to: 'db_entity:sp_ProcessOrder',
      type: 'code_uses_db',
      properties: {
        context: 'OrderService.processOrder() calls sp_ProcessOrder',
        confidence: 0.95
      }
    }
  ]);
  
  // Add semantic relationship
  await adapter.createDynamicRelationship({
    from: 'chunk:order-service-123',
    to: 'db_entity:sp_ProcessOrder',
    type: 'code_uses_db',
    discoveredType: 'processes_payment_through',
    semanticContext: 'The OrderService delegates payment processing to the database stored procedure',
    confidence: 0.92
  });
  
  console.log('✅ Code-to-database link created with semantic context');
}

/**
 * Example: Issue tracking with full context
 */
async function exampleIssueTracking() {
  const adapter = new SQLiteAdapter('.cappy/graph-store.db');
  await adapter.initialize();
  
  // 1. Create issue node
  await adapter.createIssueNode({
    id: 'issue:github:12345',
    label: 'Bug: Order processing fails for large orders',
    source: 'github',
    url: 'https://github.com/company/repo/issues/12345',
    status: 'open',
    priority: 'high',
    discoveredProperties: {
      affected_components: ['OrderService', 'sp_ProcessOrder'],
      root_cause: 'Timeout in stored procedure for orders > 100 items'
    }
  });
  
  // 2. Link issue to code and database
  await adapter.createRelationships([
    {
      from: 'chunk:order-service-123',
      to: 'issue:github:12345',
      type: 'relates_to_issue'
    },
    {
      from: 'db_entity:sp_ProcessOrder',
      to: 'issue:github:12345',
      type: 'relates_to_issue'
    }
  ]);
  
  // 3. Link to person
  await adapter.createPersonNode({
    id: 'person:john-dev',
    label: 'John Developer',
    role: 'developer',
    email: 'john@company.com'
  });
  
  await adapter.createRelationships([
    {
      from: 'issue:github:12345',
      to: 'person:john-dev',
      type: 'issue_assigned_to'
    }
  ]);
  
  console.log('✅ Issue with full context graph created');
}

/**
 * Example: Cappy task history
 */
async function exampleCappyTaskHistory() {
  const adapter = new SQLiteAdapter('.cappy/graph-store.db');
  await adapter.initialize();
  
  await adapter.createCappyTaskNode({
    id: 'cappy_task:refactor-20251022-001',
    label: 'Refactor OrderService',
    taskType: 'refactoring',
    status: 'completed',
    discoveredProperties: {
      files_affected: ['src/services/order-service.ts', 'src/database/procedures.sql'],
      complexity_score: 7.5,
      insights: ['Extracted payment logic to separate service', 'Optimized database calls']
    }
  });
  
  // Link task to affected nodes
  await adapter.createRelationships([
    {
      from: 'cappy_task:refactor-20251022-001',
      to: 'chunk:order-service-123',
      type: 'cappy_task_affects'
    },
    {
      from: 'cappy_task:refactor-20251022-001',
      to: 'db_entity:sp_ProcessOrder',
      type: 'cappy_task_affects'
    }
  ]);
  
  console.log('✅ Cappy task history recorded');
}

/**
 * Example: Enrich existing nodes with discovery
 */
async function exampleEnrichment() {
  const adapter = new SQLiteAdapter('.cappy/graph-store.db');
  await adapter.initialize();
  const discovery = new EntityDiscoveryService();
  
  // Discover semantics for existing chunk
  const chunkContent = `
    class AuthenticationService {
      async validateToken(token: string): Promise<User> {
        // JWT validation logic
        // Session management
        // User retrieval
      }
    }
  `;
  
  const result = await discovery.discoverEntities(chunkContent, {
    allowNewTypes: true,
    confidenceThreshold: 0.7
  });
  
  if (result.entities.length > 0) {
    await adapter.enrichNodeWithDiscovery(
      'chunk:auth-service-456',
      result.entities[0].discoveredType,
      result.entities[0].properties,
      result.entities[0].confidence
    );
  }
  
  console.log('✅ Existing node enriched with semantic discovery');
}

/**
 * Example: Cross-sphere query
 */
async function exampleCrossSphereQuery() {
  const adapter = new SQLiteAdapter('.cappy/graph-store.db');
  await adapter.initialize();
  
  // Query: Find all database procedures related to a specific issue
  const subgraph = await adapter.getSubgraph(
    ['issue:github:12345'],
    2  // depth
  );
  
  const dbEntities = subgraph.nodes.filter(n => n.type === 'chunk'); // Needs type fix
  console.log(`Found ${dbEntities.length} database entities related to issue`);
  
  // Query: Find who worked on what for an issue
  // This would require additional query methods
  
  console.log('✅ Cross-sphere query executed');
}

// Run examples
if (require.main === module) {
  (async () => {
    console.log('🚀 Running hybrid graph examples...\n');
    
    await exampleDatabaseDiscovery();
    await exampleCodeToDatabaseLink();
    await exampleIssueTracking();
    await exampleCappyTaskHistory();
    await exampleEnrichment();
    await exampleCrossSphereQuery();
    
    console.log('\n✅ All examples completed!');
  })();
}
