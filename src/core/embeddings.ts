import * as fs from 'fs';

/**
 * Configuration for embedding service
 */
export interface EmbeddingConfig {
    /** Model name to use */
    modelName: string;
    /** Dimension of embeddings */
    dimension: number;
    /** Batch size for processing */
    batchSize: number;
    /** Cache directory for models */
    cacheDir?: string;
    /** Whether to normalize embeddings */
    normalize: boolean;
}

/**
 * Default embedding configuration
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
    modelName: 'Xenova/all-MiniLM-L6-v2',
    dimension: 384,
    batchSize: 32,
    normalize: true
};

/**
 * Embedding service for generating vector representations of text
 */
export class EmbeddingService {
    private readonly config: EmbeddingConfig;
    private model: any = null;
    private transformers: any = null;
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;

    constructor(config: EmbeddingConfig = DEFAULT_EMBEDDING_CONFIG) {
        this.config = { ...config };
    }

    /**
     * Initialize the embedding model
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.doInitialize();
        return this.initializationPromise;
    }

    /**
     * Perform the actual initialization
     */
    private async doInitialize(): Promise<void> {
        try {
            console.log('Initializing EmbeddingService...');
            
            // Use a proper dynamic import that works in CommonJS after compilation
            // Create import function that bypasses require() resolution
            const dynamicImport = (pkg: string) => {
                return Function(`return import("${pkg}")`)();
            };
            
            this.transformers = await dynamicImport('@xenova/transformers');
            
            // Configure environment
            if (this.config.cacheDir) {
                this.transformers.env.cacheDir = this.config.cacheDir;
            }
            this.transformers.env.allowRemoteModels = true;
            this.transformers.env.allowLocalModels = true;

            await this.loadModel();
            this.isInitialized = true;
            
            console.log('✅ EmbeddingService initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize EmbeddingService:', error);
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Set cache directory for model storage
     */
    setCacheDir(cacheDir: string): void {
        this.config.cacheDir = cacheDir;
        
        // Ensure directory exists
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
    }

    /**
     * Load the embedding model
     */
    private async loadModel(): Promise<void> {
        try {
            console.log(`Loading embedding model: ${this.config.modelName}`);
            
            this.model = await this.transformers.pipeline(
                'feature-extraction',
                this.config.modelName,
                {
                    quantized: false,  // Use full precision for better quality
                    revision: 'main'
                }
            );
            
            console.log('✅ Embedding model loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load embedding model:', error);
            throw error;
        }
    }

    /**
     * Generate embedding for a single text
     */
    async embed(text: string): Promise<number[]> {
        await this.initialize();
        
        if (!this.model) {
            throw new Error('Model not loaded');
        }

        try {
            // Generate embedding
            const output = await this.model(text, {
                pooling: 'mean',      // Mean pooling
                normalize: this.config.normalize
            });
            
            // Extract tensor data
            const embedding: number[] = Array.from(output.data);
            
            // Validate dimension
            if (embedding.length !== this.config.dimension) {
                console.warn(`Expected dimension ${this.config.dimension}, got ${embedding.length}`);
            }
            
            return embedding;
            
        } catch (error) {
            console.error('❌ Failed to generate embedding:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings for multiple texts in batches
     */
    async embedBatch(texts: string[]): Promise<number[][]> {
        await this.initialize();
        
        if (texts.length === 0) {
            return [];
        }

        console.log(`Generating embeddings for ${texts.length} texts...`);
        
        const embeddings: number[][] = [];
        
        // Process in batches
        for (let i = 0; i < texts.length; i += this.config.batchSize) {
            const batch = texts.slice(i, i + this.config.batchSize);
            console.log(`Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(texts.length / this.config.batchSize)}`);
            
            // Generate embeddings for batch
            const batchEmbeddings = await Promise.all(
                batch.map(text => this.embed(text))
            );
            
            embeddings.push(...batchEmbeddings);
        }
        
        console.log(`✅ Generated ${embeddings.length} embeddings`);
        return embeddings;
    }

    /**
     * Calculate cosine similarity between two embeddings
     */
    static cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Embedding dimensions must match');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Normalize an embedding vector
     */
    static normalize(embedding: number[]): number[] {
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / norm);
    }

    /**
     * Check if service is ready
     */
    isReady(): boolean {
        return this.isInitialized && this.model !== null;
    }

    /**
     * Get model information
     */
    getModelInfo(): any {
        return {
            modelName: this.config.modelName,
            dimension: this.config.dimension,
            batchSize: this.config.batchSize,
            normalize: this.config.normalize,
            isLoaded: this.model !== null,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Get embedding statistics
     */
    getStats(): any {
        return {
            modelName: this.config.modelName,
            dimension: this.config.dimension,
            isReady: this.isReady(),
            cacheDir: this.config.cacheDir
        };
    }
}