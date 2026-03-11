/**
 * @fileoverview Unit tests for the Cappy Notebook RAG system
 */

import { describe, it, expect } from 'vitest';
import { TextChunker } from '../../src/nivel2/infrastructure/notebook/text-chunker';
import { HashEmbedder, cosineSimilarity } from '../../src/nivel2/infrastructure/notebook/embedder';
import { GraphBuilder } from '../../src/nivel2/infrastructure/notebook/graph-builder';
import { Retriever } from '../../src/nivel2/infrastructure/notebook/retriever';
import type { NotebookData, Chunk } from '../../src/domains/notebook/notebook-types';

// ─── TextChunker ──────────────────────────────────────────

describe('TextChunker', () => {
  const chunker = new TextChunker({ chunkSize: 100, chunkOverlap: 20 });

  it('should return a single chunk for short text', () => {
    const result = chunker.chunk('Hello world', 'test.md');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Hello world');
  });

  it('should split long text into multiple chunks', () => {
    const longText = Array(20).fill('This is a sentence.').join('\n');
    const result = chunker.chunk(longText, 'test.md');
    expect(result.length).toBeGreaterThan(1);
  });

  it('should preserve line metadata', () => {
    const text = '# Header\n\nParagraph one.\n\nParagraph two.';
    const result = chunker.chunk(text, 'test.md');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].metadata.startLine).toBe(1);
  });

  it('should extract section from markdown headers', () => {
    const text = '# My Section\n\nSome content here that is in the section.';
    const result = chunker.chunk(text, 'test.md');
    expect(result[0].metadata.section).toBe('My Section');
  });

  it('should handle empty text', () => {
    const result = chunker.chunk('', 'test.md');
    expect(result).toHaveLength(0);
  });
});

// ─── HashEmbedder ─────────────────────────────────────────

describe('HashEmbedder', () => {
  const embedder = new HashEmbedder({ dimension: 128 });

  it('should produce vectors of correct dimension', () => {
    const vec = embedder.embed('Hello world');
    expect(vec).toHaveLength(128);
  });

  it('should be deterministic', () => {
    const a = embedder.embed('The quick brown fox');
    const b = embedder.embed('The quick brown fox');
    expect(a).toEqual(b);
  });

  it('should produce L2-normalized vectors', () => {
    const vec = embedder.embed('Some sample text for embedding');
    const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 4);
  });

  it('should produce different vectors for different text', () => {
    const a = embedder.embed('TypeScript is great');
    const b = embedder.embed('Python is awesome');
    expect(a).not.toEqual(b);
  });

  it('should produce similar vectors for similar text', () => {
    const a = embedder.embed('JavaScript programming language');
    const b = embedder.embed('JavaScript scripting language');
    const c = embedder.embed('Cooking recipes for dinner');
    const simAB = cosineSimilarity(a, b);
    const simAC = cosineSimilarity(a, c);
    // Similar texts should have higher similarity than unrelated texts
    expect(simAB).toBeGreaterThan(simAC);
  });

  it('should handle empty text', () => {
    const vec = embedder.embed('');
    expect(vec).toHaveLength(128);
  });
});

// ─── cosineSimilarity ─────────────────────────────────────

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [0.5, 0.3, 0.8];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('should handle zero vectors', () => {
    const zero = [0, 0, 0];
    const v = [1, 2, 3];
    expect(cosineSimilarity(zero, v)).toBe(0);
  });

  it('should handle vectors of different lengths', () => {
    const a = [1, 2];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

// ─── GraphBuilder ─────────────────────────────────────────

describe('GraphBuilder', () => {
  const builder = new GraphBuilder();

  it('should extract PascalCase entities', () => {
    const chunks: Chunk[] = [{
      id: 'c_001',
      source: 'test.ts',
      text: 'The ExtensionBootstrap class handles activation.',
      embedding: [],
      metadata: { startLine: 1, endLine: 1 },
    }];
    const graph = builder.build(chunks);
    const labels = graph.nodes.map(n => n.label);
    expect(labels).toContain('ExtensionBootstrap');
  });

  it('should extract file paths', () => {
    const chunks: Chunk[] = [{
      id: 'c_001',
      source: 'test.ts',
      text: 'See the config at src/config.json for details.',
      embedding: [],
      metadata: { startLine: 1, endLine: 1 },
    }];
    const graph = builder.build(chunks);
    const fileNodes = graph.nodes.filter(n => n.type === 'file');
    expect(fileNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should extract backtick terms', () => {
    const chunks: Chunk[] = [{
      id: 'c_001',
      source: 'test.md',
      text: 'Use the `NotebookStore` class to manage notebooks.',
      embedding: [],
      metadata: { startLine: 1, endLine: 1 },
    }];
    const graph = builder.build(chunks);
    const labels = graph.nodes.map(n => n.label.toLowerCase());
    expect(labels).toContain('notebookstore');
  });

  it('should create co-occurrence edges', () => {
    const chunks: Chunk[] = [
      {
        id: 'c_001', source: 'test.ts',
        text: 'The CappyBridge uses WebSocket for WhatsApp communication.',
        embedding: [], metadata: { startLine: 1, endLine: 1 },
      },
      {
        id: 'c_002', source: 'test.ts',
        text: 'The CappyBridge also handles WhatsApp reconnection via WebSocket.',
        embedding: [], metadata: { startLine: 2, endLine: 2 },
      },
    ];
    const graph = builder.build(chunks);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('should handle empty chunks', () => {
    const graph = builder.build([]);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});

// ─── Retriever ────────────────────────────────────────────

describe('Retriever', () => {
  const embedder = new HashEmbedder();
  const retriever = new Retriever();

  function makeNotebook(texts: string[]): NotebookData {
    const chunks: Chunk[] = texts.map((text, i) => ({
      id: `c_${String(i + 1).padStart(3, '0')}`,
      source: 'test.md',
      text,
      embedding: embedder.embed(text),
      metadata: { startLine: i + 1, endLine: i + 1 },
    }));

    return {
      meta: {
        name: 'test',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        sources: ['test.md'],
        embeddingDim: embedder.dimension,
      },
      chunks,
      graph: { nodes: [], edges: [] },
    };
  }

  it('should return results sorted by score', () => {
    const notebook = makeNotebook([
      'TypeScript is a programming language by Microsoft',
      'Python is a popular programming language',
      'Cooking pasta requires boiling water',
      'JavaScript and TypeScript share similar syntax',
    ]);

    const results = retriever.search(notebook, 'TypeScript programming');
    expect(results.length).toBeGreaterThan(0);
    // Results should be sorted descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should return relevant results first', () => {
    const notebook = makeNotebook([
      'The weather today is sunny and warm',
      'React is a frontend JavaScript framework',
      'TypeScript adds static types to JavaScript',
      'Cats are adorable pets that love sleeping',
    ]);

    const results = retriever.search(notebook, 'JavaScript framework');
    expect(results.length).toBeGreaterThan(0);
    // The JavaScript-related chunks should score higher
    const topTexts = results.slice(0, 2).map(r => r.chunk.text);
    const hasJsResult = topTexts.some(t =>
      t.toLowerCase().includes('javascript') || t.toLowerCase().includes('react')
    );
    expect(hasJsResult).toBe(true);
  });

  it('should respect topK parameter', () => {
    const notebook = makeNotebook([
      'Chunk one', 'Chunk two', 'Chunk three',
      'Chunk four', 'Chunk five',
    ]);

    const results = retriever.search(notebook, 'chunk', { topK: 2 });
    expect(results).toHaveLength(2);
  });

  it('should handle empty notebook', () => {
    const notebook = makeNotebook([]);
    const results = retriever.search(notebook, 'anything');
    expect(results).toHaveLength(0);
  });
});
