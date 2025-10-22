/**
 * Comprehensive PHP Parser Test Suite
 * Tests all PHP parser features without vitest
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

async function runPHPTests() {
  console.log('🐘 PHP Parser - Comprehensive Test Suite\n');
  console.log('='.repeat(80));
  
  const { createPHPParser } = require('./out/adapters/secondary/parsers/php-parser');
  const parser = createPHPParser();
  
  let passed = 0;
  let failed = 0;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'php-test-'));

  // Test 1: Class with PHPDoc
  console.log('\n📝 Test 1: Class Declaration\n');
  const test1 = `<?php
/**
 * User authentication service
 * Handles login and logout operations
 * 
 * @package App\\Services
 * @author Test Author
 * @version 1.0.0
 */
class AuthService
{
    public function test() {}
}`;
  
  const file1 = path.join(tempDir, 'test1.php');
  fs.writeFileSync(file1, test1);
  const chunks1 = await parser.parseFile(file1);
  
  if (chunks1.length === 1) {
    console.log('✅ Extracts class PHPDoc');
    passed++;
  } else {
    console.log(`❌ Expected 1 chunk, got ${chunks1.length}`);
    failed++;
  }
  
  if (chunks1[0]?.metadata.symbolName === 'AuthService' && 
      chunks1[0]?.metadata.symbolKind === 'class') {
    console.log('✅ Correct symbol name and kind');
    passed++;
  } else {
    console.log('❌ Incorrect symbol metadata');
    failed++;
  }

  // Test 2: Public Method
  console.log('\n📝 Test 2: Public Method\n');
  const test2 = `<?php
class Test {
    /**
     * Authenticates user
     * @param string $email
     * @param string $password
     * @return bool
     */
    public function login(string $email, string $password): bool
    {
        return true;
    }
}`;
  
  const file2 = path.join(tempDir, 'test2.php');
  fs.writeFileSync(file2, test2);
  const chunks2 = await parser.parseFile(file2);
  
  if (chunks2.length === 1 && chunks2[0]?.metadata.symbolKind === 'method') {
    console.log('✅ Extracts method PHPDoc');
    passed++;
  } else {
    console.log('❌ Method extraction failed');
    failed++;
  }
  
  if (chunks2[0]?.metadata.visibility === 'public') {
    console.log('✅ Detects public visibility');
    passed++;
  } else {
    console.log('❌ Visibility detection failed');
    failed++;
  }

  // Test 3: Private Method
  console.log('\n📝 Test 3: Private Method\n');
  const test3 = `<?php
class Test {
    /**
     * Internal helper
     */
    private function helper(): void {}
}`;
  
  const file3 = path.join(tempDir, 'test3.php');
  fs.writeFileSync(file3, test3);
  const chunks3 = await parser.parseFile(file3);
  
  if (chunks3[0]?.metadata.visibility === 'private') {
    console.log('✅ Detects private visibility');
    passed++;
  } else {
    console.log('❌ Private visibility detection failed');
    failed++;
  }

  // Test 4: Protected Method
  console.log('\n📝 Test 4: Protected Method\n');
  const test4 = `<?php
class Test {
    /**
     * Protected utility
     */
    protected function utility(): void {}
}`;
  
  const file4 = path.join(tempDir, 'test4.php');
  fs.writeFileSync(file4, test4);
  const chunks4 = await parser.parseFile(file4);
  
  if (chunks4[0]?.metadata.visibility === 'protected') {
    console.log('✅ Detects protected visibility');
    passed++;
  } else {
    console.log('❌ Protected visibility detection failed');
    failed++;
  }

  // Test 5: Interface
  console.log('\n📝 Test 5: Interface Declaration\n');
  const test5 = `<?php
/**
 * User repository interface
 */
interface UserRepositoryInterface
{
    public function find(int $id): ?User;
}`;
  
  const file5 = path.join(tempDir, 'test5.php');
  fs.writeFileSync(file5, test5);
  const chunks5 = await parser.parseFile(file5);
  
  if (chunks5[0]?.metadata.symbolKind === 'interface') {
    console.log('✅ Extracts interface PHPDoc');
    passed++;
  } else {
    console.log('❌ Interface extraction failed');
    failed++;
  }

  // Test 6: Trait
  console.log('\n📝 Test 6: Trait Declaration\n');
  const test6 = `<?php
/**
 * Timestampable trait
 */
trait Timestampable
{
    public function touch() {}
}`;
  
  const file6 = path.join(tempDir, 'test6.php');
  fs.writeFileSync(file6, test6);
  const chunks6 = await parser.parseFile(file6);
  
  if (chunks6[0]?.metadata.symbolKind === 'trait') {
    console.log('✅ Extracts trait PHPDoc');
    passed++;
  } else {
    console.log('❌ Trait extraction failed');
    failed++;
  }

  // Test 7: Property
  console.log('\n📝 Test 7: Property Declaration\n');
  const test7 = `<?php
class User {
    /**
     * User email address
     * @var string
     */
    public $email;
}`;
  
  const file7 = path.join(tempDir, 'test7.php');
  fs.writeFileSync(file7, test7);
  const chunks7 = await parser.parseFile(file7);
  
  if (chunks7[0]?.metadata.symbolKind === 'property') {
    console.log('✅ Extracts property PHPDoc');
    passed++;
  } else {
    console.log('❌ Property extraction failed');
    failed++;
  }

  // Test 8: Constant
  console.log('\n📝 Test 8: Constant Declaration\n');
  const test8 = `<?php
class Config {
    /**
     * Max upload size
     */
    public const MAX_SIZE = 1048576;
}`;
  
  const file8 = path.join(tempDir, 'test8.php');
  fs.writeFileSync(file8, test8);
  const chunks8 = await parser.parseFile(file8);
  
  if (chunks8[0]?.metadata.symbolKind === 'constant') {
    console.log('✅ Extracts constant PHPDoc');
    passed++;
  } else {
    console.log('❌ Constant extraction failed');
    failed++;
  }

  // Test 9: Function
  console.log('\n📝 Test 9: Global Function\n');
  const test9 = `<?php
/**
 * Adds two numbers
 * @param int $a
 * @param int $b
 * @return int
 */
function add(int $a, int $b): int
{
    return $a + $b;
}`;
  
  const file9 = path.join(tempDir, 'test9.php');
  fs.writeFileSync(file9, test9);
  const chunks9 = await parser.parseFile(file9);
  
  if (chunks9[0]?.metadata.symbolKind === 'function') {
    console.log('✅ Extracts function PHPDoc');
    passed++;
  } else {
    console.log('❌ Function extraction failed');
    failed++;
  }

  // Test 10: Multiple Symbols
  console.log('\n📝 Test 10: Multiple Symbols in One File\n');
  const test10 = `<?php
/**
 * User class
 */
class User
{
    /**
     * User name
     */
    public $name;

    /**
     * Gets name
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
     * Finds user
     */
    public function find(int $id): ?User
    {
        return null;
    }
}`;
  
  const file10 = path.join(tempDir, 'test10.php');
  fs.writeFileSync(file10, test10);
  const chunks10 = await parser.parseFile(file10);
  
  if (chunks10.length === 5) {
    console.log('✅ Extracts multiple symbols (5 chunks)');
    console.log('   - Class User');
    console.log('   - Property $name');
    console.log('   - Method getName()');
    console.log('   - Class UserRepository');
    console.log('   - Method find()');
    passed++;
  } else {
    console.log(`❌ Expected 5 chunks, got ${chunks10.length}`);
    failed++;
  }

  // Test 11: Chunk Type
  console.log('\n📝 Test 11: Chunk Type Verification\n');
  if (chunks1[0]?.metadata.chunkType === 'phpdoc') {
    console.log('✅ Correct chunk type (phpdoc)');
    passed++;
  } else {
    console.log('❌ Incorrect chunk type');
    failed++;
  }

  // Test 12: Chunk ID Format
  console.log('\n📝 Test 12: Chunk ID Format\n');
  const chunkId = chunks1[0]?.id;
  if (chunkId && chunkId.startsWith('chunk:') && chunkId.includes(':')) {
    console.log(`✅ Correct chunk ID format: ${chunkId}`);
    passed++;
  } else {
    console.log('❌ Incorrect chunk ID format');
    failed++;
  }

  // Test 13: Line Numbers
  console.log('\n📝 Test 13: Line Number Tracking\n');
  if (chunks1[0]?.metadata.lineStart > 0 && 
      chunks1[0]?.metadata.lineEnd >= chunks1[0]?.metadata.lineStart) {
    console.log(`✅ Line numbers tracked: ${chunks1[0].metadata.lineStart}-${chunks1[0].metadata.lineEnd}`);
    passed++;
  } else {
    console.log('❌ Line number tracking failed');
    failed++;
  }

  // Test 14: No PHPDoc - Should Skip
  console.log('\n📝 Test 14: Skip Symbols Without PHPDoc\n');
  const test14 = `<?php
class NoDoc {
    // No PHPDoc here
    public function noDoc() {}
    
    /**
     * Has doc
     */
    public function hasDoc() {}
}`;
  
  const file14 = path.join(tempDir, 'test14.php');
  fs.writeFileSync(file14, test14);
  const chunks14 = await parser.parseFile(file14);
  
  if (chunks14.length === 1 && chunks14[0]?.metadata.symbolName === 'hasDoc') {
    console.log('✅ Correctly skips symbols without PHPDoc');
    passed++;
  } else {
    console.log('❌ Should only extract documented symbols');
    failed++;
  }

  // Test 15: Abstract Class
  console.log('\n📝 Test 15: Abstract Class\n');
  const test15 = `<?php
/**
 * Abstract base controller
 */
abstract class BaseController
{
}`;
  
  const file15 = path.join(tempDir, 'test15.php');
  fs.writeFileSync(file15, test15);
  const chunks15 = await parser.parseFile(file15);
  
  if (chunks15[0]?.metadata.symbolName === 'BaseController') {
    console.log('✅ Handles abstract classes');
    passed++;
  } else {
    console.log('❌ Abstract class handling failed');
    failed++;
  }

  // Test 16: Final Class
  console.log('\n📝 Test 16: Final Class\n');
  const test16 = `<?php
/**
 * Final utility class
 */
final class StringHelper
{
}`;
  
  const file16 = path.join(tempDir, 'test16.php');
  fs.writeFileSync(file16, test16);
  const chunks16 = await parser.parseFile(file16);
  
  if (chunks16[0]?.metadata.symbolName === 'StringHelper') {
    console.log('✅ Handles final classes');
    passed++;
  } else {
    console.log('❌ Final class handling failed');
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 PHP Parser Test Summary\n');
  console.log(`✅ Passed: ${passed}/17 (${Math.round(passed/17*100)}%)`);
  console.log(`❌ Failed: ${failed}/17`);
  
  console.log('\n' + '='.repeat(80));
  
  if (failed === 0) {
    console.log('\n🎉 All PHP Parser tests passed!\n');
    return 0;
  } else {
    console.log('\n❌ Some tests failed!\n');
    return 1;
  }
}

// Run tests
runPHPTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
