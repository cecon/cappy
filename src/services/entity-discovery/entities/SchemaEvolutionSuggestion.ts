export interface SchemaEvolutionSuggestion {
  frequentTypes: Array<{ type: string; count: number }>;
  suggestion: string;
  migrationSQL: string;
}
