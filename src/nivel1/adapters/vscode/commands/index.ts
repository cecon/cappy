/**
 * VS Code Commands
 * 
 * Exporta todos os comandos registráveis da extensão.
 * Estes são adaptadores da camada de apresentação (Nivel 1).
 */

export { registerProcessSingleFileCommand } from './process-single-file';
export { registerDebugRetrievalCommand } from './debug-retrieval';
export { 
  registerDebugCommand, 
  registerDebugDatabaseCommand, 
  registerDebugAddTestDataCommand
} from './debug';
export { reanalyzeRelationships, registerReanalyzeRelationshipsCommand } from './reanalyze-relationships';
export { registerResetDatabaseCommand } from './reset-database';
export { diagnoseGraph, registerDiagnoseGraphCommand } from './diagnose-graph';
