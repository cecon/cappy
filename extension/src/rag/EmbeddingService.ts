/**
 * Embedding service — wraps the openai SDK (already a project dependency)
 * to generate vector embeddings via OpenRouter's embeddings endpoint.
 * No new binary dependencies required.
 */

import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export class EmbeddingService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  }

  updateApiKey(apiKey: string): void {
    this.client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  }

  /**
   * Embeds a single text string. Convenience wrapper around embedBatch.
   */
  async embedSingle(text: string, model: string, dimensions: number): Promise<number[]> {
    const results = await this.embedBatch([text], model, dimensions);
    return results[0] ?? [];
  }

  /**
   * Embeds an array of texts in sub-batches, retrying on transient errors.
   * Returns one embedding vector per input text, in the same order.
   */
  async embedBatch(
    texts: string[],
    model: string,
    dimensions: number,
    batchSize = 20,
  ): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const vecs = await this.callWithRetry(batch, model, dimensions);
      results.push(...vecs);
    }
    return results;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async callWithRetry(
    batch: string[],
    model: string,
    dimensions: number,
  ): Promise<number[][]> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await this.client.embeddings.create({
          model,
          input: batch,
          ...(dimensions > 0 ? { dimensions } : {}),
        });
        // Sort by index to guarantee order matches input.
        return resp.data
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding);
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err) || attempt === MAX_RETRIES) break;
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
    throw lastErr;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isRetryable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const status = (err as Record<string, unknown>).status;
  return status === 429 || status === 500 || status === 503;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
