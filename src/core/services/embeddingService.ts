import * as crypto from 'crypto';
import { pipeline } from '@xenova/transformers';
import * as vscode from 'vscode';

// Embedding cache for performance optimization
export interface EmbeddingCache {
    [key: string]: {
        embedding: number[];
        timestamp: number;
        hitCount: number;
    };
}

// Performance monitoring
export interface PerformanceMetrics {
    embeddingCalls: number;
    cacheHits: number;
    totalEmbeddingTime: number;
    avgEmbeddingTime: number;
}

/**
 * Embedding Service for CappyRAG
 * Handles local embedding generation using @xenova/transformers
 */
export class EmbeddingService {
    private embeddingPipeline: any = null;
    private embeddingCache: EmbeddingCache = {};
    private performanceMetrics: PerformanceMetrics = {
        embeddingCalls: 0,
        cacheHits: 0,
        totalEmbeddingTime: 0,
        avgEmbeddingTime: 0
    };
    
    private static readonly cacheMaxSize = 1000;
    private static readonly cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours
    private static readonly modelName = 'Xenova/all-MiniLM-L6-v2';
    
    constructor(private context: vscode.ExtensionContext) {
        this.initializeEmbeddingService();
    }
    
    /**
     * Initialize embedding service with transformers.js
     */
    private async initializeEmbeddingService(): Promise<void> {
        try {
            console.log('[CappyRAG] Initializing embedding service...');
            
            // Initialize the feature extraction pipeline
            this.embeddingPipeline = await pipeline(
                'feature-extraction',
                EmbeddingService.modelName,
                {
                    quantized: true, // Use quantized model for better performance
                    local_files_only: false, // eslint-disable-line
                    cache_dir: this.context.globalStorageUri.fsPath + '/transformers-cache' // eslint-disable-line
                }
            );
            
            console.log('[CappyRAG] Embedding service initialized successfully');
        } catch (error) {
            console.error('[CappyRAG] Failed to initialize embedding service:', error);
            // Continue without embeddings - graceful degradation
        }
    }
    
    /**
     * Generate semantic embeddings for text using all-MiniLM-L6-v2 model
     * Returns 384-dimensional vectors optimized for semantic similarity
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const startTime = Date.now();
        
        try {
            // Normalize and create cache key
            const normalizedText = text.trim().toLowerCase();
            const cacheKey = crypto.createHash('md5').update(normalizedText).digest('hex');
            
            // Check cache first
            const cached = this.embeddingCache[cacheKey];
            if (cached && (Date.now() - cached.timestamp) < EmbeddingService.cacheMaxAge) {
                cached.hitCount++;
                this.performanceMetrics.cacheHits++;
                console.log(`[CappyRAG] Embedding cache hit for: ${text.substring(0, 50)}...`);
                return cached.embedding;
            }
            
            // Ensure embedding service is initialized
            if (!this.embeddingPipeline) {
                console.warn('[CappyRAG] Embedding service not available, initializing...');
                await this.initializeEmbeddingService();
                
                if (!this.embeddingPipeline) {
                    console.warn('[CappyRAG] Embedding service failed to initialize, returning zero vector');
                    return new Array(384).fill(0);
                }
            }
            
            // Truncate text if too long (model limit ~512 tokens)
            const truncatedText = text.length > 500 ? text.substring(0, 500) + '...' : text;
            
            // Generate embedding
            const result = await this.embeddingPipeline(truncatedText, {
                pooling: 'mean',
                normalize: true
            });
            
            // Extract embedding vector (result is a Tensor)
            let embedding: number[];
            if (result?.data) {
                embedding = Array.from(result.data);
            } else if (Array.isArray(result)) {
                embedding = result;
            } else {
                console.warn('[CappyRAG] Unexpected embedding result format, using zero vector');
                embedding = new Array(384).fill(0);
            }
            
            // Ensure correct dimensions (all-MiniLM-L6-v2 produces 384-dim vectors)
            if (embedding.length !== 384) {
                console.warn(`[CappyRAG] Unexpected embedding dimension: ${embedding.length}, expected 384`);
                embedding = embedding.slice(0, 384);
                while (embedding.length < 384) {
                    embedding.push(0);
                }
            }
            
            // Cache the result
            this.cacheEmbedding(cacheKey, embedding);
            
            // Update performance metrics
            const processingTime = Date.now() - startTime;
            this.performanceMetrics.embeddingCalls++;
            this.performanceMetrics.totalEmbeddingTime += processingTime;
            this.performanceMetrics.avgEmbeddingTime = 
                this.performanceMetrics.totalEmbeddingTime / this.performanceMetrics.embeddingCalls;
            
            console.log(`[CappyRAG] Generated embedding for: "${text.substring(0, 50)}..." (${processingTime}ms)`);
            
            return embedding;
            
        } catch (error) {
            console.error('[CappyRAG] Embedding generation failed:', error);
            console.log(`[CappyRAG] Fallback: returning zero vector for: "${text.substring(0, 50)}..."`);
            
            // Graceful fallback to zero vector
            return new Array(384).fill(0);
        }
    }
    
    /**
     * Generate embeddings for multiple texts in batch for better performance
     */
    async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) {
            return [];
        }
        
        console.log(`[CappyRAG] Generating embeddings for ${texts.length} texts in batch`);
        
        // For now, process sequentially - can be optimized later
        const embeddings: number[][] = [];
        for (const text of texts) {
            const embedding = await this.generateEmbedding(text);
            embeddings.push(embedding);
        }
        
        return embeddings;
    }
    
    /**
     * Cache embedding with size and age management
     */
    private cacheEmbedding(key: string, embedding: number[]): void {
        // Clean old entries if cache is full
        if (Object.keys(this.embeddingCache).length >= EmbeddingService.cacheMaxSize) {
            this.cleanEmbeddingCache();
        }
        
        this.embeddingCache[key] = {
            embedding: embedding,
            timestamp: Date.now(),
            hitCount: 0
        };
    }
    
    /**
     * Clean embedding cache by removing old and least used entries
     */
    private cleanEmbeddingCache(): void {
        const now = Date.now();
        const entries = Object.entries(this.embeddingCache);
        
        // Remove expired entries
        const validEntries = entries.filter(([_, value]) => 
            (now - value.timestamp) < EmbeddingService.cacheMaxAge
        );
        
        // If still too many, remove least used
        if (validEntries.length >= EmbeddingService.cacheMaxSize) {
            validEntries.sort((a, b) => a[1].hitCount - b[1].hitCount);
            validEntries.splice(0, Math.floor(EmbeddingService.cacheMaxSize * 0.3));
        }
        
        // Rebuild cache
        this.embeddingCache = {};
        for (const [key, value] of validEntries) {
            this.embeddingCache[key] = value;
        }
        
        console.log(`[CappyRAG] Cleaned embedding cache, ${Object.keys(this.embeddingCache).length} entries remaining`);
    }
    
    /**
     * Get performance metrics for monitoring
     */
    getPerformanceMetrics(): PerformanceMetrics & { cacheSize: number; cacheHitRate: number } {
        const totalCalls = this.performanceMetrics.embeddingCalls + this.performanceMetrics.cacheHits;
        return {
            ...this.performanceMetrics,
            cacheSize: Object.keys(this.embeddingCache).length,
            cacheHitRate: totalCalls > 0 ? (this.performanceMetrics.cacheHits / totalCalls) * 100 : 0
        };
    }
}