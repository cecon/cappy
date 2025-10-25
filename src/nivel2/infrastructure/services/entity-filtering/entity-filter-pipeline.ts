/**
 * @fileoverview Pipeline de filtragem de entidades - Entry Point
 * @module services/entity-filtering
 */

// Main pipeline
export { EntityFilterPipeline } from './core/EntityFilterPipeline';

// Types
export type {
  RawEntity,
  FilteredEntity,
  DeduplicatedEntity,
  NormalizedEntity,
  EnrichedEntity,
  FilterPipelineResult,
  FilterPipelineConfig
} from './types/FilterTypes';

// Filters (for customization)
export { RelevanceFilter } from './filters/RelevanceFilter';
export { DeduplicationFilter } from './filters/DeduplicationFilter';
export { NormalizationFilter } from './filters/NormalizationFilter';
export { EnrichmentFilter } from './filters/EnrichmentFilter';

// Enrichers
export { ConfidenceEnricher } from './enrichers/ConfidenceEnricher';
export { RelationshipInferrer } from './enrichers/RelationshipInferrer';
export { DocumentationExtractor } from './enrichers/DocumentationExtractor';

// Resolvers
export { PackageInfoResolver } from './resolvers/PackageInfoResolver';
export { PackageManagerDetector } from './resolvers/PackageManagerDetector';

// Discovery
export { EntityDiscoveryService } from './discovery/EntityDiscoveryService';
