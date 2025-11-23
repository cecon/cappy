import type { EntityDiscoveryResult } from "../entities/EntityDiscoveryResult";
import type { EntityDiscoveryOptions } from "../entities/EntityDiscoveryOptions";
import type { LLMProvider } from "../providers/LLMProvider";

const ENTITY_DISCOVERY_PROMPT = `
You are an information extraction engine. Your response MUST be a single valid JSON object that matches the schema shown below.
Do not include explanations, apologies, code fences, or any text outside the JSON object.
If no entities or relationships are found, return {"entities": [], "relationships": []}.

Schema:
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

Instructions:
1. Extract technical entities (services, APIs, databases, queues, caches, components, modules, packages, infrastructure elements).
2. Extract business entities (domain objects, workflows, processes, business rules).
3. Extract abstract entities (design patterns, architectural concepts, best practices).
4. Extract relationships (uses, depends on, calls, configures, implements, extends, composes, triggers, processes, transforms).
5. Confidence scores must be numeric between 0 and 1.

Content to analyze:
{content}
`;

export class EntityDiscoveryService {
  private readonly llmProvider?: LLMProvider;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1000; // 1 second between requests
  
  constructor(llmProvider?: LLMProvider) {
    this.llmProvider = llmProvider;
  }

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
      // Rate limiting: wait if necessary
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
      }
      this.lastRequestTime = Date.now();

      const prompt = ENTITY_DISCOVERY_PROMPT.replace("{content}", content);
      const response = await this.llmProvider.generate(prompt);
      const parsed = this.parseJsonResponse(response);

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

      // Type guard to ensure parsed has the expected structure
      const isValidParsedResponse = (obj: unknown): obj is { entities?: EntityLike[]; relationships?: RelationshipLike[] } => {
        return obj !== null && typeof obj === 'object';
      };

      if (!isValidParsedResponse(parsed)) {
        throw new Error("Invalid response format from LLM");
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

  private parseJsonResponse(response: string): unknown {
    const candidates = this.extractJsonCandidates(response);

    if (candidates.length === 0) {
      throw new Error("LLM response did not contain any JSON content");
    }

    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (error) {
        lastError = error;
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : "Unknown JSON parsing error";
    throw new Error(`Failed to parse LLM response as JSON: ${message}`);
  }

  private extractJsonCandidates(response: string): string[] {
    const trimmed = response.trim();
    const seen = new Set<string>();
    const candidates: string[] = [];

    const addCandidate = (candidate: string): void => {
      const normalized = candidate.trim();
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      candidates.push(normalized);
    };

    const fencedJson = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = fencedJson.exec(trimmed)) !== null) {
      addCandidate(match[1]);
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      addCandidate(trimmed.slice(firstBrace, lastBrace + 1));
    }

    if (trimmed) {
      addCandidate(trimmed);
    }

    return candidates;
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
