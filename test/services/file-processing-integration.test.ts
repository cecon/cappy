/**
 * @fileoverview Simplified integration test for file processing queue system
 * @module services/__tests__/file-processing-integration.test
 * @author Cappy Team
 * @since 3.0.5
 * 
 * NOTE: Simplified version using only SQLite (no vector/graph stores)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileMetadataDatabase } from '../../src/nivel2/infrastructure/services/file-metadata-database';
import { FileProcessingQueue } from '../../src/nivel2/infrastructure/services/file-processing-queue';
import { FileProcessingWorker } from '../../src/nivel2/infrastructure/services/file-processing-worker';
import { ParserService } from '../../src/nivel2/infrastructure/services/parser-service';
import { FileHashService } from '../../src/nivel2/infrastructure/services/file-hash-service';

/**
 * Test workspace structure
 */
interface TestWorkspace {
  rootDir: string;
  dbPath: string;
  testFilePath: string;
}

/**
 * Sample TypeScript file content for testing
 */
const SAMPLE_TS_FILE = `/**
 * @fileoverview Sample user service for testing
 * @module services/user-service
 */

/**
 * Represents a user in the system
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

/**
 * User service for managing user operations
 */
export class UserService {
  private users: Map<string, User> = new Map();

  /**
   * Creates a new user
   * @param name - The user's name
   * @param email - The user's email address
   * @returns The created user object
   * @throws Error if email is invalid
   */
  async createUser(name: string, email: string): Promise<User> {
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email address');
    }

    const user: User = {
      id: this.generateId(),
      name,
      email,
      createdAt: new Date()
    };

    this.users.set(user.id, user);
    return user;
  }

  /**
   * Retrieves a user by ID
   * @param id - The user ID
   * @returns The user object or undefined if not found
   */
  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  /**
   * Updates a user's information
   * @param id - The user ID
   * @param updates - Partial user object with fields to update
   * @returns The updated user object
   * @throws Error if user not found
   */
  async updateUser(id: string, updates: Partial<Omit<User, 'id'>>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(\`User not found: \${id}\`);
    }

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  /**
   * Deletes a user from the system
   * @param id - The user ID
   * @returns True if user was deleted, false if not found
   */
  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  /**
   * Lists all users in the system
   * @returns Array of all users
   */
  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  /**
   * Validates an email address format
   * @param email - The email to validate
   * @returns True if valid, false otherwise
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generates a unique user ID
   * @returns A unique string ID
   */
  private generateId(): string {
    return \`user-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`;
  }
}

/**
 * Factory function to create a user service instance
 * @returns A new UserService instance
 */
export function createUserService(): UserService {
  return new UserService();
}
`;

/**
 * Creates a temporary test workspace
 */
function createTestWorkspace(): TestWorkspace {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cappy-test-'));
  const dbPath = path.join(rootDir, 'metadata.db');
  const testFilePath = path.join(rootDir, 'user-service.ts');

  // Create test file
  fs.writeFileSync(testFilePath, SAMPLE_TS_FILE, 'utf-8');

  return { rootDir, dbPath, testFilePath };
}

/**
 * Cleans up test workspace
 */
function cleanupTestWorkspace(workspace: TestWorkspace): void {
  try {
    if (fs.existsSync(workspace.rootDir)) {
      fs.rmSync(workspace.rootDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Failed to cleanup test workspace:', error);
  }
}

/**
 * Waits for a condition to be true or timeout
 */
async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 30000,
  interval: number = 500
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

describe('File Processing Integration Test (SQLite Only)', () => {
  let workspace: TestWorkspace;
  let database: FileMetadataDatabase;
  let queue: FileProcessingQueue;

  beforeAll(() => {
    console.log('🚀 Starting file processing integration test (SQLite only)...');
  });

  afterAll(() => {
    console.log('✅ File processing integration test completed');
  });

  beforeEach(() => {
    // Create fresh workspace for each test
    workspace = createTestWorkspace();
    console.log(`📁 Test workspace created: ${workspace.rootDir}`);
  });

  afterEach(() => {
    // Cleanup after each test
    if (queue) {
      queue.stop();
    }
    if (database) {
      database.close();
    }
    
    cleanupTestWorkspace(workspace);
    console.log('🗑️  Test workspace cleaned up');
  });

  it('should process TypeScript file and track chunks in SQLite', async () => {
    console.log('\n📝 Test: Complete file processing workflow (SQLite)');
    
    // ============================================
    // STEP 1: Initialize all services
    // ============================================
    console.log('⚙️  Step 1: Initializing services...');
    
    // Initialize database
    database = new FileMetadataDatabase(workspace.dbPath);
    await database.initialize();
    console.log('  ✓ SQLite database initialized');

    // Initialize parser and hash services
    const parserService = new ParserService();
    const hashService = new FileHashService();
    console.log('  ✓ Parser and hash services initialized');

    // Initialize worker
    const worker = new FileProcessingWorker(
      parserService,
      hashService,
      workspace.rootDir
    );
    console.log('  ✓ Worker initialized');

    // Initialize queue
    queue = new FileProcessingQueue(database, worker, {
      concurrency: 1,
      maxRetries: 3,
      autoStart: true
    });
    console.log('  ✓ Queue initialized and started');

    // ============================================
    // STEP 2: Setup event listeners (BEFORE enqueue)
    // ============================================
    console.log('\n⚙️  Step 2: Setting up event listeners...');
    
    let processingStarted = false;
    let processingCompleted = false;
    let processingFailed = false;
    let lastProgress = 0;

    // Listen to queue events BEFORE enqueueing
    queue.on('file:start', (metadata) => {
      processingStarted = true;
      console.log(`  🔄 Processing started: ${metadata.fileName}`);
    });

    queue.on('file:progress', (metadata) => {
      if (metadata.progress && metadata.progress > lastProgress) {
        lastProgress = metadata.progress;
        console.log(`  📊 Progress: ${metadata.progress}% - ${metadata.currentStep}`);
      }
    });

    queue.on('file:complete', (_metadata, result) => {
      processingCompleted = true;
      console.log(`  ✅ Processing completed!`);
      console.log(`     - Chunks: ${result.chunksCount}`);
      console.log(`     - Nodes: ${result.nodesCount}`);
      console.log(`     - Relationships: ${result.relationshipsCount}`);
      console.log(`     - Duration: ${result.duration}ms`);
    });

    queue.on('file:failed', (_metadata, error) => {
      processingFailed = true;
      console.error(`  ❌ Processing failed: ${error.message}`);
    });
    
    console.log('  ✓ Event listeners registered');

    // ============================================
    // STEP 3: Enqueue test file
    // ============================================
    console.log('\n⚙️  Step 3: Enqueuing test file...');
    
    const fileHash = await hashService.hashFile(workspace.testFilePath);
    const fileId = await queue.enqueue(workspace.testFilePath, fileHash);
    
    console.log(`  ✓ File enqueued with ID: ${fileId}`);
    console.log(`  ✓ File path: ${workspace.testFilePath}`);
    console.log(`  ✓ File hash: ${fileHash}`);

    // Verify file is in database (status can be 'pending' or 'processing' depending on timing)
    await waitFor(async () => {
      const meta = await database.getFile(fileId);
      return !!meta;
    }, 2000, 100);
    const fileMetadata = await database.getFile(fileId);
    expect(fileMetadata).toBeDefined();
    expect(['pending', 'processing']).toContain(fileMetadata?.status);
    console.log(`  ✓ File metadata saved with status: ${fileMetadata?.status}`);

    // ============================================
    // STEP 4: Wait for processing to complete
    // ============================================
    console.log('\n⚙️  Step 4: Waiting for file processing...');

    // Wait for processing to complete (max 30 seconds)
    await waitFor(() => processingCompleted || processingFailed, 30000);

    expect(processingFailed).toBe(false);
    expect(processingStarted).toBe(true);
    expect(processingCompleted).toBe(true);

    // Wait for database to be fully updated with 100% progress
    await waitFor(async () => {
      const meta = await database.getFile(fileId);
      return meta?.progress === 100;
    }, 2000, 100);

    // Verify final status in database
  const finalMetadata = await database.getFile(fileId);
    expect(finalMetadata?.status).toBe('completed');
    expect(finalMetadata?.progress).toBe(100);
    expect(finalMetadata?.chunksCount).toBeGreaterThan(0);
    console.log(`  ✓ Final status: ${finalMetadata?.status}`);
    console.log(`  ✓ Chunks processed: ${finalMetadata?.chunksCount}`);

    // ============================================
    // STEP 5: Verify queue statistics
    // ============================================
    console.log('\n⚙️  Step 5: Verifying queue statistics...');

  const stats = await queue.getStats();
    expect(stats.total).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.pending).toBe(0);
    expect(stats.processing).toBe(0);
    expect(stats.failed).toBe(0);
    
    console.log(`  ✓ Queue statistics:`);
    console.log(`     - Total: ${stats.total}`);
    console.log(`     - Completed: ${stats.completed}`);
    console.log(`     - Pending: ${stats.pending}`);
    console.log(`     - Processing: ${stats.processing}`);
    console.log(`     - Failed: ${stats.failed}`);

    console.log('\n✨ All verifications passed!');
  }, 60000); // 60 second timeout for the entire test

  it('should handle file processing failure and retry', async () => {
    console.log('\n📝 Test: Error handling and retry mechanism');
    
    // Initialize services
    database = new FileMetadataDatabase(workspace.dbPath);
    await database.initialize();

    const parserService = new ParserService();
    const hashService = new FileHashService();

    const worker = new FileProcessingWorker(
      parserService,
      hashService,
      workspace.rootDir
    );

    queue = new FileProcessingQueue(database, worker, {
      concurrency: 1,
      maxRetries: 2,
      retryDelay: 1000,
      autoStart: true
    });

    // Create a non-existent file path
    const invalidPath = path.join(workspace.rootDir, 'non-existent.ts');
    
    let failureDetected = false;
    queue.on('file:failed', (_metadata, error) => {
      failureDetected = true;
      console.log(`  ✓ Failure detected: ${error.message}`);
    });

    // Enqueue invalid file
    const fileId = await queue.enqueue(invalidPath, 'fake-hash');
    console.log(`  ✓ Invalid file enqueued: ${fileId}`);

    // Wait for failure
    await waitFor(() => failureDetected, 10000);

    // Wait for retries to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  const finalMetadata = await database.getFile(fileId);
    expect(finalMetadata?.status).toBe('failed');
    expect(finalMetadata?.retryCount).toBeGreaterThan(0);
    
    console.log(`  ✓ File marked as failed after ${finalMetadata?.retryCount} retries`);
    console.log(`  ✓ Error message: ${finalMetadata?.errorMessage}`);
  }, 30000);
});
