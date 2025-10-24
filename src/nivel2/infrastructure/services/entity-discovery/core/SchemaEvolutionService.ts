import type { EntityDiscoveryResult } from "../entities/EntityDiscoveryResult";
import type { SchemaEvolutionSuggestion } from "../entities/SchemaEvolutionSuggestion";

export class SchemaEvolutionService {
  async analyze(
    discoveries: Map<string, EntityDiscoveryResult>,
    threshold: number = 10
  ): Promise<SchemaEvolutionSuggestion> {
    const typeCounts = new Map<string, number>();

    for (const result of discoveries.values()) {
      for (const entity of result.entities) {
        const count = typeCounts.get(entity.discoveredType) || 0;
        typeCounts.set(entity.discoveredType, count + 1);
      }
    }

    const frequentTypes = Array.from(typeCounts.entries())
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    return {
      frequentTypes,
      suggestion:
        frequentTypes.length > 0
          ? `Consider adding ${frequentTypes.length} new structured types`
          : "No schema evolution needed",
      migrationSQL: this.generateMigration(frequentTypes.map((t) => t.type)),
    };
  }

  private generateMigration(types: string[]): string {
    if (types.length === 0) return "";

    const fields = types
      .map((type) => {
        const fieldName = type.toLowerCase().replace(/\s+/g, "_");
        return `  ${fieldName}_data TEXT,  -- JSON data for ${type}`;
      })
      .join("\n");

    return `
-- Migration: Add fields for discovered types
ALTER TABLE nodes ADD COLUMN discovered_types_data TEXT;

-- Suggested new fields:
${fields}
    `.trim();
  }
}
