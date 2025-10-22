import { DiscoveredEntity } from "./DiscoveredEntity";
import { DiscoveredRelationship } from "./DiscoveredRelationship";

export interface SchemaEvolutionSuggestion {
  field: string;
  reason: string;
  confidence: number;
}

export class SchemaEvolutionService {
  suggestSchemaEvolution(entities: DiscoveredEntity[]): SchemaEvolutionSuggestion[] {
    // ...existing code...
    return [];
  }
}
