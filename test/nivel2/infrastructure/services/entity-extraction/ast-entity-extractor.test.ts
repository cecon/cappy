/**
 * @fileoverview Tests for AST Entity Extractor
 * @module test/services
 * @author Cappy Team
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ASTEntityExtractor } from '@/nivel2/infrastructure/services/entity-extraction/core/ASTEntityExtractor';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

describe('ASTEntityExtractor', () => {
  let extractor: ASTEntityExtractor;
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-extractor-test-'));
    extractor = new ASTEntityExtractor(tempDir);
  });

  describe('Function Detection', () => {
    it('should extract function declarations', async () => {
      const testFile = path.join(tempDir, 'functions.ts');
      fs.writeFileSync(testFile, `
        function greet(name: string): string {
          return \`Hello, \${name}\`;
        }

        export function farewell(name: string): void {
          console.log(\`Goodbye, \${name}\`);
        }
      `);

      const entities = await extractor.extractFromFile(testFile);
      const functions = entities.filter(e => e.type === 'function' && e.parameters !== undefined);

      expect(functions.length).toBeGreaterThanOrEqual(2);
      
      const greet = functions.find(f => f.name === 'greet');
      expect(greet).toBeDefined();
      expect(greet?.isExported).toBe(false);
      expect(greet?.parameters).toHaveLength(1);
      expect(greet?.parameters?.[0].name).toBe('name');
      expect(greet?.parameters?.[0].type).toBe('string');
      expect(greet?.returnType).toBe('string');

      const farewell = functions.find(f => f.name === 'farewell');
      expect(farewell).toBeDefined();
      expect(farewell?.isExported).toBe(true);
    });

    it('should extract arrow functions', async () => {
      const testFile = path.join(tempDir, 'arrow-functions.ts');
      fs.writeFileSync(testFile, `
        const add = (a: number, b: number): number => a + b;
        export const multiply = (x: number, y: number) => x * y;
      `);

      const entities = await extractor.extractFromFile(testFile);
      const functions = entities.filter(e => e.type === 'function');

      expect(functions).toHaveLength(2);
      
      const add = functions.find(f => f.name === 'add');
      expect(add).toBeDefined();
      expect(add?.parameters).toHaveLength(2);

      const multiply = functions.find(f => f.name === 'multiply');
      expect(multiply?.isExported).toBe(true);
    });
  });

  describe('Variable Detection', () => {
    it('should extract variable declarations', async () => {
      const testFile = path.join(tempDir, 'variables.ts');
      fs.writeFileSync(testFile, `
        const message: string = "Hello";
        let count: number = 0;
        export const config = { debug: true };
      `);

      const entities = await extractor.extractFromFile(testFile);
      const variables = entities.filter(e => e.type === 'variable');

      expect(variables.length).toBeGreaterThanOrEqual(1);
      
      const config = variables.find(v => v.name === 'config');
      expect(config).toBeDefined();
      expect(config?.isExported).toBe(true);
      expect(config?.initialValue).toBe('(object)');
    });
  });

  describe('Import Detection', () => {
    it('should extract imports with specifiers', async () => {
      const testFile = path.join(tempDir, 'imports.ts');
      fs.writeFileSync(testFile, `
        import { parse } from '@typescript-eslint/parser';
        import * as fs from 'fs';
        import path from 'path';
        import './local-module';
      `);

      const entities = await extractor.extractFromFile(testFile);
      const packages = entities.filter(e => e.type === 'package');

      expect(packages.length).toBeGreaterThanOrEqual(4);
      
      const tsParser = packages.find(p => p.name === '@typescript-eslint/parser');
      expect(tsParser).toBeDefined();
      expect(tsParser?.category).toBe('external');
      expect(tsParser?.specifiers).toContain('parse');

      const localModule = packages.find(p => p.name === './local-module');
      expect(localModule).toBeDefined();
      expect(localModule?.category).toBe('internal');
    });
  });

  describe('React Component Detection', () => {
    it('should extract JSX components and props', async () => {
      const testFile = path.join(tempDir, 'component.tsx');
      fs.writeFileSync(testFile, `
        import React from 'react';

        export function App() {
          return (
            <div>
              <Header title="My App" subtitle="Welcome" />
              <Button onClick={handleClick} disabled={false} />
            </div>
          );
        }
      `);

      const entities = await extractor.extractFromFile(testFile);
      const components = entities.filter(e => e.type === 'component');

      expect(components.length).toBeGreaterThanOrEqual(3);
      
      const header = components.find(c => c.name === 'Header');
      expect(header).toBeDefined();
      expect(header?.category).toBe('jsx');
      expect(header?.props).toContain('title');
      expect(header?.props).toContain('subtitle');

      const button = components.find(c => c.name === 'Button');
      expect(button?.props).toContain('onClick');
      expect(button?.props).toContain('disabled');
    });
  });

  describe('Call Expression Detection', () => {
    it('should extract function calls', async () => {
      const testFile = path.join(tempDir, 'calls.ts');
      fs.writeFileSync(testFile, `
        console.log('Starting application');
        console.error('An error occurred');
        const result = calculateTotal(items);
        processData();
      `);

      const entities = await extractor.extractFromFile(testFile);
      const calls = entities.filter(e => e.name.startsWith('console.'));

      // Should find console.log and console.error calls
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Class and Interface Detection', () => {
    it('should extract class declarations', async () => {
      const testFile = path.join(tempDir, 'classes.ts');
      fs.writeFileSync(testFile, `
        export class UserService {
          private users: User[] = [];
          
          getUser(id: string): User | undefined {
            return this.users.find(u => u.id === id);
          }
        }

        class DatabaseConnection {
          connect() {}
        }
      `);

      const entities = await extractor.extractFromFile(testFile);
      const classes = entities.filter(e => e.type === 'class');

      expect(classes).toHaveLength(2);
      
      const userService = classes.find(c => c.name === 'UserService');
      expect(userService).toBeDefined();
      expect(userService?.isExported).toBe(true);
    });

    it('should extract interfaces and types', async () => {
      const testFile = path.join(tempDir, 'types.ts');
      fs.writeFileSync(testFile, `
        export interface User {
          id: string;
          name: string;
        }

        export type Status = 'active' | 'inactive';

        interface InternalConfig {
          debug: boolean;
        }
      `);

      const entities = await extractor.extractFromFile(testFile);
      const interfaces = entities.filter(e => e.type === 'interface');
      const types = entities.filter(e => e.type === 'type');

      expect(interfaces).toHaveLength(2);
      expect(types).toHaveLength(1);

      const user = interfaces.find(i => i.name === 'User');
      expect(user?.isExported).toBe(true);

      const status = types.find(t => t.name === 'Status');
      expect(status?.isExported).toBe(true);
    });
  });

  describe('Export Detection', () => {
    it('should correctly identify exported entities', async () => {
      const testFile = path.join(tempDir, 'exports.ts');
      fs.writeFileSync(testFile, `
        export const API_KEY = 'secret';
        export function publicFunction() {}
        export default class DefaultClass {}
        export { internalFunction };
        
        const PRIVATE_CONST = 'private';
        function internalFunction() {}
      `);

      const entities = await extractor.extractFromFile(testFile);
      
      const apiKey = entities.find(e => e.name === 'API_KEY');
      expect(apiKey?.isExported).toBe(true);

      const publicFn = entities.find(e => e.name === 'publicFunction');
      expect(publicFn?.isExported).toBe(true);

      const internalFn = entities.find(e => e.name === 'internalFunction');
      expect(internalFn?.isExported).toBe(true);
    });
  });

  describe('Confidence Scores', () => {
    it('should assign appropriate confidence scores', async () => {
      const testFile = path.join(tempDir, 'confidence.ts');
      fs.writeFileSync(testFile, `
        import { Something } from 'external-package';
        
        export function definedFunction() {}
        
        someUnknownCall();
      `);

      const entities = await extractor.extractFromFile(testFile);
      
      // Direct declarations should have high confidence
      const definedFn = entities.find(e => e.name === 'definedFunction' && e.type === 'function' && e.isExported !== undefined);
      expect(definedFn?.confidence).toBe(1);

      // Imports should have high confidence
      const importedPkg = entities.find(e => e.name === 'external-package');
      expect(importedPkg?.confidence).toBe(1);
    });
  });

  describe('Category Classification', () => {
    it('should correctly categorize entities', async () => {
      const testFile = path.join(tempDir, 'categories.ts');
      fs.writeFileSync(testFile, `
        import { external } from 'external-lib';
        import { internal } from './internal';
        
        console.log('builtin');
        
        function MyComponent() {
          return <div>JSX</div>;
        }
      `);

      const entities = await extractor.extractFromFile(testFile);
      
      const externalPkg = entities.find(e => e.name === 'external-lib');
      expect(externalPkg?.category).toBe('external');

      const internalPkg = entities.find(e => e.name === './internal');
      expect(internalPkg?.category).toBe('internal');

      const consoleLog = entities.find(e => e.name === 'console.log');
      expect(consoleLog?.category).toBe('builtin');
    });
  });

  describe('Relationships', () => {
    it('should create import relationships', async () => {
      const testFile = path.join(tempDir, 'relationships.ts');
      fs.writeFileSync(testFile, `
        import { parse, traverse } from 'ast-parser';
      `);

      const entities = await extractor.extractFromFile(testFile);
      
      const parseEntity = entities.find(e => e.name === 'parse' && e.relationships);
      expect(parseEntity).toBeDefined();
      expect(parseEntity?.relationships).toBeDefined();
      expect(parseEntity?.relationships?.[0].target).toBe('ast-parser');
      expect(parseEntity?.relationships?.[0].type).toBe('imports');
    });
  });
});
