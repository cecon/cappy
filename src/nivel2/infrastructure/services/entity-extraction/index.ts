export * from './core/EntityExtractor';
export * from './core/ASTEntityExtractor';
export * from './prompts';
export * from './providers/LanguageModelProvider';

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
