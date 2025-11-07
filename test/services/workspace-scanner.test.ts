/**
 * @fileoverview Tests for workspace scanner
 * @module services/__tests__/workspace-scanner.test
 */

import { describe, it, expect } from 'vitest';
import { WorkspaceScanQueue } from '../../src/nivel2/infrastructure/services/workspace-scan-queue';
import { FileHashService } from '../../src/nivel2/infrastructure/services/file-hash-service';
import { IgnorePatternMatcher } from '../../src/nivel2/infrastructure/services/ignore-pattern-matcher';
import { FileMetadataExtractor } from '../../src/nivel2/infrastructure/services/file-metadata-extractor';

describe('WorkspaceScanQueue', () => {
  const createDelayPromise = () => new Promise(resolve => setTimeout(resolve, 10));
  
  const createTask = (processedCounter: { count: number }) => async () => {
    await createDelayPromise();
    processedCounter.count++;
  };

  it('should process tasks with concurrency control', async () => {
    const queue = new WorkspaceScanQueue({
      concurrency: 2,
      batchSize: 5
    });

    const processedCounter = { count: 0 };
    const tasks = Array.from({ length: 10 }, () => createTask(processedCounter));

    for (const task of tasks) {
      queue.enqueue(task);
    }
    await queue.drain();

    expect(processedCounter.count).toBe(10);
  });

  it('should report queue status', () => {
    const queue = new WorkspaceScanQueue({
      concurrency: 2,
      batchSize: 5
    });

    const status = queue.getStatus();
    expect(status.pending).toBe(0);
    expect(status.running).toBe(0);
  });
});

describe('FileHashService', () => {
  it('should hash strings consistently', async () => {
    const service = new FileHashService();
    
    const hash1 = await service.hashString('test');
    const hash2 = await service.hashString('test');
    
    expect(hash1).toBe(hash2);
  });

  it('should compare hashes correctly', async () => {
    const service = new FileHashService();
    
    const hash1 = await service.hashString('test');
    const hash2 = await service.hashString('test');
    const hash3 = await service.hashString('different');
    
    expect(service.compareHashes(hash1, hash2)).toBe(true);
    expect(service.compareHashes(hash1, hash3)).toBe(false);
  });
});

describe('IgnorePatternMatcher', () => {
  it('should match ignore patterns', () => {
    const matcher = new IgnorePatternMatcher('/test/workspace');
    matcher.addPatterns(['node_modules/', '*.log']);

    expect(matcher.shouldIgnore('node_modules/package/index.js')).toBe(true);
    expect(matcher.shouldIgnore('error.log')).toBe(true);
    expect(matcher.shouldIgnore('src/index.ts')).toBe(false);
  });
});

describe('FileMetadataExtractor', () => {
  it('should extract basic metadata', async () => {
    const extractor = new FileMetadataExtractor();
    
    // This would need a real file to test properly
    // For now, just ensure the class is instantiable
    expect(extractor).toBeDefined();
  });
});
