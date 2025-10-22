/**
 * @fileoverview Types for hybrid graph database (structured + dynamic discovery)
 * @module types/graph-hybrid
 * @since 3.1.0
 */

/**
 * Base node with hybrid fields
 */
export interface HybridNode {
  id: string;
  tenant_id: string;
  type: NodeType;
  label: string;
  status: NodeStatus;
  
  // Dynamic discovery fields
  discovered_type?: string;
  discovered_properties?: string;  // JSON
  entity_confidence?: number;
  
  // Quality & versioning
  quality_score: number;
  content_hash?: string;
  version: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Type-specific fields (all optional)
  db_type?: string;
  host?: string;
  port?: number;
  db_name?: string;
  
  entity_type?: string;
  entity_name?: string;
  entity_schema?: string;
  db_id?: string;
  
  file_path?: string;
  line_start?: number;
  line_end?: number;
  chunk_type?: string;
  symbol_name?: string;
  symbol_kind?: string;
  language?: string;
  
  doc_type?: string;
  doc_url?: string;
  
  issue_source?: string;
  issue_url?: string;
  issue_status?: string;
  
  person_role?: string;
  person_email?: string;
  
  cappy_task_status?: string;
  cappy_task_type?: string;
  
  extra_metadata?: string;  // JSON
}

/**
 * Node types (structured)
 */
export type NodeType =
  | 'database'
  | 'db_entity'
  | 'code_project'
  | 'code_chunk'
  | 'documentation'
  | 'issue'
  | 'person'
  | 'cappy_task'
  | 'file'
  | 'chunk'
  | 'entity'
  | 'package'
  | 'workspace';

/**
 * Node status
 */
export type NodeStatus = 'active' | 'inactive' | 'deleted' | 'archived';

/**
 * Hybrid edge with dynamic discovery
 */
export interface HybridEdge {
  id: number;
  tenant_id: string;
  from_id: string;
  to_id: string;
  type: EdgeType;
  
  // Dynamic discovery
  discovered_relationship_type?: string;
  semantic_context?: string;
  relationship_confidence?: number;
  
  // Metadata
  context?: string;
  confidence: number;
  quality_score: number;
  status: NodeStatus;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  extra_metadata?: string;
}

/**
 * Edge types (structured)
 */
export type EdgeType =
  // Database <-> Code
  | 'code_uses_db'
  | 'db_relates_to_code'
  
  // Code <-> Documentation
  | 'code_documented_by'
  | 'documents'
  
  // Issue <-> Any
  | 'relates_to_issue'
  | 'issue_assigned_to'
  
  // People <-> All
  | 'person_authored'
  | 'person_contributes_to'
  
  // Cappy <-> All
  | 'cappy_task_affects'
  
  // Structural
  | 'contains'
  | 'CONTAINS'
  | 'imports'
  | 'IMPORTS'
  | 'IMPORTS_PKG'
  | 'IMPORTS_SYMBOL'
  | 'references'
  | 'REFERENCES'
  | 'DOCUMENTS'
  | 'DEFINES'
  | 'RELATES_TO'
  
  // Semantic
  | 'uses'
  | 'implements'
  | 'extends'
  | 'depends_on'
  | 'mentions'
  | 'mentioned_in';

/**
 * Database node (sphere 1)
 */
export interface DatabaseNode extends HybridNode {
  type: 'database';
  db_type: 'mssql' | 'mysql' | 'mongodb' | 'postgres' | 'sqlite';
  host: string;
  port: number;
  db_name: string;
}

/**
 * DB Entity node (sphere 1)
 */
export interface DbEntityNode extends HybridNode {
  type: 'db_entity';
  entity_type: 'table' | 'view' | 'procedure' | 'function' | 'trigger';
  entity_name: string;
  entity_schema?: string;
  db_id: string;
}

/**
 * Code chunk node (sphere 2)
 */
export interface CodeChunkNode extends HybridNode {
  type: 'code_chunk' | 'chunk';
  file_path: string;
  line_start: number;
  line_end: number;
  chunk_type: string;
  symbol_name?: string;
  symbol_kind?: string;
  language?: string;
}

/**
 * Documentation node (sphere 3)
 */
export interface DocumentationNode extends HybridNode {
  type: 'documentation';
  doc_type: 'api_doc' | 'tutorial' | 'architecture' | 'manual';
  doc_url?: string;
}

/**
 * Issue node (sphere 4)
 */
export interface IssueNode extends HybridNode {
  type: 'issue';
  issue_source: 'github' | 'jira' | 'local' | 'linear';
  issue_url?: string;
  issue_status: string;
}

/**
 * Person node (sphere 5)
 */
export interface PersonNode extends HybridNode {
  type: 'person';
  person_role: 'developer' | 'analyst' | 'manager' | 'llm_agent';
  person_email?: string;
}

/**
 * Cappy task node (sphere 6)
 */
export interface CappyTaskNode extends HybridNode {
  type: 'cappy_task';
  cappy_task_status: 'pending' | 'running' | 'completed' | 'failed';
  cappy_task_type: string;
}
