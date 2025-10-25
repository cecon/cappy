import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GraphStorePort } from '@/domains/graph/ports/indexing-port';
import type { ExtractedEntity } from '@/types/entity';
import { createEntityGraphService } from '@/nivel2/infrastructure/services/entity-graph-service';

describe('EntityGraphService', () => {
  let graphStore: GraphStorePort;

  beforeEach(() => {
    graphStore = {
      initialize: vi.fn(async () => {}),
      createFileNode: vi.fn(async () => {}),
      createChunkNodes: vi.fn(async () => {}),
      createRelationships: vi.fn(async () => {}),
      getRelatedChunks: vi.fn(async () => []),
      deleteFileNodes: vi.fn(async () => {}),
      deleteFile: vi.fn(async () => {}),
      listAllFiles: vi.fn(async () => [
        { path: '/a.ts', language: 'typescript', linesOfCode: 10 },
        { path: '/b.ts', language: 'typescript', linesOfCode: 20 },
      ]),
      getFileChunks: vi.fn(async (p: string) => {
        if (p === '/a.ts') return [
          { id: 'chunk-1', type: 'chunk', label: 'Foo' },
          { id: 'chunk-2', type: 'chunk', label: 'code [10-20]' },
        ];
        return [
          { id: 'chunk-3', type: 'chunk', label: 'Bar' },
        ];
      }),
      getStats: vi.fn(() => ({ fileNodes: 1, chunkNodes: 3, relationships: 0 })),
      getSampleRelationships: vi.fn(async () => []),
      getRelationshipsByType: vi.fn(async () => ({})),
      getSubgraph: vi.fn(async () => ({ nodes: [], edges: [] })),
      close: vi.fn(async () => {}),
      getChunksByIds: vi.fn(async () => []),
      ensureWorkspaceNode: vi.fn(async () => {}),
      storeEmbeddings: vi.fn(async () => {}),
      searchSimilar: vi.fn(async () => []),
    } as unknown as GraphStorePort;
  });

  it('links entities to code using defined_in relationships when found', async () => {
    const svc = createEntityGraphService(graphStore);
    // Spy on createRelationships
    const createRel = vi.spyOn(graphStore, 'createRelationships');

    const entities: ExtractedEntity[] = [
      { name: 'Foo', type: 'class', confidence: 0.95 },
      { name: 'Baz', type: 'function', confidence: 0.8 }, // not present
      { name: 'Bar', type: 'class', confidence: 0.9 },
    ];

    await svc.linkEntitiesToCode(entities);

    // Should create relationships for Foo and Bar
    expect(createRel).toHaveBeenCalled();
    type Rel = { from: string; to: string; type: string; properties?: Record<string, unknown> };
    const allRels: Rel[] = createRel.mock.calls
      .map(args => (args[0] as Rel[]))
      .flat();
    const definedIn = allRels.filter(r => r.type === 'defined_in');
    // Two entities matched (Foo and Bar)
    expect(definedIn.length).toBe(2);
    // Ensure mapping to correct chunk ids
    const targets = definedIn.map(r => r.to).sort();
    expect(targets).toEqual(['chunk-1', 'chunk-3']);
  });
});
