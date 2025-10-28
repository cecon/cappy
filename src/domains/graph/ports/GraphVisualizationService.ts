/**
 * @fileoverview Graph Visualization Service port - Interface for graph rendering
 * @module domains/graph/ports/GraphVisualizationService
 * @author Cappy Team
 * @since 3.0.0
 */

import type { GraphData, LayoutType, Position } from '../types';

/**
 * Layout configuration options
 */
export interface LayoutConfig {
  /** Layout algorithm type */
  type: LayoutType;
  /** Algorithm-specific parameters */
  parameters: Record<string, unknown>;
  /** Animation duration in milliseconds */
  animationDuration?: number;
  /** Whether to animate the layout transition */
  animated?: boolean;
}

/**
 * Visualization rendering options
 */
export interface RenderOptions {
  /** Container dimensions */
  width: number;
  height: number;
  /** Background color */
  backgroundColor?: string;
  /** Whether to show labels */
  showLabels?: boolean;
  /** Whether to enable zoom/pan */
  interactive?: boolean;
  /** Performance mode for large graphs */
  performanceMode?: boolean;
}

/**
 * Graph layout result
 */
export interface LayoutResult {
  /** Node positions after layout calculation */
  nodePositions: Map<string, Position>;
  /** Layout metadata */
  metadata: {
    algorithm: LayoutType;
    iterations: number;
    duration: number;
    converged: boolean;
  };
}

/**
 * Service interface for graph visualization and layout
 * 
 * This port defines the contract for rendering and laying out graph data
 * using various visualization libraries like D3.js, vis.js, or custom renderers.
 * 
 * @example
 * ```typescript
 * class D3GraphVisualizationService implements GraphVisualizationService {
 *   async calculateLayout(graphData, config): Promise<LayoutResult> {
 *     // D3 force simulation implementation
 *   }
 * }
 * ```
 */
export interface GraphVisualizationService {
  /**
   * Calculates node positions using specified layout algorithm
   * 
   * @param graphData - Graph data to layout
   * @param config - Layout configuration
   * @returns Promise resolving to layout result
   * @throws {Error} When layout calculation fails
   */
  calculateLayout(graphData: GraphData, config: LayoutConfig): Promise<LayoutResult>;

  /**
   * Renders the graph to a target container
   * 
   * @param graphData - Graph data to render
   * @param containerId - Target container element ID
   * @param options - Rendering options
   * @returns Promise resolving when rendering is complete
   * @throws {Error} When rendering fails
   */
  render(graphData: GraphData, containerId: string, options: RenderOptions): Promise<void>;

  /**
   * Updates the visual representation without full re-render
   * 
   * @param graphData - Updated graph data
   * @returns Promise resolving when update is complete
   */
  update(graphData: GraphData): Promise<void>;

  /**
   * Destroys the visualization and cleans up resources
   * 
   * @returns Promise resolving when cleanup is complete
   */
  destroy(): Promise<void>;

  /**
   * Fits the graph view to show all nodes
   * 
   * @param animated - Whether to animate the transition
   * @returns Promise resolving when fit is complete
   */
  fitToView(animated?: boolean): Promise<void>;

  /**
   * Zooms to a specific node
   * 
   * @param nodeId - Target node ID
   * @param animated - Whether to animate the transition
   * @returns Promise resolving when zoom is complete
   */
  zoomToNode(nodeId: string, animated?: boolean): Promise<void>;

  /**
   * Highlights nodes and edges matching criteria
   * 
   * @param nodeIds - Node IDs to highlight
   * @param edgeIds - Edge IDs to highlight
   * @returns Promise resolving when highlighting is complete
   */
  highlight(nodeIds: string[], edgeIds: string[]): Promise<void>;

  /**
   * Clears all highlights
   * 
   * @returns Promise resolving when clearing is complete
   */
  clearHighlight(): Promise<void>;

  /**
   * Exports the current visualization
   * 
   * @param format - Export format (svg, png, pdf)
   * @param options - Export options
   * @returns Promise resolving to exported data
   */
  export(format: 'svg' | 'png' | 'pdf', options?: {
    width?: number;
    height?: number;
    quality?: number;
  }): Promise<Blob | string>;
}

/**
 * Event handler interface for graph interactions
 */
export interface GraphInteractionHandler {
  /**
   * Called when a node is clicked
   * 
   * @param nodeId - Clicked node ID
   * @param event - Click event data
   */
  onNodeClick?(nodeId: string, event: unknown): void;

  /**
   * Called when a node is hovered
   * 
   * @param nodeId - Hovered node ID or null when hover ends
   * @param event - Hover event data
   */
  onNodeHover?(nodeId: string | null, event: unknown): void;

  /**
   * Called when an edge is clicked
   * 
   * @param edgeId - Clicked edge ID
   * @param event - Click event data
   */
  onEdgeClick?(edgeId: string, event: unknown): void;

  /**
   * Called when the background is clicked
   * 
   * @param event - Click event data
   */
  onBackgroundClick?(event: unknown): void;

  /**
   * Called when the zoom level changes
   * 
   * @param zoomLevel - New zoom level
   */
  onZoomChange?(zoomLevel: number): void;
}

/**
 * Factory interface for creating GraphVisualizationService instances
 */
export interface GraphVisualizationServiceFactory {
  /**
   * Creates a new GraphVisualizationService instance
   * 
   * @param config - Service configuration
   * @param interactionHandler - Optional interaction handler
   * @returns GraphVisualizationService instance
   */
  create(
    config?: unknown,
    interactionHandler?: GraphInteractionHandler
  ): GraphVisualizationService;
}