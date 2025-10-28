-- ============================================================
-- CAPPY SCHEMA V2 MIGRATION
-- From: JSON-based properties (V1)
-- To: Normalized columns + multi-tenant support (V2)
-- ============================================================

-- ============================================================
-- STEP 1: BACKUP EXISTING DATA
-- ============================================================

-- Create backup tables
CREATE TABLE nodes_backup AS SELECT * FROM nodes;
CREATE TABLE edges_backup AS SELECT * FROM edges;
CREATE TABLE vectors_backup AS SELECT * FROM vectors;

-- ============================================================
-- STEP 2: CREATE NEW SCHEMA
-- ============================================================

-- Drop existing tables (will be recreated with new schema)
DROP TABLE IF EXISTS nodes;
DROP TABLE IF EXISTS edges;
DROP TABLE IF EXISTS vectors;

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE nodes (
  -- Primary identity
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  source TEXT,
  team_id TEXT,
  project_id TEXT,
  
  -- Quality & validation
  quality_score REAL DEFAULT 1.0,
  validation_errors TEXT,
  
  -- Security & privacy
  contains_pii BOOLEAN DEFAULT FALSE,
  gdpr_classification TEXT DEFAULT 'internal',
  encrypted_data TEXT,
  encryption_key_id TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  
  -- Sync & versioning
  sync_status TEXT DEFAULT 'synced',
  last_sync_at TIMESTAMP,
  sync_source TEXT,
  content_hash TEXT,
  version INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP,
  
  -- DATABASE type fields
  db_type TEXT,
  host TEXT,
  port INTEGER,
  db_name TEXT,
  db_user TEXT,
  
  -- DB_ENTITY type fields
  entity_type TEXT,
  entity_name TEXT,
  entity_schema TEXT,
  db_id TEXT,
  
  -- CODE_PROJECT type fields
  project_path TEXT,
  project_type TEXT,
  
  -- CODE_CHUNK type fields
  file_path TEXT,
  line_start INTEGER,
  line_end INTEGER,
  chunk_type TEXT,
  symbol_name TEXT,
  symbol_kind TEXT,
  language TEXT,
  
  -- DOCUMENTATION type fields
  doc_type TEXT,
  doc_url TEXT,
  doc_format TEXT,
  
  -- ISSUE type fields
  issue_source TEXT,
  issue_url TEXT,
  issue_status TEXT,
  issue_priority TEXT,
  issue_assignee TEXT,
  
  -- PERSON type fields
  person_role TEXT,
  person_email TEXT,
  person_external_id TEXT,
  
  -- CAPPY_TASK type fields
  cappy_task_status TEXT,
  cappy_task_type TEXT,
  cappy_task_created_at TEXT,
  cappy_task_completed_at TEXT,
  
  -- Extensibility
  extra_metadata TEXT,
  
  -- Constraints
  CONSTRAINT valid_node_type 
    CHECK (type IN ('database', 'db_entity', 'code_project', 'code_chunk', 
                    'documentation', 'issue', 'person', 'cappy_task', 
                    'file', 'chunk', 'entity', 'package', 'workspace')),
  CONSTRAINT valid_quality_score 
    CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
  CONSTRAINT valid_status
    CHECK (status IN ('active', 'inactive', 'deleted', 'archived'))
);

CREATE TABLE edges (
  -- Primary identity
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  
  -- Edge metadata
  context TEXT,
  confidence REAL DEFAULT 1.0,
  quality_score REAL DEFAULT 1.0,
  status TEXT DEFAULT 'active',
  source TEXT,
  team_id TEXT,
  project_id TEXT,
  
  -- Sync & versioning
  sync_status TEXT DEFAULT 'synced',
  last_sync_at TIMESTAMP,
  version INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Extensibility
  extra_metadata TEXT,
  
  -- Constraints
  UNIQUE(tenant_id, from_id, to_id, type),
  
  CONSTRAINT valid_confidence 
    CHECK (confidence >= 0.0 AND confidence <= 1.0),
  CONSTRAINT valid_quality_score 
    CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
  CONSTRAINT valid_status
    CHECK (status IN ('active', 'inactive', 'deleted'))
);

CREATE TABLE vectors (
  chunk_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  content TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  embedding_model TEXT,
  metadata TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- AUDIT & SECURITY TABLES
-- ============================================================

CREATE TABLE node_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE edge_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  edge_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  user_agent TEXT
);

-- ============================================================
-- DATA QUALITY TABLES
-- ============================================================

CREATE TABLE data_quality_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  node_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  rule_definition TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  severity TEXT DEFAULT 'error',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE data_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  source1 TEXT,
  value1 TEXT,
  source2 TEXT, 
  value2 TEXT,
  resolution_strategy TEXT,
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  resolved_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ANALYTICS & OBSERVABILITY TABLES
-- ============================================================

CREATE TABLE usage_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_id TEXT,
  team_id TEXT,
  user_id TEXT,
  metadata TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  context TEXT,
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_health (
  check_name TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  details TEXT,
  tenant_id TEXT
);

-- ============================================================
-- MULTI-TENANT TABLES
-- ============================================================

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_tier TEXT,
  max_projects INTEGER,
  max_nodes INTEGER,
  max_storage_gb REAL,
  features TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_tier
    CHECK (subscription_tier IN ('free', 'pro', 'enterprise', 'custom'))
);

CREATE TABLE user_permissions (
  user_id TEXT,
  tenant_id TEXT,
  team_id TEXT,
  project_id TEXT,
  permission_level TEXT,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT,
  expires_at TIMESTAMP,
  
  PRIMARY KEY (user_id, tenant_id, team_id, project_id),
  
  CONSTRAINT valid_permission
    CHECK (permission_level IN ('read', 'write', 'admin', 'owner'))
);

-- ============================================================
-- SYNC & VERSIONING TABLES
-- ============================================================

CREATE TABLE schema_versions (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  migration_script TEXT,
  rollback_script TEXT,
  description TEXT
);

CREATE TABLE query_cache (
  cache_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  query_result TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMP
);

-- ============================================================
-- BUSINESS LOGIC TABLES
-- ============================================================

CREATE TABLE business_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  rule_name TEXT UNIQUE NOT NULL,
  rule_type TEXT NOT NULL,
  applies_to TEXT NOT NULL,
  rule_definition TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  severity TEXT DEFAULT 'error',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STEP 3: CREATE INDICES
-- ============================================================

-- Nodes indices
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_tenant_type ON nodes(tenant_id, type);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_team_project ON nodes(team_id, project_id);
CREATE INDEX idx_nodes_updated_at ON nodes(updated_at);
CREATE INDEX idx_nodes_content_hash ON nodes(content_hash);
CREATE INDEX idx_nodes_file_path ON nodes(file_path) WHERE type IN ('code_chunk', 'chunk');
CREATE INDEX idx_nodes_db_name ON nodes(db_name) WHERE type IN ('database', 'db_entity');
CREATE INDEX idx_nodes_issue_status ON nodes(issue_status) WHERE type = 'issue';
CREATE INDEX idx_nodes_symbol_name ON nodes(symbol_name) WHERE symbol_name IS NOT NULL;

-- Edges indices
CREATE INDEX idx_edges_from_id ON edges(from_id);
CREATE INDEX idx_edges_to_id ON edges(to_id);
CREATE INDEX idx_edges_type ON edges(type);
CREATE INDEX idx_edges_tenant_type ON edges(tenant_id, type);
CREATE INDEX idx_edges_confidence ON edges(confidence);
CREATE INDEX idx_edges_updated_at ON edges(updated_at);

-- Vectors indices
CREATE INDEX idx_vectors_tenant ON vectors(tenant_id);
CREATE INDEX idx_vectors_model ON vectors(embedding_model);

-- Audit indices
CREATE INDEX idx_audit_node_id ON node_audit(node_id);
CREATE INDEX idx_audit_timestamp ON node_audit(timestamp);
CREATE INDEX idx_audit_tenant ON node_audit(tenant_id);
CREATE INDEX idx_edge_audit_edge_id ON edge_audit(edge_id);
CREATE INDEX idx_edge_audit_timestamp ON edge_audit(timestamp);

-- Analytics indices
CREATE INDEX idx_analytics_tenant ON usage_analytics(tenant_id);
CREATE INDEX idx_analytics_event_type ON usage_analytics(event_type);
CREATE INDEX idx_analytics_timestamp ON usage_analytics(timestamp);
CREATE INDEX idx_metrics_tenant ON performance_metrics(tenant_id);
CREATE INDEX idx_metrics_name ON performance_metrics(metric_name);
CREATE INDEX idx_metrics_timestamp ON performance_metrics(measured_at);

-- Cache indices
CREATE INDEX idx_cache_tenant ON query_cache(tenant_id);
CREATE INDEX idx_cache_expires ON query_cache(expires_at);

-- ============================================================
-- STEP 4: CREATE TRIGGERS
-- ============================================================

-- Auto-update timestamps
CREATE TRIGGER update_nodes_timestamp 
AFTER UPDATE ON nodes
BEGIN
  UPDATE nodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_edges_timestamp 
AFTER UPDATE ON edges
BEGIN
  UPDATE edges SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Audit trail triggers
CREATE TRIGGER audit_node_insert
AFTER INSERT ON nodes
BEGIN
  INSERT INTO node_audit (tenant_id, node_id, action, user_id, new_values)
  VALUES (NEW.tenant_id, NEW.id, 'created', 'system', json_object(
    'type', NEW.type,
    'label', NEW.label,
    'status', NEW.status
  ));
END;

CREATE TRIGGER audit_node_update
AFTER UPDATE ON nodes
BEGIN
  INSERT INTO node_audit (tenant_id, node_id, action, user_id, old_values, new_values)
  VALUES (NEW.tenant_id, NEW.id, 'updated', 'system', 
    json_object('label', OLD.label, 'status', OLD.status),
    json_object('label', NEW.label, 'status', NEW.status)
  );
END;

CREATE TRIGGER audit_node_delete
BEFORE DELETE ON nodes
BEGIN
  INSERT INTO node_audit (tenant_id, node_id, action, user_id, old_values)
  VALUES (OLD.tenant_id, OLD.id, 'deleted', 'system', json_object(
    'type', OLD.type,
    'label', OLD.label,
    'status', OLD.status
  ));
END;

-- ============================================================
-- STEP 5: CREATE VIEWS
-- ============================================================

CREATE VIEW active_nodes AS 
SELECT * FROM nodes WHERE status = 'active';

CREATE VIEW active_edges AS 
SELECT * FROM edges WHERE status = 'active';

CREATE VIEW node_relationships_summary AS
SELECT 
  n.id,
  n.type,
  n.label,
  n.tenant_id,
  COUNT(DISTINCT e1.to_id) as outgoing_edges,
  COUNT(DISTINCT e2.from_id) as incoming_edges,
  AVG(e1.confidence) as avg_outgoing_confidence,
  AVG(e2.confidence) as avg_incoming_confidence,
  MAX(n.updated_at) as last_activity
FROM nodes n
LEFT JOIN edges e1 ON n.id = e1.from_id AND e1.status = 'active'
LEFT JOIN edges e2 ON n.id = e2.to_id AND e2.status = 'active'
WHERE n.status = 'active'
GROUP BY n.id, n.type, n.label, n.tenant_id;

-- ============================================================
-- STEP 6: MIGRATE DATA FROM BACKUP
-- ============================================================

-- Migrate nodes
INSERT INTO nodes (id, type, label, created_at, file_path, line_start, line_end, chunk_type, symbol_name, symbol_kind, language, db_type, host, port, db_name, extra_metadata)
SELECT 
  id,
  type,
  label,
  CURRENT_TIMESTAMP,
  -- Extract from JSON properties
  json_extract(properties, '$.filePath'),
  json_extract(properties, '$.lineStart'),
  json_extract(properties, '$.lineEnd'),
  json_extract(properties, '$.chunkType'),
  json_extract(properties, '$.symbolName'),
  json_extract(properties, '$.symbolKind'),
  json_extract(properties, '$.language'),
  json_extract(properties, '$.db_type'),
  json_extract(properties, '$.host'),
  json_extract(properties, '$.port'),
  json_extract(properties, '$.db_name'),
  properties  -- Keep original JSON in extra_metadata
FROM nodes_backup;

-- Migrate edges
INSERT INTO edges (from_id, to_id, type, context, confidence, created_at, extra_metadata)
SELECT 
  from_id,
  to_id,
  type,
  json_extract(properties, '$.context'),
  COALESCE(json_extract(properties, '$.confidence'), 1.0),
  CURRENT_TIMESTAMP,
  properties  -- Keep original JSON in extra_metadata
FROM edges_backup;

-- Migrate vectors
INSERT INTO vectors (chunk_id, content, embedding_json, metadata, created_at)
SELECT 
  chunk_id,
  content,
  embedding_json,
  metadata,
  CURRENT_TIMESTAMP
FROM vectors_backup;

-- ============================================================
-- STEP 7: INSERT DEFAULT TENANT
-- ============================================================

INSERT INTO tenants (id, name, subscription_tier, max_projects, max_nodes, max_storage_gb, features)
VALUES ('default', 'Default Tenant', 'free', 10, 100000, 10.0, '["basic"]');

-- ============================================================
-- STEP 8: RECORD MIGRATION
-- ============================================================

INSERT INTO schema_versions (version, description)
VALUES ('2.0.0', 'Normalized schema with multi-tenant support, audit trail, and data quality features');

-- ============================================================
-- STEP 9: CLEANUP (Optional - uncomment to remove backups)
-- ============================================================

-- DROP TABLE nodes_backup;
-- DROP TABLE edges_backup;
-- DROP TABLE vectors_backup;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
