export * from './core/EntityExtractor';
export * from './prompts';
export * from './providers/LanguageModelProvider';

import { EntityExtractor } from './core/EntityExtractor';

/**
 * Factory function to create entity extractor
 */
export function createEntityExtractor(): EntityExtractor {
  return new EntityExtractor();
}
