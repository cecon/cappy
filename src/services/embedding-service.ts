/**
 * @fileoverview Embedding service using Xenova Transformers
 * @module services/embedding-service
 * @author Cappy Team
 * @since 3.0.0
 */

type FeatureExtractionPipeline = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Embedding service for generating vector embeddings
 */
export class EmbeddingService {
  private pipeline?: FeatureExtractionPipeline;
  private readonly model = "Xenova/all-MiniLM-L6-v2";
  private readonly dimensions = 384;
  private initialized = false;

  /**
   * Initializes the embedding model
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log(`🤖 Loading embedding model: ${this.model}...`);

      const { pipeline, env } = await import("@xenova/transformers");

      // Disable image processing features
      env.allowLocalModels = false;
      env.allowRemoteModels = true;

      this.pipeline = await pipeline("feature-extraction", this.model, {
        quantized: true,
      });

      this.initialized = true;
      console.log(`✅ Embedding model loaded (${this.dimensions} dimensions)`);
    } catch (error) {
      console.error("❌ Failed to load embedding model:", error);
      throw new Error(`Failed to initialize embedding service: ${error}`);
    }
  }

  /**
   * Generates embeddings for a single text
   */
  async embed(text: string): Promise<number[]> {
    if (!this.initialized || !this.pipeline) {
      throw new Error("Embedding service not initialized");
    }

    try {
      const output = await this.pipeline(text, {
        pooling: "mean",
        normalize: true,
      });

      // Convert to regular array
      const embedding = Array.from(output.data as Float32Array);

      // Verify dimensions
      if (embedding.length !== this.dimensions) {
        throw new Error(
          `Expected ${this.dimensions} dimensions, got ${embedding.length}`
        );
      }

      return embedding;
    } catch (error) {
      console.error(
        `❌ Embedding error for text: "${text.substring(0, 50)}..."`,
        error
      );
      throw error;
    }
  }

  /**
   * Generates embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[], batchSize = 32): Promise<number[][]> {
    if (!this.initialized || !this.pipeline) {
      throw new Error("Embedding service not initialized");
    }

    const embeddings: number[][] = [];

    try {
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        console.log(
          `🔄 Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            texts.length / batchSize
          )} (${batch.length} items)...`
        );

        const batchEmbeddings = await Promise.all(
          batch.map((text) => this.embed(text))
        );

        embeddings.push(...batchEmbeddings);
      }

      console.log(`✅ Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      console.error("❌ Batch embedding error:", error);
      throw error;
    }
  }

  /**
   * Gets model information
   */
  getInfo() {
    return {
      model: this.model,
      dimensions: this.dimensions,
      initialized: this.initialized,
    };
  }
}

/**
 * Factory function to create embedding service
 */
export function createEmbeddingService(): EmbeddingService {
  return new EmbeddingService();
}
