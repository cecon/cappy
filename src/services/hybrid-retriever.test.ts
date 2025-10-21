/**
 * @fileoverview Tests for HybridRetriever
 * @module services/hybrid-retriever.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HybridRetriever, type HybridRetrieverOptions } from './hybrid-retriever';
import type { GraphData } from '../domains/graph/types';

describe('HybridRetriever', () => {
  let retriever: HybridRetriever;
  let mockGraphData: GraphData;
  
  beforeEach(() => {
    // Create mock graph data
    mockGraphData = {
      nodes: [
        {
          id: 'func1',
          label: 'authenticateUser',
          type: 'function',
          metadata: {
            filePath: '/src/auth/authenticate.ts',
            signature: 'function authenticateUser(token: string): Promise<User>',
            description: 'Authenticates a user using JWT token'
          }
        },
        {
          id: 'func2',
          label: 'validateToken',
          type: 'function',
          metadata: {
            filePath: '/src/auth/jwt.ts',
            signature: 'function validateToken(token: string): boolean',
            description: 'Validates JWT token structure and expiration'
          }
        },
        {
          id: 'class1',
          label: 'UserService',
          type: 'class',
          metadata: {
            filePath: '/src/services/user.service.ts',
            description: 'Service for user management operations'
          }
        }
      ],
      edges: [
        {
          id: 'edge1',
          source: 'func1',
          target: 'func2',
          type: 'calls',
          label: 'calls'
        }
      ],
      metadata: {
        nodeCount: 3,
        edgeCount: 1,
        generatedAt: new Date().toISOString()
      }
    };
    
    retriever = new HybridRetriever(mockGraphData);
  });
  
  describe('retrieve', () => {
    it('should retrieve contexts from code graph', async () => {
      const result = await retriever.retrieve('authentication', {
        sources: ['code'],
        maxResults: 10,
        minScore: 0.3
      });
      
      expect(result.contexts.length).toBeGreaterThan(0);
      expect(result.metadata.query).toBe('authentication');
      expect(result.metadata.strategy).toBe('hybrid');
      expect(result.contexts[0].source).toBe('code');
    });
    
    it('should filter by minimum score', async () => {
      const result = await retriever.retrieve('auth', {
        sources: ['code'],
        minScore: 0.7
      });
      
      result.contexts.forEach(ctx => {
        expect(ctx.score).toBeGreaterThanOrEqual(0.7);
      });
    });
    
    it('should limit results to maxResults', async () => {
      const maxResults = 2;
      const result = await retriever.retrieve('user', {
        sources: ['code'],
        maxResults
      });
      
      expect(result.contexts.length).toBeLessThanOrEqual(maxResults);
    });
    
    it('should sort results by score descending', async () => {
      const result = await retriever.retrieve('token', {
        sources: ['code'],
        maxResults: 10
      });
      
      for (let i = 0; i < result.contexts.length - 1; i++) {
        expect(result.contexts[i].score).toBeGreaterThanOrEqual(
          result.contexts[i + 1].score
        );
      }
    });
    
    it('should throw error for empty query', async () => {
      await expect(
        retriever.retrieve('', { sources: ['code'] })
      ).rejects.toThrow('Query cannot be empty');
    });
    
    it('should include metadata in result', async () => {
      const result = await retriever.retrieve('auth', {
        sources: ['code']
      });
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.query).toBe('auth');
      expect(result.metadata.totalFound).toBeGreaterThanOrEqual(result.metadata.returned);
      expect(result.metadata.retrievalTimeMs).toBeGreaterThan(0);
      expect(result.metadata.sourceBreakdown).toBeDefined();
    });
  });
  
  describe('retrieval strategies', () => {
    it('should support hybrid strategy', async () => {
      const result = await retriever.retrieve('auth', {
        strategy: 'hybrid',
        sources: ['code']
      });
      
      expect(result.metadata.strategy).toBe('hybrid');
    });
    
    it('should support graph strategy', async () => {
      const result = await retriever.retrieve('user', {
        strategy: 'graph',
        sources: ['code']
      });
      
      expect(result.metadata.strategy).toBe('graph');
    });
    
    it('should support keyword strategy', async () => {
      const result = await retriever.retrieve('service', {
        strategy: 'keyword',
        sources: ['code']
      });
      
      expect(result.metadata.strategy).toBe('keyword');
    });
  });
  
  describe('weighted scoring', () => {
    it('should apply custom weights to sources', async () => {
      const options: HybridRetrieverOptions = {
        sources: ['code'],
        codeWeight: 0.8,
        docWeight: 0.2,
        maxResults: 10
      };
      
      const result = await retriever.retrieve('auth', options);
      
      // Contexts from code should have higher scores due to weight
      const codeContexts = result.contexts.filter(ctx => ctx.source === 'code');
      expect(codeContexts.length).toBeGreaterThan(0);
    });
  });
  
  describe('re-ranking', () => {
    it('should re-rank results when enabled', async () => {
      const result = await retriever.retrieve('authentication', {
        sources: ['code'],
        rerank: true
      });
      
      expect(result.metadata.reranked).toBe(true);
    });
    
    it('should skip re-ranking when disabled', async () => {
      const result = await retriever.retrieve('auth', {
        sources: ['code'],
        rerank: false
      });
      
      expect(result.metadata.reranked).toBe(false);
    });
  });
  
  describe('context extraction', () => {
    it('should extract node content correctly', async () => {
      const result = await retriever.retrieve('authenticateUser', {
        sources: ['code'],
        maxResults: 1
      });
      
      if (result.contexts.length > 0) {
        const ctx = result.contexts[0];
        expect(ctx.content).toContain('authenticateUser');
        expect(ctx.metadata.title).toBeDefined();
        expect(ctx.metadata.type).toBeDefined();
      }
    });
    
    it('should include file paths when available', async () => {
      const result = await retriever.retrieve('auth', {
        sources: ['code']
      });
      
      const contextsWithPaths = result.contexts.filter(ctx => ctx.filePath);
      expect(contextsWithPaths.length).toBeGreaterThan(0);
    });
  });
  
  describe('source breakdown', () => {
    it('should calculate source breakdown correctly', async () => {
      const result = await retriever.retrieve('user', {
        sources: ['code'],
        maxResults: 10
      });
      
      expect(result.metadata.sourceBreakdown).toBeDefined();
      expect(result.metadata.sourceBreakdown.code).toBeGreaterThanOrEqual(0);
      expect(result.metadata.sourceBreakdown.documentation).toBeGreaterThanOrEqual(0);
    });
  });
});
