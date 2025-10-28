export * from './core/EntityExtractor';
export * from './core/ASTEntityExtractor';
export * from './prompts';
export * from './providers/LanguageModelProvider';

// Export types
export type { ASTEntity } from './types/ASTEntity';
export type { ExtractionContext } from './types/ExtractionContext';

// Export extractors (for extension/customization)
export { ImportExtractor } from './extractors/ImportExtractor';
export { FunctionExtractor } from './extractors/FunctionExtractor';
export { VariableExtractor } from './extractors/VariableExtractor';
export { JSXExtractor } from './extractors/JSXExtractor';
export { CallExpressionExtractor } from './extractors/CallExpressionExtractor';
export { ClassExtractor } from './extractors/ClassExtractor';
export { InterfaceExtractor } from './extractors/InterfaceExtractor';
export { TypeAliasExtractor } from './extractors/TypeAliasExtractor';
export { ExportExtractor } from './extractors/ExportExtractor';

// Export helpers
export { ASTHelpers } from './helpers/ASTHelpers';
export { ConfidenceCalculator } from './helpers/ConfidenceCalculator';
export { TypeInferrer } from './helpers/TypeInferrer';

// Export traversal
export { ASTTraverser } from './traversal/ASTTraverser';
export { ExportCollector } from './traversal/ExportCollector';
export { ImportMapBuilder } from './traversal/ImportMapBuilder';

import { EntityExtractor } from './core/EntityExtractor';
import { ASTEntityExtractor } from './core/ASTEntityExtractor';

/**
 * Factory function to create entity extractor
 */
export function createEntityExtractor(): EntityExtractor {
  return new EntityExtractor();
}

/**
 * Factory function to create AST-based entity extractor
 */
export function createASTEntityExtractor(workspaceRoot: string): ASTEntityExtractor {
  return new ASTEntityExtractor(workspaceRoot);
}
