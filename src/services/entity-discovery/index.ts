// Entities
export * from "./entities/DiscoveredEntity";
export * from "./entities/DiscoveredRelationship";
export * from "./entities/EntityDiscoveryResult";
export * from "./entities/EntityDiscoveryOptions";
export type { SchemaEvolutionSuggestion } from "./entities/SchemaEvolutionSuggestion";

// Providers
export * from "./providers/LLMProvider";
export { VSCodeLLMProvider } from "./providers/VSCodeLLMProvider";

// Core Services
export * from "./core/EntityDiscoveryService";
export { EntityResolutionService } from "./core/entity-resolution-service";
export { SchemaEvolutionService } from "./core/SchemaEvolutionService";
