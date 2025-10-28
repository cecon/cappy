/**
 * @fileoverview Graph Edge entity - Core domain model for graph edges
 * @module domains/graph/entities/GraphEdge  
 * @author Cappy Team
 * @since 3.0.0
 */

import type {
  GraphEdge as IGraphEdge,
  EdgeType,
  VisualProperties,
  ElementState
} from '../types';

/**
 * Graph Edge entity representing a relationship between two nodes
 * 
 * @example
 * ```typescript
 * const edge = new GraphEdge({
 *   id: 'doc1_contains_entity1',
 *   label: 'contains',
 *   type: 'contains',
 *   source: 'doc_1',
 *   target: 'entity_1',
 *   weight: 0.8,
 *   created: '2024-01-01T00:00:00Z',
 *   updated: '2024-01-01T00:00:00Z',
 *   confidence: 0.9
 * });
 * 
 * edge.highlight();
 * edge.updateWeight(0.9);
 * ```
 */
export class GraphEdge implements IGraphEdge {
  public readonly id: string;
  public label: string;
  public readonly type: EdgeType;
  public readonly source: string;
  public readonly target: string;
  public weight: number;
  public bidirectional: boolean;
  public readonly created: string;
  public updated: string;
  public confidence: number;
  public visual: Omit<VisualProperties, 'shape'>;
  public state: Omit<ElementState, 'expanded'>;
  public metadata: Record<string, unknown>;

  /**
   * Creates a new GraphEdge instance
   * 
   * @param props - Edge properties
   * @throws {Error} When required properties are missing or invalid
   */
  constructor(props: {
    id: string;
    label: string;
    type: EdgeType;
    source: string;
    target: string;
    weight: number;
    created: string;
    updated: string;
    confidence: number;
    bidirectional?: boolean;
    visual?: Partial<Omit<VisualProperties, 'shape'>>;
    state?: Partial<Omit<ElementState, 'expanded'>>;
    metadata?: Record<string, unknown>;
  }) {
    // Validation
    this.validateProps(props);

    // Core properties
    this.id = props.id;
    this.label = props.label;
    this.type = props.type;
    this.source = props.source;
    this.target = props.target;
    this.weight = Math.max(0, Math.min(1, props.weight));
    this.bidirectional = props.bidirectional || false;
    this.created = props.created;
    this.updated = props.updated;
    this.confidence = Math.max(0, Math.min(1, props.confidence));

    // Visual properties with defaults
    this.visual = {
      color: this.getDefaultColor(),
      size: this.getDefaultSize(),
      opacity: this.getDefaultOpacity(),
      ...props.visual
    };

    // State with defaults
    this.state = {
      highlighted: false,
      selected: false,
      hovered: false,
      visible: true,
      ...props.state
    };

    // Metadata
    this.metadata = props.metadata || {};
  }

  /**
   * Validates edge properties
   * 
   * @param props - Properties to validate
   * @throws {Error} When validation fails
   */
  private validateProps(props: {
    id: string;
    label: string;
    type: EdgeType;
    source: string;
    target: string;
    weight: number;
    confidence: number;
  }): void {
    if (!props.id?.trim()) {
      throw new Error('Edge ID is required');
    }
    if (!props.label?.trim()) {
      throw new Error('Edge label is required');
    }
    if (!props.type) {
      throw new Error('Edge type is required');
    }
    if (!props.source?.trim()) {
      throw new Error('Edge source is required');
    }
    if (!props.target?.trim()) {
      throw new Error('Edge target is required');
    }
    if (props.source === props.target) {
      throw new Error('Edge source and target cannot be the same');
    }
    if (typeof props.weight !== 'number' || props.weight < 0 || props.weight > 1) {
      throw new Error('Weight must be a number between 0 and 1');
    }
    if (typeof props.confidence !== 'number' || props.confidence < 0 || props.confidence > 1) {
      throw new Error('Confidence must be a number between 0 and 1');
    }
  }

  /**
   * Gets default color based on edge type
   */
  private getDefaultColor(): string {
    const colorMap: Record<EdgeType, string> = {
      contains: '#999999',
      mentions: '#a855f7',
      similar_to: '#06b6d4',
      refers_to: '#f97316',
      part_of: '#10b981',
      related_to: '#6366f1',
      derived_from: '#ef4444',
      depends_on: '#f59e0b'
    };
    return colorMap[this.type];
  }

  /**
   * Gets default size based on weight and type
   */
  private getDefaultSize(): number {
    const baseSize = 2;
    const weightMultiplier = 1 + (this.weight * 2); // 1-3x multiplier
    return Math.max(1, baseSize * weightMultiplier);
  }

  /**
   * Gets default opacity based on confidence
   */
  private getDefaultOpacity(): number {
    return 0.4 + (this.confidence * 0.5); // 0.4-0.9 range
  }

  /**
   * Updates the edge weight
   * 
   * @param weight - New weight value (0-1)
   */
  public updateWeight(weight: number): void {
    if (typeof weight !== 'number' || weight < 0 || weight > 1) {
      throw new Error('Weight must be a number between 0 and 1');
    }
    
    this.weight = weight;
    this.updated = new Date().toISOString();
    
    // Update visual size based on new weight
    this.visual.size = this.getDefaultSize();
  }

  /**
   * Updates the edge's visual properties
   * 
   * @param visual - Partial visual properties to update
   */
  public updateVisual(visual: Partial<Omit<VisualProperties, 'shape'>>): void {
    this.visual = { ...this.visual, ...visual };
  }

  /**
   * Highlights the edge
   */
  public highlight(): void {
    this.state.highlighted = true;
  }

  /**
   * Removes highlight from the edge
   */
  public unhighlight(): void {
    this.state.highlighted = false;
  }

  /**
   * Selects the edge
   */
  public select(): void {
    this.state.selected = true;
  }

  /**
   * Deselects the edge
   */
  public deselect(): void {
    this.state.selected = false;
  }

  /**
   * Sets hover state
   * 
   * @param hovered - Whether the edge is hovered
   */
  public setHovered(hovered: boolean): void {
    this.state.hovered = hovered;
  }

  /**
   * Sets visibility state
   * 
   * @param visible - Whether the edge is visible
   */
  public setVisible(visible: boolean): void {
    this.state.visible = visible;
  }

  /**
   * Toggles bidirectional state
   */
  public toggleBidirectional(): void {
    this.bidirectional = !this.bidirectional;
    this.updated = new Date().toISOString();
  }

  /**
   * Gets the other end of the edge given one node
   * 
   * @param nodeId - ID of one node
   * @returns ID of the other node, or null if nodeId is not part of this edge
   */
  public getOtherEnd(nodeId: string): string | null {
    if (nodeId === this.source) {
      return this.target;
    }
    if (nodeId === this.target) {
      return this.source;
    }
    return null;
  }

  /**
   * Checks if the edge connects two specific nodes
   * 
   * @param nodeId1 - First node ID
   * @param nodeId2 - Second node ID
   * @returns True if the edge connects these nodes
   */
  public connects(nodeId1: string, nodeId2: string): boolean {
    return (
      (this.source === nodeId1 && this.target === nodeId2) ||
      (this.bidirectional && this.source === nodeId2 && this.target === nodeId1)
    );
  }

  /**
   * Checks if the edge is incident to a node
   * 
   * @param nodeId - Node ID to check
   * @returns True if the edge is connected to the node
   */
  public isIncidentTo(nodeId: string): boolean {
    return this.source === nodeId || this.target === nodeId;
  }

  /**
   * Gets a summary of the edge for display
   */
  public getSummary(): {
    id: string;
    label: string;
    type: EdgeType;
    source: string;
    target: string;
    weight: number;
    confidence: number;
    bidirectional: boolean;
  } {
    return {
      id: this.id,
      label: this.label,
      type: this.type,
      source: this.source,
      target: this.target,
      weight: this.weight,
      confidence: this.confidence,
      bidirectional: this.bidirectional
    };
  }

  /**
   * Checks if the edge matches a search query
   * 
   * @param query - Search query
   * @returns True if the edge matches the query
   */
  public matchesSearch(query: string): boolean {
    const searchTerms = query.toLowerCase().split(' ');
    const searchableText = [
      this.label,
      this.type,
      this.source,
      this.target,
      JSON.stringify(this.metadata)
    ].join(' ').toLowerCase();

    return searchTerms.every(term => searchableText.includes(term));
  }

  /**
   * Creates a copy of the edge
   */
  public clone(): GraphEdge {
    return new GraphEdge({
      id: this.id,
      label: this.label,
      type: this.type,
      source: this.source,
      target: this.target,
      weight: this.weight,
      created: this.created,
      updated: this.updated,
      confidence: this.confidence,
      bidirectional: this.bidirectional,
      visual: { ...this.visual },
      state: { ...this.state },
      metadata: { ...this.metadata }
    });
  }

  /**
   * Converts the edge to a plain object for serialization
   */
  public toJSON(): IGraphEdge {
    return {
      id: this.id,
      label: this.label,
      type: this.type,
      source: this.source,
      target: this.target,
      weight: this.weight,
      bidirectional: this.bidirectional,
      created: this.created,
      updated: this.updated,
      confidence: this.confidence,
      visual: this.visual,
      state: this.state,
      metadata: this.metadata
    };
  }
}