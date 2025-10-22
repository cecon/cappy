import { EntityDiscoveryResult } from "../entities/EntityDiscoveryResult";
import { EntityDiscoveryOptions } from "../entities/EntityDiscoveryOptions";
import { LLMProvider } from "../providers/LLMProvider";

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

Return JSON format:
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

Content to analyze:
{content}
`;

export class EntityDiscoveryService {
  constructor(private llmProvider?: LLMProvider) {}

  async discoverEntities(
    content: string,
    options: EntityDiscoveryOptions
  ): Promise<EntityDiscoveryResult> {
    const startTime = Date.now();

    if (!this.llmProvider) {
      console.warn("⚠️ No LLM provider configured for entity discovery");
      return {
        entities: [],
        relationships: [],
        summary: "No LLM provider configured",
      };
    }

    try {
      const prompt = ENTITY_DISCOVERY_PROMPT.replace("{content}", content);
      const response = await this.llmProvider.generate(prompt);
      const parsed = JSON.parse(response);

      interface EntityLike {
        name: string;
        type: string;
        confidence: number;
        properties?: Record<string, unknown>;
      }

      interface RelationshipLike {
        from: string;
        to: string;
        type: string;
        confidence: number;
        context?: string;
      }

      const entities = (parsed.entities || [])
        .filter((e: EntityLike) => e.confidence >= options.confidenceThreshold)
        .slice(0, options.maxEntities)
        .map((e: EntityLike) => ({
          name: e.name,
          discoveredType: e.type,
          confidence: e.confidence,
          properties: e.properties || {},
          sourceContext: content.substring(0, 200),
          structuredMapping: this.mapToStructuredType(e.type),
        }));

      const relationships = options.includeRelationships !== false
        ? (parsed.relationships || [])
            .filter((r: RelationshipLike) => r.confidence >= options.confidenceThreshold)
            .map((r: RelationshipLike) => ({
              from: r.from,
              to: r.to,
              discoveredType: r.type,
              confidence: r.confidence,
              context: r.context || "",
            }))
        : [];

      return {
        entities,
        relationships,
        summary: `Discovered ${entities.length} entities and ${relationships.length} relationships in ${Date.now() - startTime}ms`,
      };
    } catch (error) {
      console.error("❌ Entity discovery failed:", error);
      return {
        entities: [],
        relationships: [],
        summary: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private mapToStructuredType(discoveredType: string): string | undefined {
    const mappings: Record<string, string> = {
      Service: "code_chunk",
      API: "code_chunk",
      Component: "code_chunk",
      Database: "database",
      Table: "db_entity",
      Procedure: "db_entity",
      Function: "db_entity",
      Documentation: "documentation",
      Issue: "issue",
      Person: "person",
      Developer: "person",
    };

    return mappings[discoveredType];
  }
}
