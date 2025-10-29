/**
 * @fileoverview Core types for the Graph domain
 * @module domains/dashboard/types
 * @author Cappy Team
 * @since 3.0.0
 */

/**
 * Base interface for all graph objects with common properties
 */
export interface GraphObject {
  /** Unique identifier */
  readonly id: string;
  /** Human-readable label */
  label: string;
  /** Creation timestamp */
  readonly created: string;
  /** Last update timestamp */
  updated: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Position coordinates for graph layout
 */
export interface Position {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Z coordinate (for 3D layouts) */
  z?: number;
}

/**
 * Visual properties for graph elements
 */
export interface VisualProperties {
  /** Display color */
  color: string;
  /** Element size */
  size: number;
  /** Visual shape */
  shape: 'circle' | 'rect' | 'triangle' | 'diamond';
  /** Opacity level (0-1) */
  opacity: number;
}

/**
 * State properties for graph elements
 */
export interface ElementState {
  /** Is element highlighted */
  highlighted: boolean;
  /** Is element selected */
  selected: boolean;
  /** Is element hovered */
  hovered: boolean;
  /** Is element visible */
  visible: boolean;
  /** Is element expanded (for nodes with children) */
  expanded: boolean;
}

/**
 * Connection metrics for graph elements
 */
export interface ConnectionMetrics {
  /** Number of incoming connections */
  incoming: number;
  /** Number of outgoing connections */
  outgoing: number;
  /** Total connections */
  total: number;
}

/**
 * Calculated metrics for graph elements
 */
export interface CalculatedMetrics {
  /** Importance score (0-1) */
  importance: number;
  /** PageRank score */
  pageRank: number;
  /** Centrality score */
  centrality?: number;
  /** Clustering coefficient */
  clustering?: number;
}

/**
 * Node types in the knowledge graph
 */
export type NodeType = 
  | 'document'      // Source documents
  | 'entity'        // Named entities
  | 'chunk'         // Document chunks
  | 'concept'       // Abstract concepts
  | 'keyword'       // Keywords/tags
  | 'symbol';       // Code symbols

/**
 * Edge types representing relationships
 */
export type EdgeType =
  | 'contains'      // Document contains entity/chunk
  | 'mentions'      // Chunk mentions entity
  | 'similar_to'    // Semantic similarity
  | 'refers_to'     // Reference relationship
  | 'part_of'       // Part-whole relationship
  | 'related_to'    // General relationship
  | 'derived_from'  // Derivation relationship
  | 'depends_on';   // Dependency relationship

/**
 * Graph layout algorithms
 */
export type LayoutType =
  | 'force'         // Force-directed layout
  | 'hierarchical'  // Hierarchical layout
  | 'circular'      // Circular layout
  | 'grid'          // Grid layout
  | 'random'        // Random layout
  | 'manual';       // Manual positioning

/**
 * Graph filter criteria
 */
export interface GraphFilter {
  /** Filter by node types */
  nodeTypes?: NodeType[];
  /** Filter by edge types */
  edgeTypes?: EdgeType[];
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Date range filter */
  dateRange?: {
    start: string;
    end: string;
  };
  /** Search query */
  searchQuery?: string;
  /** Minimum connections */
  minConnections?: number;
}

/**
 * Graph statistics
 */
export interface GraphStatistics {
  /** Total number of nodes */
  totalNodes: number;
  /** Total number of edges */
  totalEdges: number;
  /** Nodes grouped by type */
  nodesByType: Record<NodeType, number>;
  /** Edges grouped by type */
  edgesByType: Record<EdgeType, number>;
  /** Average confidence score */
  avgConfidence: number;
  /** Date range of data */
  dateRange: {
    min: string;
    max: string;
  } | null;
  /** Graph density */
  density: number;
}

/**
 * Graph data structure
 */
export interface GraphData {
  /** Array of nodes */
  nodes: GraphNode[];
  /** Array of edges */
  edges: GraphEdge[];
  /** Graph metadata and statistics */
  statistics: GraphStatistics;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Forward declarations for entities
 */
export interface GraphNode extends GraphObject {
  type: NodeType;
  position?: Position;
  visual: VisualProperties;
  state: ElementState;
  connections: ConnectionMetrics;
  metrics: CalculatedMetrics;
  metadata: Record<string, unknown>;
}

export interface GraphEdge extends GraphObject {
  type: EdgeType;
  source: string;
  target: string;
  weight: number;
  bidirectional: boolean;
  visual: Omit<VisualProperties, 'shape'>;
  state: Omit<ElementState, 'expanded'>;
  metadata: Record<string, unknown>;
}