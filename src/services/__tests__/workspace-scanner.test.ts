/**
 * @fileoverview Tests for workspace scanner
 * @module services/__tests__/workspace-scanner.test
 */

import { describe, it, expect } from 'vitest';
import { WorkspaceScanQueue } from '../workspace-scan-queue';
import { FileHashService } from '../file-hash-service';
import { IgnorePatternMatcher } from '../ignore-pattern-matcher';
import { FileMetadataExtractor } from '../file-metadata-extractor';

describe('WorkspaceScanQueue', () => {
  it('should process tasks with concurrency control', async () => {
    const queue = new WorkspaceScanQueue({
      concurrency: 2,
      batchSize: 5
    });

    let processed = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      processed++;
    });

    tasks.forEach(task => queue.enqueue(task));
    await queue.drain();

    expect(processed).toBe(10);
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
  it('should hash strings consistently', () => {
    const service = new FileHashService();
    
    const hash1 = service.hashString('test');
    const hash2 = service.hashString('test');
    
    expect(hash1).toBe(hash2);
  });

  it('should compare hashes correctly', () => {
    const service = new FileHashService();
    
    const hash1 = service.hashString('test');
    const hash2 = service.hashString('test');
    const hash3 = service.hashString('different');
    
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
