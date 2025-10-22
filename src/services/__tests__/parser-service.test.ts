/**
 * @fileoverview Unit tests for Parser Service
 * @module services/__tests__/parser-service.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createParserService, ParserService } from '../parser-service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ParserService', () => {
  let service: ParserService;
  let tempDir: string;

  beforeEach(() => {
    service = createParserService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-service-test-'));
  });

  describe('File Type Detection', () => {
    it('should detect TypeScript files', async () => {
      const tsCode = `
/**
 * Test function
 */
function test() {}`;
      
      const testFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunkType).toBe('jsdoc');
    });

    it('should detect JavaScript files', async () => {
      const jsCode = `
/**
 * Test function
 */
function test() {}`;
      
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, jsCode);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunkType).toBe('jsdoc');
    });

    it('should detect PHP files', async () => {
      const phpCode = `<?php
/**
 * Test class
 */
class Test {}`;
      
      const testFile = path.join(tempDir, 'test.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunkType).toBe('phpdoc');
    });

    it('should detect Markdown files', async () => {
      const mdContent = `## Test Section\n\nTest content`;
      
      const testFile = path.join(tempDir, 'test.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunkType).toBe('markdown_section');
    });

    it('should handle TSX files', async () => {
      const tsxCode = `
/**
 * React component
 */
function Component() {
  return <div>Test</div>;
}`;
      
      const testFile = path.join(tempDir, 'test.tsx');
      fs.writeFileSync(testFile, tsxCode);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle JSX files', async () => {
      const jsxCode = `
/**
 * React component
 */
function Component() {
  return <div>Test</div>;
}`;
      
      const testFile = path.join(tempDir, 'test.jsx');
      fs.writeFileSync(testFile, jsxCode);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle MDX files', async () => {
      const mdxContent = `## Test\n\nContent`;
      
      const testFile = path.join(tempDir, 'test.mdx');
      fs.writeFileSync(testFile, mdxContent);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript language', () => {
      expect(service.getLanguage('file.ts')).toBe('typescript');
      expect(service.getLanguage('file.tsx')).toBe('typescript');
    });

    it('should detect JavaScript language', () => {
      expect(service.getLanguage('file.js')).toBe('javascript');
      expect(service.getLanguage('file.jsx')).toBe('javascript');
    });

    it('should detect PHP language', () => {
      expect(service.getLanguage('file.php')).toBe('php');
    });

    it('should detect Markdown language', () => {
      expect(service.getLanguage('file.md')).toBe('markdown');
      expect(service.getLanguage('file.mdx')).toBe('markdown');
    });

    it('should return unknown for unsupported files', () => {
      expect(service.getLanguage('file.txt')).toBe('unknown');
      expect(service.getLanguage('file.json')).toBe('unknown');
    });
  });

  describe('File Support Detection', () => {
    it('should support TypeScript files', () => {
      expect(service.isSupported('file.ts')).toBe(true);
      expect(service.isSupported('file.tsx')).toBe(true);
    });

    it('should support JavaScript files', () => {
      expect(service.isSupported('file.js')).toBe(true);
      expect(service.isSupported('file.jsx')).toBe(true);
    });

    it('should support PHP files', () => {
      expect(service.isSupported('file.php')).toBe(true);
    });

    it('should support Markdown files', () => {
      expect(service.isSupported('file.md')).toBe(true);
      expect(service.isSupported('file.mdx')).toBe(true);
    });

    it('should not support unknown file types by default', () => {
      expect(service.isSupported('file.txt')).toBe(false);
      expect(service.isSupported('file.json')).toBe(false);
    });

    it('should support document files only when enhanced parsing is enabled', () => {
      expect(service.isSupported('file.pdf')).toBe(false);
      expect(service.isSupported('file.docx')).toBe(false);
      
      service.enableEnhancedParsing(true);
      
      expect(service.isSupported('file.pdf')).toBe(true);
      expect(service.isSupported('file.docx')).toBe(true);
    });
  });

  describe('Enhanced Parsing', () => {
    it('should start with enhanced parsing disabled', () => {
      expect(service.isEnhancedParsingEnabled()).toBe(false);
    });

    it('should enable enhanced parsing', () => {
      service.enableEnhancedParsing(true);
      expect(service.isEnhancedParsingEnabled()).toBe(true);
    });

    it('should disable enhanced parsing', () => {
      service.enableEnhancedParsing(true);
      service.enableEnhancedParsing(false);
      expect(service.isEnhancedParsingEnabled()).toBe(false);
    });
  });

  describe('Unsupported Files', () => {
    it('should return empty array for unsupported files', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'Plain text content');

      const chunks = await service.parseFile(testFile);

      expect(chunks).toHaveLength(0);
    });

    it('should return empty array for JSON files', async () => {
      const testFile = path.join(tempDir, 'test.json');
      fs.writeFileSync(testFile, '{"key": "value"}');

      const chunks = await service.parseFile(testFile);

      expect(chunks).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.ts');

      const chunks = await service.parseFile(nonExistentFile);

      expect(chunks).toHaveLength(0);
    });

    it('should handle files with syntax errors', async () => {
      const invalidCode = `function invalid( {{{ }`;
      const testFile = path.join(tempDir, 'invalid.ts');
      fs.writeFileSync(testFile, invalidCode);

      // Should not throw
      const chunks = await service.parseFile(testFile);
      
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Markdown Overlap', () => {
    it('should use overlap when requested for markdown', async () => {
      const mdContent = `## Section\n\n${'Word '.repeat(100)}`;
      const testFile = path.join(tempDir, 'overlap.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await service.parseFile(testFile, true);

      // With overlap, might get multiple chunks
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should not use overlap by default', async () => {
      const mdContent = `## Section\n\nContent`;
      const testFile = path.join(tempDir, 'no-overlap.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await service.parseFile(testFile, false);

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Multi-Language Support', () => {
    it('should parse multiple file types correctly', async () => {
      // TypeScript
      const tsFile = path.join(tempDir, 'test.ts');
      fs.writeFileSync(tsFile, '/** Test */ function test() {}');
      const tsChunks = await service.parseFile(tsFile);

      // PHP
      const phpFile = path.join(tempDir, 'test.php');
      fs.writeFileSync(phpFile, '<?php /** Test */ class Test {}');
      const phpChunks = await service.parseFile(phpFile);

      // Markdown
      const mdFile = path.join(tempDir, 'test.md');
      fs.writeFileSync(mdFile, '## Test\n\nContent');
      const mdChunks = await service.parseFile(mdFile);

      expect(tsChunks.length).toBeGreaterThan(0);
      expect(phpChunks.length).toBeGreaterThan(0);
      expect(mdChunks.length).toBeGreaterThan(0);

      expect(tsChunks[0].metadata.chunkType).toBe('jsdoc');
      expect(phpChunks[0].metadata.chunkType).toBe('phpdoc');
      expect(mdChunks[0].metadata.chunkType).toBe('markdown_section');
    });
  });

  describe('Factory Function', () => {
    it('should create a new ParserService instance', () => {
      const service1 = createParserService();
      const service2 = createParserService();

      expect(service1).toBeInstanceOf(ParserService);
      expect(service2).toBeInstanceOf(ParserService);
      expect(service1).not.toBe(service2);
    });
  });

  describe('Real World Examples', () => {
    it('should parse a complete TypeScript class', async () => {
      const tsCode = `
/**
 * User service class
 */
export class UserService {
  /**
   * Gets user by ID
   */
  getUser(id: string): User {
    return null;
  }

  /**
   * Creates a new user
   */
  createUser(data: UserData): User {
    return null;
  }
}`;
      
      const testFile = path.join(tempDir, 'user-service.ts');
      fs.writeFileSync(testFile, tsCode);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
      const classChunk = chunks.find(c => c.metadata.symbolName === 'UserService');
      expect(classChunk).toBeDefined();
    });

    it('should parse a complete PHP class', async () => {
      const phpCode = `<?php
/**
 * Authentication service
 */
class AuthService
{
    /**
     * Authenticates user
     */
    public function login(string $email, string $password): bool
    {
        return true;
    }

    /**
     * Logs out user
     */
    public function logout(): void
    {
    }
}`;
      
      const testFile = path.join(tempDir, 'auth-service.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
      const classChunk = chunks.find(c => c.metadata.symbolName === 'AuthService');
      const loginChunk = chunks.find(c => c.metadata.symbolName === 'login');
      
      expect(classChunk).toBeDefined();
      expect(loginChunk).toBeDefined();
      expect(loginChunk?.metadata.visibility).toBe('public');
    });

    it('should parse a complete Markdown document', async () => {
      const mdContent = `# Documentation

Introduction text.

## Installation

Installation instructions.

## Usage

Usage examples.

## API Reference

API documentation.`;
      
      const testFile = path.join(tempDir, 'readme.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await service.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(3);
      
      const installation = chunks.find(c => c.metadata.heading === 'Installation');
      const usage = chunks.find(c => c.metadata.heading === 'Usage');
      const api = chunks.find(c => c.metadata.heading === 'API Reference');

      expect(installation).toBeDefined();
      expect(usage).toBeDefined();
      expect(api).toBeDefined();
    });
  });
});
