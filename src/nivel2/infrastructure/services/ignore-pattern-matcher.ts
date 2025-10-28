/**
 * @fileoverview Matcher for .gitignore and .cappyignore patterns
 * @module services/ignore-pattern-matcher
 * @author Cappy Team
 * @since 3.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import ignore, { type Ignore } from 'ignore';

/**
 * Service for matching files against ignore patterns
 */
export class IgnorePatternMatcher {
  private readonly workspaceRoot: string;
  private gitIgnore: Ignore;
  private cappyIgnore: Ignore;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.gitIgnore = ignore();
    this.cappyIgnore = ignore();
  }

  /**
   * Loads ignore patterns from .gitignore and .cappyignore
   */
  async load(): Promise<void> {
    // Load .gitignore
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      this.gitIgnore = ignore().add(content);
      console.log('📋 Loaded .gitignore patterns');
    }

    // Load .cappyignore
    const cappyignorePath = path.join(this.workspaceRoot, '.cappyignore');
    if (fs.existsSync(cappyignorePath)) {
      const content = fs.readFileSync(cappyignorePath, 'utf-8');
      this.cappyIgnore = ignore().add(content);
      console.log('📋 Loaded .cappyignore patterns');
    } else {
      // Default cappy ignore patterns
      this.cappyIgnore = ignore().add([
        'node_modules/',
        '.git/',
        'dist/',
        'build/',
        '.cappy/',
        '*.log',
        '.DS_Store',
        'coverage/'
      ]);
      console.log('📋 Using default .cappyignore patterns');
    }
  }

  /**
   * Checks if a file should be ignored
   */
  shouldIgnore(relPath: string): boolean {
    // Normalize path for ignore
    const normalizedPath = relPath.replace(/\\/g, '/');
    
    return this.gitIgnore.ignores(normalizedPath) || 
           this.cappyIgnore.ignores(normalizedPath);
  }

  /**
   * Adds additional patterns
   */
  addPatterns(patterns: string[]): void {
    this.cappyIgnore.add(patterns);
  }
}
