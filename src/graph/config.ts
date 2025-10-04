/**
 * Graph Visualization Configuration
 * 
 * Defines limits and thresholds to ensure graph visualization
 * remains navigable regardless of database size.
 */

export const graphLimits = {
  // Visualization limits
  maxVisibleNodes: 100,        // Maximum nodes visible at once
  maxVisibleEdges: 200,        // Maximum edges visible at once
  maxLabelLength: 40,          // Maximum characters in node labels
  
  // Expansion limits
  maxExpansionDepth: 2,        // Maximum depth for graph expansion
  maxNeighborsPerNode: 10,     // Maximum neighbors per node when expanding
  
  // Filtering thresholds
  minEdgeWeight: 0.5,          // Minimum weight for edges to be visible
  minNodeScore: 0.3,           // Minimum score for nodes to be included
  
  // Performance
  lazyLoadThreshold: 50,       // Load incrementally if > 50 nodes
  debounceMs: 300,             // Debounce time for user interactions
  cacheSize: 100,              // Number of content snippets to cache
  
  // Level of Detail (LOD) thresholds
  lodThresholds: {
    detailed: 30,              // Show all details if <= 30 nodes
    simplified: 70,            // Simplify if 30-70 nodes
    clustered: 100             // Cluster if > 70 nodes
  }
} as const;

/**
 * Edge type weights for graph traversal
 */
export const edgeWeights = {
  refersTo: 1.0,               // Direct references (@see, imports)
  mentionsSymbol: 0.8,         // Symbol mentions in code
  memberOf: 0.6,               // Class/interface membership
  contains: 0.4,               // Document containment
  hasKeyword: 0.3,             // Keyword association
  similarTo: 0.2               // Semantic similarity
} as const;

/**
 * Node type priorities for ranking
 */
export const nodePriorities = {
  symbol: 1.0,                 // Code symbols (highest priority)
  section: 0.8,                // Document sections
  document: 0.6,               // Full documents
  keyword: 0.4                 // Keywords (lowest priority)
} as const;

/**
 * Color scheme for different node types
 */
export const nodeColors = {
  symbol: '#4CAF50',           // Green - code symbols
  section: '#2196F3',          // Blue - sections
  document: '#FF9800',         // Orange - documents
  keyword: '#9E9E9E',          // Gray - keywords
  cluster: '#673AB7'           // Purple - clusters
} as const;

/**
 * Detail level for graph visualization
 */
export enum DetailLevel {
  DETAILED = 'detailed',       // All details visible (≤30 nodes)
  SIMPLIFIED = 'simplified',   // Some details hidden (31-70 nodes)
  CLUSTERED = 'clustered'      // Nodes clustered (>70 nodes)
}

/**
 * Configuration interface for graph operations
 */
export interface GraphConfig {
  // Visualization
  maxVisibleNodes?: number;
  maxVisibleEdges?: number;
  maxLabelLength?: number;
  
  // Expansion
  maxExpansionDepth?: number;
  maxNeighborsPerNode?: number;
  
  // Filtering
  minEdgeWeight?: number;
  minNodeScore?: number;
  
  // Performance
  enableLazyLoading?: boolean;
  enableCaching?: boolean;
  cacheSize?: number;
  
  // LOD
  lodEnabled?: boolean;
  detailLevel?: DetailLevel;
}

/**
 * Default graph configuration
 */
export const defaultGraphConfig: Required<GraphConfig> = {
  maxVisibleNodes: graphLimits.maxVisibleNodes,
  maxVisibleEdges: graphLimits.maxVisibleEdges,
  maxLabelLength: graphLimits.maxLabelLength,
  maxExpansionDepth: graphLimits.maxExpansionDepth,
  maxNeighborsPerNode: graphLimits.maxNeighborsPerNode,
  minEdgeWeight: graphLimits.minEdgeWeight,
  minNodeScore: graphLimits.minNodeScore,
  enableLazyLoading: true,
  enableCaching: true,
  cacheSize: graphLimits.cacheSize,
  lodEnabled: true,
  detailLevel: DetailLevel.DETAILED
};
