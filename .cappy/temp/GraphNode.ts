/**
 * @fileoverview Graph Node entity - Core domain model for graph nodes
 * @module domains/graph/entities/GraphNode
 * @author Cappy Team
 * @since 3.0.0
 */

import type {
  GraphNode as IGraphNode,
  NodeType,
  Position,
  VisualProperties,
  ElementState,
  ConnectionMetrics,
  CalculatedMetrics
} from '../types';

/**
 * Graph Node entity representing a node in the knowledge graph
 * 
 * @example
 * ```typescript
 * const node = new GraphNode({
 *   id: 'doc_1',
 *   label: 'README.md',
 *   type: 'document',
 *   created: '2024-01-01T00:00:00Z',
 *   updated: '2024-01-01T00:00:00Z',
 *   confidence: 1.0
 * });
 * 
 * node.setPosition({ x: 100, y: 200 });
 * node.highlight();
 * ```
 */
export class GraphNode implements IGraphNode {
  public readonly id: string;
  public label: string;
  public readonly type: NodeType;
  public readonly created: string;
  public updated: string;
  public confidence: number;
  public position?: Position;
  public visual: VisualProperties;
  public state: ElementState;
  public connections: ConnectionMetrics;
  public metrics: CalculatedMetrics;
  public metadata: Record<string, unknown>;

  /**
   * Creates a new GraphNode instance
   * 
   * @param props - Node properties
   * @throws {Error} When required properties are missing or invalid
   */
  constructor(props: {
    id: string;
    label: string;
    type: NodeType;
    created: string;
    updated: string;
    confidence: number;
    position?: Position;
    visual?: Partial<VisualProperties>;
    state?: Partial<ElementState>;
    connections?: Partial<ConnectionMetrics>;
    metrics?: Partial<CalculatedMetrics>;
    metadata?: Record<string, unknown>;
  }) {
    // Validation
    this.validateProps(props);

    // Core properties
    this.id = props.id;
    this.label = props.label;
    this.type = props.type;
    this.created = props.created;
    this.updated = props.updated;
    this.confidence = Math.max(0, Math.min(1, props.confidence));

    // Optional position
    this.position = props.position;

    // Visual properties with defaults
    this.visual = {
      color: this.getDefaultColor(),
      size: this.getDefaultSize(),
      shape: this.getDefaultShape(),
      opacity: 0.85,
      ...props.visual
    };

    // State with defaults
    this.state = {
      highlighted: false,
      selected: false,
      hovered: false,
      visible: true,
      expanded: false,
      ...props.state
    };

    // Connection metrics with defaults
    this.connections = {
      incoming: 0,
      outgoing: 0,
      total: 0,
      ...props.connections
    };

    // Calculated metrics with defaults
    this.metrics = {
      importance: 0,
      pageRank: 0,
      ...props.metrics
    };

    // Metadata
    this.metadata = props.metadata || {};
  }

  /**
   * Validates node properties
   * 
   * @param props - Properties to validate
   * @throws {Error} When validation fails
   */
  private validateProps(props: {
    id: string;
    label: string;
    type: NodeType;
    confidence: number;
  }): void {
    if (!props.id?.trim()) {
      throw new Error('Node ID is required');
    }
    if (!props.label?.trim()) {
      throw new Error('Node label is required');
    }
    if (!props.type) {
      throw new Error('Node type is required');
    }
    if (typeof props.confidence !== 'number' || props.confidence < 0 || props.confidence > 1) {
      throw new Error('Confidence must be a number between 0 and 1');
    }
  }

  /**
   * Gets default color based on node type
   */
  private getDefaultColor(): string {
    const colorMap: Record<NodeType, string> = {
      document: '#10b981',
      entity: '#3b82f6',
      chunk: '#8b5cf6',
      concept: '#06b6d4',
      keyword: '#f59e0b',
      symbol: '#ef4444'
    };
    return colorMap[this.type];
  }

  /**
   * Gets default size based on node type
   */
  private getDefaultSize(): number {
    const sizeMap: Record<NodeType, number> = {
      document: 15,
      entity: 10,
      chunk: 7,
      concept: 12,
      keyword: 8,
      symbol: 9
    };
    return sizeMap[this.type];
  }

  /**
   * Gets default shape based on node type
   */
  private getDefaultShape(): VisualProperties['shape'] {
    const shapeMap: Record<NodeType, VisualProperties['shape']> = {
      document: 'circle',
      entity: 'circle',
      chunk: 'rect',
      concept: 'diamond',
      keyword: 'triangle',
      symbol: 'rect'
    };
    return shapeMap[this.type];
  }

  /**
   * Sets the position of the node
   * 
   * @param position - New position
   */
  public setPosition(position: Position): void {
    this.position = { ...position };
  }

  /**
   * Updates the node's visual properties
   * 
   * @param visual - Partial visual properties to update
   */
  public updateVisual(visual: Partial<VisualProperties>): void {
    this.visual = { ...this.visual, ...visual };
  }

  /**
   * Highlights the node
   */
  public highlight(): void {
    this.state.highlighted = true;
  }

  /**
   * Removes highlight from the node
   */
  public unhighlight(): void {
    this.state.highlighted = false;
  }

  /**
   * Selects the node
   */
  public select(): void {
    this.state.selected = true;
  }

  /**
   * Deselects the node
   */
  public deselect(): void {
    this.state.selected = false;
  }

  /**
   * Sets hover state
   * 
   * @param hovered - Whether the node is hovered
   */
  public setHovered(hovered: boolean): void {
    this.state.hovered = hovered;
  }

  /**
   * Sets visibility state
   * 
   * @param visible - Whether the node is visible
   */
  public setVisible(visible: boolean): void {
    this.state.visible = visible;
  }

  /**
   * Toggles expansion state
   */
  public toggleExpanded(): void {
    this.state.expanded = !this.state.expanded;
  }

  /**
   * Updates connection metrics
   * 
   * @param connections - New connection metrics
   */
  public updateConnections(connections: Partial<ConnectionMetrics>): void {
    this.connections = { ...this.connections, ...connections };
    
    // Recalculate total
    this.connections.total = this.connections.incoming + this.connections.outgoing;
    
    // Update size based on connections
    this.updateSizeBasedOnConnections();
  }

  /**
   * Updates calculated metrics
   * 
   * @param metrics - New metrics
   */
  public updateMetrics(metrics: Partial<CalculatedMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };
  }

  /**
   * Updates size based on connection count
   */
  private updateSizeBasedOnConnections(): void {
    const baseSize = this.getDefaultSize();
    const connectionMultiplier = 1 + (this.connections.total * 0.1);
    const importanceMultiplier = 1 + (this.metrics.importance * 0.5);
    
    const maxSize = baseSize * 3; // Cap the size
    this.visual.size = Math.min(baseSize * connectionMultiplier * importanceMultiplier, maxSize);
  }

  /**
   * Gets a summary of the node for display
   */
  public getSummary(): {
    id: string;
    label: string;
    type: NodeType;
    connections: number;
    importance: number;
    confidence: number;
  } {
    return {
      id: this.id,
      label: this.label,
      type: this.type,
      connections: this.connections.total,
      importance: this.metrics.importance,
      confidence: this.confidence
    };
  }

  /**
   * Checks if the node matches a search query
   * 
   * @param query - Search query
   * @returns True if the node matches the query
   */
  public matchesSearch(query: string): boolean {
    const searchTerms = query.toLowerCase().split(' ');
    const searchableText = [
      this.label,
      this.type,
      JSON.stringify(this.metadata)
    ].join(' ').toLowerCase();

    return searchTerms.every(term => searchableText.includes(term));
  }

  /**
   * Creates a copy of the node
   */
  public clone(): GraphNode {
    return new GraphNode({
      id: this.id,
      label: this.label,
      type: this.type,
      created: this.created,
      updated: this.updated,
      confidence: this.confidence,
      position: this.position ? { ...this.position } : undefined,
      visual: { ...this.visual },
      state: { ...this.state },
      connections: { ...this.connections },
      metrics: { ...this.metrics },
      metadata: { ...this.metadata }
    });
  }

  /**
   * Converts the node to a plain object for serialization
   */
  public toJSON(): IGraphNode {
    return {
      id: this.id,
      label: this.label,
      type: this.type,
      created: this.created,
      updated: this.updated,
      confidence: this.confidence,
      position: this.position,
      visual: this.visual,
      state: this.state,
      connections: this.connections,
      metrics: this.metrics,
      metadata: this.metadata
    };
  }
}