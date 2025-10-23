/**
 * @fileoverview Example test for Entity Discovery and Resolution
 * @module test/entity-discovery-example
 */

import { EntityDiscoveryService } from '../src/services/entity-discovery/core/EntityDiscoveryService';
import { EntityResolutionService } from '../src/services/entity-discovery/core/entity-resolution-service';
import type { LLMProvider } from '../src/services/entity-discovery/providers/LLMProvider';

/**
 * Mock LLM Provider for testing
 */
class MockLLMProvider implements LLMProvider {
  async generate(prompt: string): Promise<string> {
    // Simula resposta da LLM com entidades descobertas
    return JSON.stringify({
      entities: [
        {
          name: "AuthenticationService",
          type: "Service",
          confidence: 0.95,
          properties: {
            purpose: "Handles user authentication",
            responsibilities: ["JWT validation", "Session management"],
            dependencies: ["UserRepository", "TokenStore"]
          }
        },
        {
          name: "UserRepository",
          type: "Repository",
          confidence: 0.90,
          properties: {
            purpose: "Data access layer for users"
          }
        },
        {
          name: "JWT",
          type: "Technology",
          confidence: 0.85,
          properties: {
            purpose: "Token-based authentication"
          }
        }
      ],
      relationships: [
        {
          from: "AuthenticationService",
          to: "UserRepository",
          type: "depends_on",
          confidence: 0.92,
          context: "Retrieves user credentials for validation"
        },
        {
          from: "AuthenticationService",
          to: "JWT",
          type: "uses",
          confidence: 0.88,
          context: "Generates and validates JWT tokens"
        }
      ]
    });
  }
}

/**
 * Example: Discovering entities from documentation
 */
async function exampleEntityDiscovery() {
  console.log('🧪 Testing Entity Discovery System\n');

  const mockLLM = new MockLLMProvider();
  const discoveryService = new EntityDiscoveryService(mockLLM);

  const sampleContent = `
  /**
   * AuthenticationService handles user authentication using JWT tokens.
   * It depends on UserRepository for user data and TokenStore for session management.
   * 
   * Key responsibilities:
   * - Validate JWT tokens
   * - Manage user sessions
   * - Handle login/logout flows
   */
  class AuthenticationService {
    constructor(userRepo, tokenStore) {
      this.userRepo = userRepo;
      this.tokenStore = tokenStore;
    }
  }
  `;

  const result = await discoveryService.discoverEntities(sampleContent, {
    allowNewTypes: true,
    confidenceThreshold: 0.7,
    maxEntities: 20,
    includeRelationships: true
  });

  console.log('📊 Discovery Results:');
  console.log(`   Entities found: ${result.entities.length}`);
  console.log(`   Relationships found: ${result.relationships.length}`);
  console.log(`   Summary: ${result.summary}\n`);

  result.entities.forEach((entity, i) => {
    console.log(`   Entity ${i + 1}:`);
    console.log(`     Name: ${entity.name}`);
    console.log(`     Type: ${entity.discoveredType}`);
    console.log(`     Confidence: ${entity.confidence}`);
    console.log(`     Mapping: ${entity.structuredMapping || 'N/A'}\n`);
  });

  result.relationships.forEach((rel, i) => {
    console.log(`   Relationship ${i + 1}:`);
    console.log(`     From: ${rel.from} → To: ${rel.to}`);
    console.log(`     Type: ${rel.discoveredType}`);
    console.log(`     Confidence: ${rel.confidence}`);
    console.log(`     Context: ${rel.context}\n`);
  });

  return result;
}

/**
 * Example: Entity Resolution
 */
async function exampleEntityResolution() {
  console.log('🔗 Testing Entity Resolution\n');

  // Mock GraphStore for testing
  const mockGraphStore = {
    async createEntity(entity: any): Promise<string> {
      const id = `entity:${entity.name.toLowerCase()}`;
      console.log(`   ✅ Created entity: ${id} (${entity.type})`);
      return id;
    },
    async findEntityByNameAndType(name: string, type: string | undefined): Promise<{ id: string } | null> {
      // Simula que "authenticationservice" já existe
      if (name === 'authenticationservice') {
        console.log(`   🔍 Found existing entity: ${name}`);
        return { id: 'entity:authenticationservice' };
      }
      console.log(`   🔍 No existing entity found for: ${name}`);
      return null;
    },
    async linkChunkToEntity(chunkId: string, entityId: string): Promise<void> {
      console.log(`   🔗 Linked chunk:${chunkId} → entity:${entityId}`);
    },
    async createRelationship(rel: any): Promise<void> {
      console.log(`   🔗 Created relationship: ${rel.from} → ${rel.to} (${rel.type})`);
    }
  };

  const resolutionService = new EntityResolutionService(mockGraphStore as any);

  // Teste 1: Entidade nova
  console.log('Test 1: New entity (UserRepository)');
  const newEntityId = await resolutionService.resolveOrCreateEntity({
    name: "UserRepository",
    discoveredType: "Repository",
    confidence: 0.90,
    properties: { purpose: "Data access layer" },
    sourceContext: "...",
    structuredMapping: "code_chunk"
  });
  console.log(`   Result: ${newEntityId}\n`);

  // Teste 2: Entidade existente (normalização funciona)
  console.log('Test 2: Existing entity (AuthenticationService → authenticationservice)');
  const existingEntityId = await resolutionService.resolveOrCreateEntity({
    name: "AuthenticationService",
    discoveredType: "Service",
    confidence: 0.95,
    properties: {},
    sourceContext: "...",
    structuredMapping: "code_chunk"
  });
  console.log(`   Result: ${existingEntityId}\n`);

  // Teste 3: Criar relacionamento
  console.log('Test 3: Create relationship');
  await resolutionService.createRelationshipIfValid({
    from: "AuthenticationService",
    to: "UserRepository",
    discoveredType: "depends_on",
    confidence: 0.92,
    context: "Retrieves user credentials"
  });
  console.log();
}

/**
 * Run all examples
 */
async function main() {
  try {
    await exampleEntityDiscovery();
    console.log('\n' + '='.repeat(80) + '\n');
    await exampleEntityResolution();
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { exampleEntityDiscovery, exampleEntityResolution };
