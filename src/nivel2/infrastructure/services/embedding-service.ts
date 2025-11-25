/**
 * @fileoverview Embedding service using Xenova Transformers
 * @module services/embedding-service
 * @author Cappy Team
 * @since 3.0.0
 */

type FeatureExtractionPipeline = any; // eslint-disable-line @typescript-eslint/no-explicit-any

type ConsoleMethod = 'log' | 'error' | 'warn';

function filterConsoleMessage(method: ConsoleMethod, substrings: string[]) {
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    const containsBlockedSubstring = args.some(arg => (
      typeof arg === 'string' && substrings.some(sub => arg.includes(sub))
    ));
    if (!containsBlockedSubstring) {
      original(...args);
    }
  };
  return () => { console[method] = original; };
}

/**
 * Embedding service for generating vector embeddings
 */
export class EmbeddingService {
  private pipeline?: FeatureExtractionPipeline;
  private readonly model = "Xenova/all-MiniLM-L6-v2";
  private readonly dimensions = 384;
  private initialized = false;
  private readonly cacheDir: string;

  /**
   * Creates a new EmbeddingService instance
   * @param cacheDir - Absolute path to cache directory for model files
   */
  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  /**
   * Initializes the embedding model
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🤖 Loading embedding model: ${this.model} (attempt ${attempt}/${maxRetries})...`);

        const { pipeline, env } = await import("@xenova/transformers");

        // Configure environment
        env.allowLocalModels = true; // Allow local cached models
        env.allowRemoteModels = true;
        env.cacheDir = this.cacheDir; // Use absolute cache path

        // Load with timeout
        const pipelinePromise = pipeline("feature-extraction", this.model, {
          quantized: true,
        });

        const suppressedMessages = [
          'Failed to fetch remote embeddings cache',
          'Response status: 404'
        ];
        const restoreErrorFilter = filterConsoleMessage('error', suppressedMessages);
        const restoreLogFilter = filterConsoleMessage('log', suppressedMessages);
        const restoreWarnFilter = filterConsoleMessage('warn', suppressedMessages);

        // Add 60 second timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Model loading timeout (60s)')), 60000);
        });

        try {
          this.pipeline = await Promise.race([pipelinePromise, timeoutPromise]) as FeatureExtractionPipeline;
        } finally {
          restoreErrorFilter();
          restoreLogFilter();
          restoreWarnFilter();
        }

        this.initialized = true;
        console.log(`✅ Embedding model loaded (${this.dimensions} dimensions)`);
        return; // Success, exit retry loop
      } catch (error) {
        console.error(`❌ Failed to load embedding model (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${retryDelay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // Last attempt failed
          console.error("❌ All retry attempts failed. Embedding service will be disabled.");
          throw new Error(`Failed to initialize embedding service after ${maxRetries} attempts: ${error}`);
        }
      }
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
 * @param cacheDir - Absolute path to cache directory for model files
 */
export function createEmbeddingService(cacheDir: string): EmbeddingService {
  return new EmbeddingService(cacheDir);
}
