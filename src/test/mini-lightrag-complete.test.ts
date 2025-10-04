/**
 * Mini-LightRAG Complete System Test Suite
 * 
 * This comprehensive test suite validates all Mini-LightRAG functionality across the system.
 * Covers core functionality, search engine, indexing, UI components, performance, and error handling.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface SearchResult {
  chunk: {
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    text: string;
    language?: string;
    fileType: 'code' | 'doc' | 'config' | 'test';
  };
  score: number;
  explanation: {
    vectorScore: number;
    graphScore: number;
    freshnessScore: number;
    whyRelevant: string;
  };
  relationships?: {
    similarChunks: string[];
    dependencies: string[];
    referencedBy: string[];
  };
}

interface SystemStatus {
  isInitialized: boolean;
  isIndexing: boolean;
  lastIndexTime: Date;
  stats: {
    totalFiles: number;
    indexedFiles: number;
    totalChunks: number;
    indexSize: string;
  };
  performance: {
    avgSearchTime: number;
    cacheHitRate: number;
    memoryUsage: string;
    lastOptimization: Date;
  };
  errors: {
    indexingErrors: string[];
    searchErrors: string[];
    systemErrors: string[];
  };
  health: 'healthy' | 'warning' | 'error';
}

interface IndexingResult {
  success: boolean;
  filesProcessed: number;
  chunksCreated: number;
  errors: string[];
  duration: number;
}

interface PerformanceMetrics {
  search: {
    totalQueries: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
  };
  indexing: {
    filesPerSecond: number;
    avgFileTime: number;
    totalIndexTime: number;
    failureRate: number;
  };
  memory: {
    currentUsage: string;
    peakUsage: string;
    gcFrequency: number;
    heapUtilization: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    sizeUtilization: number;
  };
}

// Test Framework Setup
describe('Mini-LightRAG Complete System Tests', () => {
  let testWorkspace: string;
  let lightragSystem: any;
  
  before(async () => {
    // Setup test workspace
    testWorkspace = await createTestWorkspace();
    
    // Initialize LightRAG
    await vscode.commands.executeCommand('cappy.lightrag.initialize', {
      workspacePath: testWorkspace
    });
    
    // Get system reference (commented out as not used in tests)
    // lightragSystem = await vscode.commands.executeCommand('cappy.lightrag.getSystem');
  });
  
  after(async () => {
    // Cleanup test workspace
    await cleanupTestWorkspace(testWorkspace);
  });

  // Core Functionality Tests
  describe('Core System Tests', () => {
    
    test('System Initialization', async () => {
      const status = await vscode.commands.executeCommand('cappy.lightrag.getStatus') as SystemStatus;
      
      assert.strictEqual(status.isInitialized, true);
      assert.strictEqual(status.health, 'healthy');
      assert.ok(status.stats.totalFiles > 0);
    });
    
    test('Configuration Management', async () => {
      const originalConfig = await vscode.commands.executeCommand('cappy.lightrag.getConfig') as any;
      
      // Update configuration
      const newConfig = {
        search: {
          maxResults: 15
        }
      };
      
      await vscode.commands.executeCommand('cappy.lightrag.updateConfig', { config: newConfig });
      
      const updatedConfig = await vscode.commands.executeCommand('cappy.lightrag.getConfig') as any;
      assert.strictEqual(updatedConfig.search.maxResults, 15);
      
      // Reset to original
      await vscode.commands.executeCommand('cappy.lightrag.updateConfig', { config: originalConfig });
    });
  });

  // Search Engine Tests
  describe('Search Engine Tests', () => {
    
    test('Basic Semantic Search', async () => {
      const results = await vscode.commands.executeCommand(
        'cappy.lightrag.search',
        'user authentication function'
      ) as SearchResult[];
      
      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      
      // Validate result structure
      const result = results[0];
      assert.ok(result.chunk.id);
      assert.ok(result.chunk.path);
      assert.ok(result.chunk.text);
      assert.ok(typeof result.score === 'number');
      assert.ok(result.score >= 0 && result.score <= 1);
    });
    
    test('Context-Aware Search', async () => {
      const document = await vscode.workspace.openTextDocument(
        path.join(testWorkspace, 'src/auth.ts')
      );
      
      const context = {
        workspacePath: testWorkspace,
        activeDocument: document,
        cursorContext: {
          line: 10,
          character: 5,
          surroundingText: 'function authenticateUser'
        }
      };
      
      const results = await vscode.commands.executeCommand(
        'cappy.lightrag.search',
        'login validation',
        context
      ) as SearchResult[];
      
      assert.ok(results.length > 0);
      // Results should be boosted by context
      assert.ok(results[0].score > 0.5);
    });
  });

  // Performance Tests
  describe('Performance Tests', () => {
    
    test('Search Performance', async () => {
      const queries = [
        'authentication function',
        'error handling pattern',
        'database connection',
        'validation logic',
        'async operation'
      ];
      
      const startTime = Date.now();
      
      for (const query of queries) {
        const results = await vscode.commands.executeCommand('cappy.lightrag.search', query) as SearchResult[];
        assert.ok(Array.isArray(results));
      }
      
      const totalTime = Date.now() - startTime;
      const avgTimePerQuery = totalTime / queries.length;
      
      // Should average less than 200ms per query
      assert.ok(avgTimePerQuery < 200, `Average search time too high: ${avgTimePerQuery}ms`);
    });
    
    test('Cache Performance', async () => {
      const query = 'test cache performance';
      
      // First search (cache miss)
      const start1 = Date.now();
      await vscode.commands.executeCommand('cappy.lightrag.search', query);
      const time1 = Date.now() - start1;
      
      // Second search (cache hit)
      const start2 = Date.now();
      await vscode.commands.executeCommand('cappy.lightrag.search', query);
      const time2 = Date.now() - start2;
      
      // Cached search should be significantly faster
      assert.ok(time2 < time1 * 0.5, `Cache not effective: ${time1}ms vs ${time2}ms`);
      
      // Check cache metrics
      const metrics = await vscode.commands.executeCommand('cappy.lightrag.getMetrics') as PerformanceMetrics;
      assert.ok(metrics.cache.hitRate > 0);
    });
    
    test('Memory Usage', async () => {
      const initialMetrics = await vscode.commands.executeCommand('cappy.lightrag.getMetrics') as PerformanceMetrics;
      
      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await vscode.commands.executeCommand('cappy.lightrag.search', `test query ${i}`);
      }
      
      const finalMetrics = await vscode.commands.executeCommand('cappy.lightrag.getMetrics') as PerformanceMetrics;
      
      // Memory should not increase excessively
      const initialMB = parseFloat(initialMetrics.memory.currentUsage);
      const finalMB = parseFloat(finalMetrics.memory.currentUsage);
      
      assert.ok(finalMB - initialMB < 100, 'Memory usage increased too much');
    });
  });

  // Error Handling Tests
  describe('Error Handling Tests', () => {
    
    test('Invalid Query Handling', async () => {
      const results = await vscode.commands.executeCommand(
        'cappy.lightrag.search',
        ''  // Empty query
      ) as SearchResult[];
      
      // Should return empty results, not throw error
      assert.ok(Array.isArray(results));
      assert.strictEqual(results.length, 0);
    });
    
    test('System Recovery', async () => {
      // Force an error condition
      await vscode.commands.executeCommand('cappy.lightrag.clearCache');
      
      // System should recover automatically
      const status = await vscode.commands.executeCommand('cappy.lightrag.getStatus') as SystemStatus;
      assert.strictEqual(status.health, 'healthy');
      
      // Should still be able to search
      const results = await vscode.commands.executeCommand(
        'cappy.lightrag.search',
        'recovery test'
      ) as SearchResult[];
      assert.ok(Array.isArray(results));
    });
  });

  // Integration Tests
  describe('Integration Tests', () => {
    
    test('Full Workflow Integration', async () => {
      // 1. Initialize system
      await vscode.commands.executeCommand('cappy.lightrag.initialize');
      
      // 2. Index workspace
      const indexResult = await vscode.commands.executeCommand('cappy.lightrag.indexWorkspace') as IndexingResult;
      assert.strictEqual(indexResult.success, true);
      
      // 3. Perform search
      const searchResults = await vscode.commands.executeCommand(
        'cappy.lightrag.search',
        'integration test function'
      ) as SearchResult[];
      assert.ok(Array.isArray(searchResults));
      
      // 4. Check status
      const status = await vscode.commands.executeCommand('cappy.lightrag.getStatus') as SystemStatus;
      assert.strictEqual(status.isInitialized, true);
      assert.strictEqual(status.health, 'healthy');
      
      // 5. Get metrics
      const metrics = await vscode.commands.executeCommand('cappy.lightrag.getMetrics') as PerformanceMetrics;
      assert.ok(metrics.search.totalQueries >= 0);
    });
  });
});

// Test Utilities
async function createTestWorkspace(): Promise<string> {
  const testDir = path.join(__dirname, '..', '..', 'test-workspace-temp');
  
  // Create workspace structure
  const structure: Record<string, string> = {
    'src/auth.ts': `
      export function authenticateUser(email: string, password: string): boolean {
        return validateCredentials(email, password);
      }
      
      function validateCredentials(email: string, password: string): boolean {
        return email.includes('@') && password.length > 6;
      }
    `,
    'src/database.ts': `
      export class DatabaseConnection {
        async connect(): Promise<void> {
          // Database connection logic
        }
        
        async query(sql: string): Promise<any[]> {
          // Query execution logic
          return [];
        }
      }
    `,
    'src/utils.ts': `
      export function handleError(error: Error): void {
        console.error('Application error:', error.message);
      }
      
      export function validateInput(input: string): boolean {
        return input && input.trim().length > 0;
      }
    `,
    'docs/README.md': `
      # Test Project
      
      This is a test project for LightRAG integration testing.
      
      ## Features
      - User authentication
      - Database operations
      - Error handling
    `,
    'package.json': JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    }, null, 2)
  };
  
  // Create files
  for (const [filePath, content] of Object.entries(structure)) {
    const fullPath = path.join(testDir, filePath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content);
  }
  
  return testDir;
}

async function cleanupTestWorkspace(workspacePath: string): Promise<void> {
  if (fs.existsSync(workspacePath)) {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
}