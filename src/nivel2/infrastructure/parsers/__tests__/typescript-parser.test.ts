/**
 * @fileoverview Unit tests for TypeScript Parser
 * @module adapters/secondary/parsers/__tests__/typescript-parser.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTypeScriptParser, TypeScriptParser } from '../typescript-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TypeScriptParser', () => {
  let parser: TypeScriptParser;
  let tempDir: string;

  beforeEach(() => {
    parser = createTypeScriptParser();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-parser-test-'));
  });

  describe('Function Parsing', () => {
    it('should extract JSDoc from function declarations', async () => {
      const tsCode = `
/**
 * Adds two numbers together
 * 
 * @param a First number
 * @param b Second number
 * @returns Sum of a and b
 */
function add(a: number, b: number): number {
  return a + b;
}`;
      
      const testFile = path.join(tempDir, 'function.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('add');
      expect(chunks[0].metadata.symbolKind).toBe('function');
      expect(chunks[0].content).toContain('Adds two numbers');
      expect(chunks[0].metadata.chunkType).toBe('jsdoc');
    });

    it('should extract JSDoc from arrow functions assigned to variables', async () => {
      const tsCode = `
/**
 * Multiplies two numbers
 */
const multiply = (a: number, b: number): number => {
  return a * b;
};`;
      
      const testFile = path.join(tempDir, 'arrow.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('multiply');
      expect(chunks[0].metadata.symbolKind).toBe('variable');
    });
  });

  describe('Class Parsing', () => {
    it('should extract JSDoc from class declarations', async () => {
      const tsCode = `
/**
 * User model class
 * 
 * Represents a user in the system
 * @class
 */
class User {
  constructor(public name: string) {}
}`;
      
      const testFile = path.join(tempDir, 'class.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('User');
      expect(chunks[0].metadata.symbolKind).toBe('class');
      expect(chunks[0].content).toContain('User model class');
    });

    it('should extract JSDoc from exported classes', async () => {
      const tsCode = `
/**
 * Exported service class
 */
export class UserService {
  getUser(id: string) {}
}`;
      
      const testFile = path.join(tempDir, 'export-class.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('UserService');
    });
  });

  describe('Interface Parsing', () => {
    it('should extract JSDoc from interface declarations', async () => {
      const tsCode = `
/**
 * User interface definition
 * 
 * @interface
 */
interface IUser {
  id: string;
  name: string;
  email: string;
}`;
      
      const testFile = path.join(tempDir, 'interface.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('IUser');
      expect(chunks[0].metadata.symbolKind).toBe('interface');
      expect(chunks[0].content).toContain('User interface definition');
    });

    it('should handle exported interfaces', async () => {
      const tsCode = `
/**
 * Configuration interface
 */
export interface Config {
  apiKey: string;
}`;
      
      const testFile = path.join(tempDir, 'export-interface.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('Config');
      expect(chunks[0].metadata.symbolKind).toBe('interface');
    });
  });

  describe('Type Alias Parsing', () => {
    it('should extract JSDoc from type aliases', async () => {
      const tsCode = `
/**
 * User ID type
 * 
 * Represents a unique identifier for users
 */
type UserId = string | number;`;
      
      const testFile = path.join(tempDir, 'type.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('UserId');
      expect(chunks[0].metadata.symbolKind).toBe('type');
      expect(chunks[0].content).toContain('User ID type');
    });
  });

  describe('Variable Parsing', () => {
    it('should extract JSDoc from const declarations', async () => {
      const tsCode = `
/**
 * Maximum retry attempts
 */
const MAX_RETRIES = 3;`;
      
      const testFile = path.join(tempDir, 'const.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('MAX_RETRIES');
      expect(chunks[0].metadata.symbolKind).toBe('variable');
    });

    it('should handle let declarations', async () => {
      const tsCode = `
/**
 * Current counter value
 */
let counter = 0;`;
      
      const testFile = path.join(tempDir, 'let.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('counter');
    });
  });

  describe('Multiple Symbols', () => {
    it('should extract JSDoc from multiple symbols', async () => {
      const tsCode = `
/**
 * User interface
 */
interface User {
  id: string;
}

/**
 * Creates a new user
 */
function createUser(name: string): User {
  return { id: '1' };
}

/**
 * User service class
 */
class UserService {
  constructor() {}
}`;
      
      const testFile = path.join(tempDir, 'multiple.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(3);
      expect(chunks[0].metadata.symbolKind).toBe('interface');
      expect(chunks[1].metadata.symbolKind).toBe('function');
      expect(chunks[2].metadata.symbolKind).toBe('class');
    });
  });

  describe('Edge Cases', () => {
    it('should ignore symbols without JSDoc', async () => {
      const tsCode = `
// No JSDoc comment
function noDoc() {}

/**
 * Has JSDoc
 */
function withDoc() {}`;
      
      const testFile = path.join(tempDir, 'no-doc.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('withDoc');
    });

    it('should handle empty files', async () => {
      const tsCode = `// Empty file`;
      
      const testFile = path.join(tempDir, 'empty.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(0);
    });

    it('should handle files without JSDoc', async () => {
      const tsCode = `
class Test {
  method() {}
}`;
      
      const testFile = path.join(tempDir, 'no-jsdoc.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(0);
    });

    it('should handle multiline JSDoc', async () => {
      const tsCode = `
/**
 * This is a very detailed description
 * that spans multiple lines
 * and contains lots of information
 * 
 * @param param1 First parameter
 * @param param2 Second parameter
 * @returns The result
 * @throws Error if something goes wrong
 * @example
 * const result = myFunction('a', 'b');
 */
function myFunction(param1: string, param2: string): string {
  return param1 + param2;
}`;
      
      const testFile = path.join(tempDir, 'multiline.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('very detailed description');
      expect(chunks[0].content).toContain('@param param1');
      expect(chunks[0].content).toContain('@example');
    });
  });

  describe('JSX Support', () => {
    it('should parse TypeScript files with JSX', async () => {
      const tsxCode = `
/**
 * User component
 */
function UserComponent(props: { name: string }) {
  return <div>{props.name}</div>;
}`;
      
      const testFile = path.join(tempDir, 'component.tsx');
      fs.writeFileSync(testFile, tsxCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('UserComponent');
    });
  });

  describe('Chunk Metadata', () => {
    it('should include correct metadata', async () => {
      const tsCode = `
/**
 * Test function
 */
function test() {}`;
      
      const testFile = path.join(tempDir, 'metadata.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks[0].id).toMatch(/chunk:.*metadata\.ts:\d+-\d+/);
      expect(chunks[0].metadata.filePath).toBe(testFile);
      expect(chunks[0].metadata.lineStart).toBeGreaterThan(0);
      expect(chunks[0].metadata.lineEnd).toBeGreaterThan(chunks[0].metadata.lineStart);
      expect(chunks[0].metadata.chunkType).toBe('jsdoc');
    });

    it('should generate unique chunk IDs', async () => {
      const tsCode = `
/**
 * First
 */
function first() {}

/**
 * Second
 */
function second() {}`;
      
      const testFile = path.join(tempDir, 'unique.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].id).not.toBe(chunks[1].id);
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors gracefully', async () => {
      const tsCode = `
/**
 * Invalid syntax
 */
function invalid( {{{ }`;
      
      const testFile = path.join(tempDir, 'invalid.ts');
      fs.writeFileSync(testFile, tsCode);

      // Should not throw, just return empty array
      const chunks = await parser.parseFile(testFile);
      
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle missing files gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.ts');

      const chunks = await parser.parseFile(nonExistentFile);
      
      expect(chunks).toHaveLength(0);
    });
  });
});
