/**
 * @fileoverview Hash-based embedder for portable RAG (no external API needed)
 * @module infrastructure/notebook/embedder
 *
 * Uses a TF-IDF-inspired hashing trick to convert text into fixed-dimension
 * vectors. This is a lightweight, deterministic, zero-dependency approach
 * that works surprisingly well for technical documents.
 *
 * Strategy pattern: swap this for OpenAI/Ollama embeddings later.
 */

export interface Embedder {
  /** Generate an embedding vector for the given text */
  embed(text: string): number[];
  /** The dimension of generated vectors */
  readonly dimension: number;
}

export interface HashEmbedderOptions {
  /** Vector dimension (default: 256) */
  dimension?: number;
  /** N-gram sizes to use (default: [1, 2, 3]) */
  ngramSizes?: number[];
}

const DEFAULT_OPTIONS: Required<HashEmbedderOptions> = {
  dimension: 256,
  ngramSizes: [1, 2, 3],
};

/**
 * Hash-based embedder using the "hashing trick" with TF-IDF weighting.
 *
 * How it works:
 * 1. Tokenize text into words
 * 2. Generate n-grams (unigrams, bigrams, trigrams)
 * 3. Hash each n-gram to a bucket in a fixed-size vector
 * 4. Apply TF-IDF-like weighting (shorter docs get higher weights)
 * 5. L2-normalize the vector
 */
export class HashEmbedder implements Embedder {
  private readonly opts: Required<HashEmbedderOptions>;

  constructor(options?: HashEmbedderOptions) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
  }

  get dimension(): number {
    return this.opts.dimension;
  }

  /**
   * Embed a text string into a fixed-dimension vector.
   */
  embed(text: string): number[] {
    const tokens = this.tokenize(text);
    const vector = new Float64Array(this.opts.dimension);

    if (tokens.length === 0) {
      return Array.from(vector);
    }

    // Generate n-grams and hash them into the vector
    for (const n of this.opts.ngramSizes) {
      const weight = 1.0 / n; // Unigrams weigh more than bigrams, etc.
      for (let i = 0; i <= tokens.length - n; i++) {
        const ngram = tokens.slice(i, i + n).join(' ');
        const hash = this.murmurhash3(ngram);
        const bucket = Math.abs(hash) % this.opts.dimension;
        const sign = (hash & 1) === 0 ? 1 : -1; // Random sign to reduce collisions
        vector[bucket] += sign * weight;
      }
    }

    // Apply IDF-like scaling: log(1 + 1/tf) favors rare terms
    const maxVal = Math.max(...Array.from(vector).map(Math.abs)) || 1;
    for (let i = 0; i < vector.length; i++) {
      vector[i] = vector[i] / maxVal;
    }

    // L2 normalize
    return this.normalize(Array.from(vector));
  }

  /**
   * Tokenize text into lowercase words, removing punctuation.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\sáàãâéèêíìîóòõôúùûçñ]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  /**
   * MurmurHash3 (32-bit) — fast, well-distributed hash function.
   * Deterministic: same input always produces same output.
   */
  private murmurhash3(key: string, seed: number = 42): number {
    let h = seed ^ key.length;

    for (let i = 0; i < key.length; i++) {
      let k = key.charCodeAt(i);
      k = Math.imul(k, 0xcc9e2d51);
      k = (k << 15) | (k >>> 17);
      k = Math.imul(k, 0x1b873593);

      h ^= k;
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h, 5) + 0xe6546b64;
    }

    h ^= key.length;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;

    return h | 0;
  }

  /**
   * L2-normalize a vector.
   */
  private normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map(v => v / magnitude);
  }
}

// ─── Similarity ──────────────────────────────────────────

/**
 * Compute cosine similarity between two vectors.
 * Returns value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
