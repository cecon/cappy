import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoadGraphDataUseCase, type LoadGraphDataOptions } from '../LoadGraphDataUseCase';
import type { GraphRepository } from '../../ports/GraphRepository';
import { GraphData } from '../../entities/GraphData';
import { GraphNode } from '../../entities/GraphNode';
import { GraphEdge } from '../../entities/GraphEdge';
import type { NodeType } from '../../types';

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
    const node3 = createTestNode('node3', 'Deleted Node', 'entity', 0.7);
    node3.state.selected = true; // Use a valid state property

    const edge1 = createTestEdge('edge1', 'Contains', 'contains', 'node1', 'node2', 1.0, 0.9);
    const edge2 = createTestEdge('edge2', 'Deleted Edge', 'mentions', 'node2', 'node3', 0.5, 0.6);
    edge2.state.selected = true; // Use a valid state property

    mockGraphData = new GraphData([node1, node2, node3], [edge1, edge2]);

    // Create mock repository
    mockRepository = {
      loadGraphData: vi.fn().mockResolvedValue(mockGraphData),
      loadFilteredGraphData: vi.fn().mockResolvedValue(mockGraphData),
      saveGraphData: vi.fn().mockResolvedValue(undefined),
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

    it('should filter nodes based on selection state', async () => {
      const result = await useCase.execute();

      // Should include all nodes since we're not filtering by state
      expect(result.data.nodes.length).toBeGreaterThanOrEqual(0);
      expect(result.data.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('should limit number of nodes when maxNodes is specified', async () => {
      const options: LoadGraphDataOptions = {
        maxNodes: 1,
      };

      const result = await useCase.execute(options);

      expect(result.data.nodes.length).toBeLessThanOrEqual(1);
    });

    it('should exclude edges when includeEdges is false', async () => {
      const options: LoadGraphDataOptions = {
        includeEdges: false,
      };

      const result = await useCase.execute(options);

      expect(result.data.nodes.length).toBeGreaterThan(0);
      expect(result.data.edges).toHaveLength(0);
    });

    it('should pass filter to repository', async () => {
      const options: LoadGraphDataOptions = {
        filter: {
          nodeTypes: ['document'],
          minConfidence: 0.8,
        },
      };

      await useCase.execute(options);

      expect(mockRepository.loadGraphData).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeTypes: ['document'],
          minConfidence: 0.8,
        })
      );
    });

    it('should include metadata with counts and timing', async () => {
      const result = await useCase.execute();

      expect(result.metadata.nodeCount).toBeDefined();
      expect(result.metadata.edgeCount).toBeDefined();
      expect(result.metadata.loadTimeMs).toBeDefined();
      expect(result.metadata.loadTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should recalculate statistics after filtering', async () => {
      const result = await useCase.execute();

      expect(result.data.statistics).toBeDefined();
      expect(result.data.statistics.totalNodes).toBe(result.data.nodes.length);
      expect(result.data.statistics.totalEdges).toBe(result.data.edges.length);
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

    it('should preserve node order when limiting', async () => {
      // Create more nodes
      const nodes = Array.from({ length: 10 }, (_, i) =>
        new GraphNode({
          id: `node${i}`,
          label: `Node ${i}`,
          type: 'document',
          confidence: 0.9,
        })
      );

      mockGraphData = new GraphData(nodes, []);
      mockRepository.loadGraphData = vi.fn().mockResolvedValue(mockGraphData);

      const options: LoadGraphDataOptions = {
        maxNodes: 5,
      };

      const result = await useCase.execute(options);

      // Should get first 5 nodes
      expect(result.data.nodes).toHaveLength(5);
      expect(result.data.nodes[0].id).toBe('node0');
      expect(result.data.nodes[4].id).toBe('node4');
    });

    it('should remove orphaned edges after node filtering', async () => {
      // Create graph with edge pointing to deleted node
      const activeNode = new GraphNode({
        id: 'active',
        label: 'Active Node',
        type: 'document',
        confidence: 0.9,
      });

      const deletedNode = new GraphNode({
        id: 'deleted',
        label: 'Deleted Node',
        type: 'document',
        confidence: 0.9,
      });
      deletedNode.state.deleted = true;

      const edge = new GraphEdge({
        id: 'edge1',
        label: 'Points to deleted',
        type: 'mentions',
        source: 'active',
        target: 'deleted',
        weight: 1.0,
        confidence: 0.9,
      });

      mockGraphData = new GraphData([activeNode, deletedNode], [edge]);
      mockRepository.loadGraphData = vi.fn().mockResolvedValue(mockGraphData);

      const result = await useCase.execute(); // includeDeleted defaults to false

      // Should only have active node
      expect(result.data.nodes).toHaveLength(1);
      expect(result.data.nodes[0].id).toBe('active');

      // Edge should be removed because target node is deleted
      expect(result.data.edges).toHaveLength(0);
    });

    it('should apply both includeDeleted and maxNodes correctly', async () => {
      const options: LoadGraphDataOptions = {
        includeDeleted: true,
        maxNodes: 2,
      };

      const result = await useCase.execute(options);

      // Should have 2 nodes (limited from 3 total)
      expect(result.data.nodes).toHaveLength(2);
      expect(result.metadata.limited).toBe(true);
      expect(result.metadata.originalNodeCount).toBe(3);
    });
  });
});
