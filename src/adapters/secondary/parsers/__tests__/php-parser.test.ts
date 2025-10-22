/**
 * @fileoverview Unit tests for PHP Parser
 * @module adapters/secondary/parsers/__tests__/php-parser.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPHPParser, PHPParser } from '../php-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PHPParser', () => {
  let parser: PHPParser;
  let tempDir: string;

  beforeEach(() => {
    parser = createPHPParser();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'php-parser-test-'));
  });

  describe('Class Parsing', () => {
    it('should extract PHPDoc from a class', async () => {
      const phpCode = `<?php
/**
 * User authentication service
 * 
 * @package App\\Services
 * @author Test Author
 */
class AuthService
{
    public function login() {}
}`;
      
      const testFile = path.join(tempDir, 'test-class.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('AuthService');
      expect(chunks[0].metadata.symbolKind).toBe('class');
      expect(chunks[0].content).toContain('User authentication service');
      expect(chunks[0].metadata.lineStart).toBe(2);
    });

    it('should handle abstract classes', async () => {
      const phpCode = `<?php
/**
 * Abstract base controller
 */
abstract class BaseController
{
}`;
      
      const testFile = path.join(tempDir, 'abstract.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('BaseController');
      expect(chunks[0].metadata.symbolKind).toBe('class');
    });

    it('should handle final classes', async () => {
      const phpCode = `<?php
/**
 * Final utility class
 */
final class StringHelper
{
}`;
      
      const testFile = path.join(tempDir, 'final.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('StringHelper');
    });
  });

  describe('Method Parsing', () => {
    it('should extract PHPDoc from public methods', async () => {
      const phpCode = `<?php
class UserService
{
    /**
     * Creates a new user
     * 
     * @param array $data User data
     * @return User Created user instance
     */
    public function create(array $data): User
    {
        return new User($data);
    }
}`;
      
      const testFile = path.join(tempDir, 'method.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('create');
      expect(chunks[0].metadata.symbolKind).toBe('method');
      expect(chunks[0].metadata.visibility).toBe('public');
      expect(chunks[0].content).toContain('Creates a new user');
    });

    it('should extract PHPDoc from private methods', async () => {
      const phpCode = `<?php
class Helper
{
    /**
     * Internal helper method
     */
    private function internalHelper(): void
    {
    }
}`;
      
      const testFile = path.join(tempDir, 'private-method.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('internalHelper');
      expect(chunks[0].metadata.visibility).toBe('private');
    });

    it('should extract PHPDoc from protected methods', async () => {
      const phpCode = `<?php
class Base
{
    /**
     * Protected utility method
     */
    protected function utility(): void
    {
    }
}`;
      
      const testFile = path.join(tempDir, 'protected-method.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.visibility).toBe('protected');
    });

    it('should handle static methods', async () => {
      const phpCode = `<?php
class Factory
{
    /**
     * Creates instance
     */
    public static function create(): self
    {
        return new static();
    }
}`;
      
      const testFile = path.join(tempDir, 'static-method.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('create');
      expect(chunks[0].metadata.symbolKind).toBe('method');
    });
  });

  describe('Function Parsing', () => {
    it('should extract PHPDoc from global functions', async () => {
      const phpCode = `<?php
/**
 * Calculates the sum of two numbers
 * 
 * @param int $a First number
 * @param int $b Second number
 * @return int Sum of a and b
 */
function add(int $a, int $b): int
{
    return $a + $b;
}`;
      
      const testFile = path.join(tempDir, 'function.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('add');
      expect(chunks[0].metadata.symbolKind).toBe('function');
      expect(chunks[0].content).toContain('Calculates the sum');
    });
  });

  describe('Interface Parsing', () => {
    it('should extract PHPDoc from interfaces', async () => {
      const phpCode = `<?php
/**
 * Repository interface for user data access
 * 
 * @package App\\Repositories
 */
interface UserRepositoryInterface
{
    public function find(int $id): ?User;
}`;
      
      const testFile = path.join(tempDir, 'interface.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('UserRepositoryInterface');
      expect(chunks[0].metadata.symbolKind).toBe('interface');
      expect(chunks[0].content).toContain('Repository interface');
    });
  });

  describe('Trait Parsing', () => {
    it('should extract PHPDoc from traits', async () => {
      const phpCode = `<?php
/**
 * Provides timestamping functionality
 * 
 * @package App\\Traits
 */
trait Timestampable
{
    public function touch() {}
}`;
      
      const testFile = path.join(tempDir, 'trait.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('Timestampable');
      expect(chunks[0].metadata.symbolKind).toBe('trait');
      expect(chunks[0].content).toContain('timestamping functionality');
    });
  });

  describe('Property Parsing', () => {
    it('should extract PHPDoc from public properties', async () => {
      const phpCode = `<?php
class User
{
    /**
     * User email address
     * 
     * @var string
     */
    public $email;
}`;
      
      const testFile = path.join(tempDir, 'property.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('email');
      expect(chunks[0].metadata.symbolKind).toBe('property');
      expect(chunks[0].metadata.visibility).toBe('public');
      expect(chunks[0].content).toContain('User email address');
    });

    it('should handle readonly properties', async () => {
      const phpCode = `<?php
class DTO
{
    /**
     * Immutable ID
     */
    public readonly int $id;
}`;
      
      const testFile = path.join(tempDir, 'readonly.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('id');
      expect(chunks[0].metadata.symbolKind).toBe('property');
    });
  });

  describe('Constant Parsing', () => {
    it('should extract PHPDoc from constants', async () => {
      const phpCode = `<?php
class Config
{
    /**
     * Maximum upload size in bytes
     */
    public const MAX_UPLOAD_SIZE = 1048576;
}`;
      
      const testFile = path.join(tempDir, 'constant.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('MAX_UPLOAD_SIZE');
      expect(chunks[0].metadata.symbolKind).toBe('constant');
      expect(chunks[0].content).toContain('Maximum upload size');
    });

    it('should handle global constants', async () => {
      const phpCode = `<?php
/**
 * Application version
 */
const APP_VERSION = '1.0.0';`;
      
      const testFile = path.join(tempDir, 'global-const.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('APP_VERSION');
      expect(chunks[0].metadata.symbolKind).toBe('constant');
    });
  });

  describe('Multiple Symbols', () => {
    it('should extract PHPDoc from multiple symbols in one file', async () => {
      const phpCode = `<?php
/**
 * User model class
 */
class User
{
    /**
     * User name
     */
    public $name;

    /**
     * Gets the user name
     */
    public function getName(): string
    {
        return $this->name;
    }
}

/**
 * User repository
 */
class UserRepository
{
    /**
     * Finds user by ID
     */
    public function find(int $id): ?User
    {
        return null;
    }
}`;
      
      const testFile = path.join(tempDir, 'multiple.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(5);
      
      // Class User
      expect(chunks[0].metadata.symbolName).toBe('User');
      expect(chunks[0].metadata.symbolKind).toBe('class');
      
      // Property name
      expect(chunks[1].metadata.symbolName).toBe('name');
      expect(chunks[1].metadata.symbolKind).toBe('property');
      
      // Method getName
      expect(chunks[2].metadata.symbolName).toBe('getName');
      expect(chunks[2].metadata.symbolKind).toBe('method');
      
      // Class UserRepository
      expect(chunks[3].metadata.symbolName).toBe('UserRepository');
      expect(chunks[3].metadata.symbolKind).toBe('class');
      
      // Method find
      expect(chunks[4].metadata.symbolName).toBe('find');
      expect(chunks[4].metadata.symbolKind).toBe('method');
    });
  });

  describe('Edge Cases', () => {
    it('should ignore symbols without PHPDoc', async () => {
      const phpCode = `<?php
class Test
{
    // No PHPDoc
    public function noDoc() {}
    
    /**
     * Has documentation
     */
    public function hasDoc() {}
}`;
      
      const testFile = path.join(tempDir, 'no-doc.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.symbolName).toBe('hasDoc');
    });

    it('should handle empty files', async () => {
      const phpCode = `<?php\n// Empty file`;
      
      const testFile = path.join(tempDir, 'empty.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(0);
    });

    it('should handle multiline PHPDoc', async () => {
      const phpCode = `<?php
/**
 * This is a very long description
 * that spans multiple lines
 * and contains detailed information
 * about the class functionality
 * 
 * @author John Doe
 * @version 1.0.0
 * @package App
 */
class Example
{
}`;
      
      const testFile = path.join(tempDir, 'multiline.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('very long description');
      expect(chunks[0].content).toContain('spans multiple lines');
      expect(chunks[0].content).toContain('@author John Doe');
    });

    it('should generate unique chunk IDs', async () => {
      const phpCode = `<?php
/**
 * First class
 */
class First
{
}

/**
 * Second class
 */
class Second
{
}`;
      
      const testFile = path.join(tempDir, 'unique-ids.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].id).not.toBe(chunks[1].id);
      expect(chunks[0].id).toMatch(/chunk:unique-ids\.php:\d+-\d+/);
      expect(chunks[1].id).toMatch(/chunk:unique-ids\.php:\d+-\d+/);
    });

    it('should handle syntax errors gracefully', async () => {
      const phpCode = `<?php
/**
 * Invalid syntax
 */
class {{{ Invalid
}`;
      
      const testFile = path.join(tempDir, 'invalid.php');
      fs.writeFileSync(testFile, phpCode);

      // Should not throw, just return empty array
      const chunks = await parser.parseFile(testFile);
      
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Chunk Metadata', () => {
    it('should include correct file path', async () => {
      const phpCode = `<?php
/**
 * Test class
 */
class Test {}`;
      
      const testFile = path.join(tempDir, 'metadata.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks[0].metadata.filePath).toBe(testFile);
    });

    it('should include correct line numbers', async () => {
      const phpCode = `<?php
// Line 2
// Line 3
/**
 * Documented class on line 4-6
 */
class LineTest
{
    // Line 9
}`;
      
      const testFile = path.join(tempDir, 'lines.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks[0].metadata.lineStart).toBe(4);
      expect(chunks[0].metadata.lineEnd).toBeGreaterThan(4);
    });

    it('should set chunkType to phpdoc', async () => {
      const phpCode = `<?php
/**
 * Test
 */
class Test {}`;
      
      const testFile = path.join(tempDir, 'chunktype.php');
      fs.writeFileSync(testFile, phpCode);

      const chunks = await parser.parseFile(testFile);

      expect(chunks[0].metadata.chunkType).toBe('phpdoc');
    });
  });
});
