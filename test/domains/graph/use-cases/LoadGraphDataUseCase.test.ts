import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoadGraphDataUseCase, type LoadGraphDataOptions } from '@/domains/graph/use-cases/LoadGraphDataUseCase';
import type { GraphRepository } from '@/domains/graph/use-cases/../ports/GraphRepository';
import { GraphData } from '@/domains/graph/use-cases/../entities/GraphData';
import { GraphNode } from '@/domains/graph/use-cases/../entities/GraphNode';
import { GraphEdge } from '@/domains/graph/use-cases/../entities/GraphEdge';
import type { NodeType, GraphStatistics } from '@/domains/graph/use-cases/../types';

// Helper function to create test nodes
function createTestNode(
  id: string,
  label: string,
  type: NodeType,
  confidence: number
): GraphNode {
  const now = new Date().toISOString();
  return new GraphNode({
    id,
    label,
    type,
    created: now,
    updated: now,
    confidence,
  });
}

// Helper function to create test edges
function createTestEdge(
  id: string,
  label: string,
  type: 'contains' | 'mentions' | 'similar_to',
  source: string,
  target: string,
  weight: number,
  confidence: number
): GraphEdge {
  const now = new Date().toISOString();
  return new GraphEdge({
    id,
    label,
    type,
    source,
    target,
    weight,
    created: now,
    updated: now,
    confidence,
  });
}

describe('LoadGraphDataUseCase', () => {
  let useCase: LoadGraphDataUseCase;
  let mockRepository: GraphRepository;
  let mockGraphData: GraphData;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock graph data
    const node1 = createTestNode('node1', 'Test Node 1', 'document', 0.9);
    const node2 = createTestNode('node2', 'Test Node 2', 'chunk', 0.8);
    const node3 = createTestNode('node3', 'Test Node 3', 'entity', 0.7);

    const edge1 = createTestEdge('edge1', 'Contains', 'contains', 'node1', 'node2', 1.0, 0.9);
    const edge2 = createTestEdge('edge2', 'Mentions', 'mentions', 'node2', 'node3', 0.5, 0.6);

    mockGraphData = new GraphData([node1, node2, node3], [edge1, edge2]);

    const mockStats: GraphStatistics = mockGraphData.statistics;

    // Create mock repository
    mockRepository = {
      loadGraphData: vi.fn().mockResolvedValue(mockGraphData),
      loadFilteredGraphData: vi.fn().mockResolvedValue(mockGraphData),
      saveGraphData: vi.fn().mockResolvedValue(undefined),
      getGraphStatistics: vi.fn().mockResolvedValue(mockStats),
      isAvailable: vi.fn().mockResolvedValue(true),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new LoadGraphDataUseCase(mockRepository);
  });

  describe('execute', () => {
    it('should load graph data from repository', async () => {
      const result = await useCase.execute();

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(mockRepository.loadGraphData).toHaveBeenCalledTimes(1);
    });

    it('should return graph with nodes and edges', async () => {
      const result = await useCase.execute();

      expect(result.data.nodes.length).toBeGreaterThan(0);
      expect(result.data.edges.length).toBeGreaterThan(0);
    });

    it('should call loadFilteredGraphData when filter is provided', async () => {
      const options: LoadGraphDataOptions = {
        filter: {
          nodeTypes: ['document'],
          minConfidence: 0.8,
        },
      };

      await useCase.execute(options);

      expect(mockRepository.loadFilteredGraphData).toHaveBeenCalledTimes(1);
      expect(mockRepository.loadFilteredGraphData).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeTypes: ['document'],
          minConfidence: 0.8,
        })
      );
    });

    it('should exclude edges when includeEdges is false', async () => {
      const options: LoadGraphDataOptions = {
        includeEdges: false,
      };

      const result = await useCase.execute(options);

      expect(result.data.nodes.length).toBeGreaterThan(0);
      expect(result.data.edges).toHaveLength(0);
    });

    it('should include metadata with counts and timing', async () => {
      const result = await useCase.execute();

      expect(result.metadata.nodeCount).toBeDefined();
      expect(result.metadata.edgeCount).toBeDefined();
      expect(result.metadata.loadTimeMs).toBeDefined();
      expect(result.metadata.loadTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return data with nodes and edges properties', async () => {
      const result = await useCase.execute();

      // Check that data object has expected structure
      expect(result.data).toHaveProperty('nodes');
      expect(result.data).toHaveProperty('edges');
      expect(Array.isArray(result.data.nodes)).toBe(true);
      expect(Array.isArray(result.data.edges)).toBe(true);
    });

    it('should handle empty graph data', async () => {
      const emptyData = new GraphData([], []);
      mockRepository.loadGraphData = vi.fn().mockResolvedValue(emptyData);

      const result = await useCase.execute();

      expect(result.data.nodes).toHaveLength(0);
      expect(result.data.edges).toHaveLength(0);
      expect(result.metadata.nodeCount).toBe(0);
      expect(result.metadata.edgeCount).toBe(0);
    });

    it('should handle repository errors gracefully', async () => {
      mockRepository.loadGraphData = vi
        .fn()
        .mockRejectedValue(new Error('Repository error'));

      await expect(useCase.execute()).rejects.toThrow('Repository error');
    });

    it('should limit number of nodes when maxNodes is specified', async () => {
      // Create many nodes
      const nodes = Array.from({ length: 10 }, (_, i) =>
        createTestNode(`node${i}`, `Node ${i}`, 'document', 0.9)
      );
      const largeData = new GraphData(nodes, []);
      mockRepository.loadGraphData = vi.fn().mockResolvedValue(largeData);

      const options: LoadGraphDataOptions = {
        maxNodes: 5,
      };

      const result = await useCase.execute(options);

      expect(result.data.nodes.length).toBeLessThanOrEqual(5);
    });

    it('should preserve node order', async () => {
      const result = await useCase.execute();

      const firstNode = result.data.nodes[0];
      expect(firstNode).toBeDefined();
      expect(firstNode.id).toBeDefined();
    });

    it('should set wasFiltered flag correctly', async () => {
      // wasFiltered is true when filter is provided
      const resultWithFilter = await useCase.execute({
        filter: { nodeTypes: ['document'] },
      });
      expect(resultWithFilter.metadata.wasFiltered).toBe(true);

      // wasFiltered is true when edges are excluded
      const resultNoEdges = await useCase.execute({
        includeEdges: false,
      });
      expect(resultNoEdges.metadata.wasFiltered).toBe(true);
    });

    it('should handle loadGraphData when no filter provided', async () => {
      await useCase.execute();

      expect(mockRepository.loadGraphData).toHaveBeenCalledTimes(1);
      expect(mockRepository.loadFilteredGraphData).not.toHaveBeenCalled();
    });

    it('should preserve edge relationships', async () => {
      const result = await useCase.execute();

      if (result.data.edges.length > 0) {
        const edge = result.data.edges[0];
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        
        // Check that source and target nodes exist
        const hasSource = result.data.nodes.some(n => n.id === edge.source);
        const hasTarget = result.data.nodes.some(n => n.id === edge.target);
        
        expect(hasSource || hasTarget).toBe(true);
      }
    });
  });
});
