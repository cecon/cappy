/**
 * CAPPY Graph Types
 */

export type NodeType = 
  | 'file'
  | 'function'
  | 'class'
  | 'interface'
  | 'variable'
  | 'constant'
  | 'type'
  | 'import'
  | 'export';

export type RelationType =
  | 'imports'
  | 'exports'
  | 'calls'
  | 'extends'
  | 'implements'
  | 'uses'
  | 'defines'
  | 'references';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  metadata?: Record<string, unknown>;
}

export interface GraphRelationship {
  id: string;
  type: RelationType;
  sourceId: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface GraphQuery {
  nodeTypes?: NodeType[];
  relationTypes?: RelationType[];
  filePath?: string;
  depth?: number;
  limit?: number;
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  paths?: GraphPath[];
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  distance: number;
}
