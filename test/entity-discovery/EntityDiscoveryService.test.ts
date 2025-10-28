import { describe, expect, it } from "vitest";
import { EntityDiscoveryService } from "@/nivel2/infrastructure/services/entity-discovery/core/EntityDiscoveryService";
import type { EntityDiscoveryOptions } from "@/nivel2/infrastructure/services/entity-discovery/entities/EntityDiscoveryOptions";
import type { LLMProvider } from "@/nivel2/infrastructure/services/entity-discovery/providers/LLMProvider";

const baseOptions: EntityDiscoveryOptions = {
  allowNewTypes: true,
  confidenceThreshold: 0,
  maxEntities: 5,
  includeRelationships: true,
};

const sampleEntity = {
  name: "AuthenticationService",
  type: "Service",
  confidence: 0.9,
  properties: {
    purpose: "Testing flow",
  },
};

const sampleRelationship = {
  from: "AuthenticationService",
  to: "UserRepository",
  type: "uses",
  confidence: 0.88,
  context: "Reads user data",
};

const createService = (response: string): EntityDiscoveryService => {
  const provider: LLMProvider = {
    generate: async () => response,
  };

  return new EntityDiscoveryService(provider);
};

describe("EntityDiscoveryService JSON parsing", () => {
  it("parses plain JSON responses from the provider", async () => {
    const service = createService(
      JSON.stringify({
        entities: [sampleEntity],
        relationships: [sampleRelationship],
      }),
    );

    const result = await service.discoverEntities("Some source content", baseOptions);

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]).toMatchObject({
      name: "AuthenticationService",
      discoveredType: "Service",
      confidence: 0.9,
      properties: { purpose: "Testing flow" },
    });
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]).toMatchObject({
      from: "AuthenticationService",
      to: "UserRepository",
      discoveredType: "uses",
    });
  });

  it("parses fenced code-block JSON responses", async () => {
    const service = createService(
      [
        "```json",
        JSON.stringify(
          {
            entities: [sampleEntity],
            relationships: [],
          },
          null,
          2,
        ),
        "```",
      ].join("\n"),
    );

    const result = await service.discoverEntities("Chunk content", baseOptions);

    expect(result.entities).toHaveLength(1);
    expect(result.summary).toContain("Discovered 1 entities");
  });

  it("parses JSON responses surrounded by explanatory text", async () => {
    const service = createService(
      `Sure, here are the entities:\n${JSON.stringify({
        entities: [sampleEntity],
        relationships: [sampleRelationship],
      })}\nLet me know if you need anything else.`,
    );

    const result = await service.discoverEntities("Additional context", baseOptions);

    expect(result.entities).toHaveLength(1);
    expect(result.relationships).toHaveLength(1);
  });

  it("returns error summary when response is not valid JSON", async () => {
    const service = createService("Sorry, I can't help with that.");

    const result = await service.discoverEntities("Content", baseOptions);

    expect(result.entities).toHaveLength(0);
    expect(result.relationships).toHaveLength(0);
    expect(result.summary).toContain("Error:");
    expect(result.summary).toContain("Failed to parse LLM response as JSON");
  });
});
