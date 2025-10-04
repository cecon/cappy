/**
 * Caching system for LightRAG to improve performance
 */
export class LightRAGCache {
    private static instance?: LightRAGCache;
    private searchCache: Map<string, CacheEntry<any>> = new Map();
    private embeddingCache: Map<string, CacheEntry<number[]>> = new Map();
    private chunkCache: Map<string, CacheEntry<any>> = new Map();
    private statsCache: CacheEntry<any> | null = null;
    
    // Cache configuration
    private readonly maxCacheSize = 1000;
    private readonly defaultTTL = 10 * 60 * 1000; // 10 minutes
    private readonly searchTTL = 5 * 60 * 1000;   // 5 minutes for search results
    private readonly embeddingTTL = 60 * 60 * 1000; // 1 hour for embeddings
    
    private constructor() {
        // Start cleanup interval
        setInterval(() => this.cleanup(), 60000); // Cleanup every minute
    }

    public static getInstance(): LightRAGCache {
        if (!LightRAGCache.instance) {
            LightRAGCache.instance = new LightRAGCache();
        }
        return LightRAGCache.instance;
    }

    /**
     * Cache search results
     */
    public setSearchResult(query: string, context: any, result: any): void {
        const key = this.generateSearchKey(query, context);
        this.searchCache.set(key, {
            data: result,
            timestamp: Date.now(),
            ttl: this.searchTTL,
            accessCount: 0
        });
        
        this.enforceMaxSize(this.searchCache);
    }

    /**
     * Get cached search results
     */
    public getSearchResult(query: string, context: any): any | null {
        const key = this.generateSearchKey(query, context);
        const entry = this.searchCache.get(key);
        
        if (!entry || this.isExpired(entry)) {
            if (entry) {
                this.searchCache.delete(key);
            }
            return null;
        }
        
        entry.accessCount++;
        entry.lastAccess = Date.now();
        return entry.data;
    }

    /**
     * Cache embedding results
     */
    public setEmbedding(text: string, embedding: number[]): void {
        const key = this.hashText(text);
        this.embeddingCache.set(key, {
            data: embedding,
            timestamp: Date.now(),
            ttl: this.embeddingTTL,
            accessCount: 0
        });
        
        this.enforceMaxSize(this.embeddingCache);
    }

    /**
     * Get cached embedding
     */
    public getEmbedding(text: string): number[] | null {
        const key = this.hashText(text);
        const entry = this.embeddingCache.get(key);
        
        if (!entry || this.isExpired(entry)) {
            if (entry) {
                this.embeddingCache.delete(key);
            }
            return null;
        }
        
        entry.accessCount++;
        entry.lastAccess = Date.now();
        return entry.data;
    }

    /**
     * Cache chunk data
     */
    public setChunk(chunkId: string, chunk: any): void {
        this.chunkCache.set(chunkId, {
            data: chunk,
            timestamp: Date.now(),
            ttl: this.defaultTTL,
            accessCount: 0
        });
        
        this.enforceMaxSize(this.chunkCache);
    }

    /**
     * Get cached chunk
     */
    public getChunk(chunkId: string): any | null {
        const entry = this.chunkCache.get(chunkId);
        
        if (!entry || this.isExpired(entry)) {
            if (entry) {
                this.chunkCache.delete(chunkId);
            }
            return null;
        }
        
        entry.accessCount++;
        entry.lastAccess = Date.now();
        return entry.data;
    }

    /**
     * Cache system statistics
     */
    public setStats(stats: any): void {
        this.statsCache = {
            data: stats,
            timestamp: Date.now(),
            ttl: 30000, // 30 seconds for stats
            accessCount: 0
        };
    }

    /**
     * Get cached stats
     */
    public getStats(): any | null {
        if (!this.statsCache || this.isExpired(this.statsCache)) {
            this.statsCache = null;
            return null;
        }
        
        this.statsCache.accessCount++;
        this.statsCache.lastAccess = Date.now();
        return this.statsCache.data;
    }

    /**
     * Invalidate cache entries by pattern
     */
    public invalidate(pattern: 'search' | 'embeddings' | 'chunks' | 'stats' | 'all'): void {
        switch (pattern) {
            case 'search':
                this.searchCache.clear();
                break;
            case 'embeddings':
                this.embeddingCache.clear();
                break;
            case 'chunks':
                this.chunkCache.clear();
                break;
            case 'stats':
                this.statsCache = null;
                break;
            case 'all':
                this.searchCache.clear();
                this.embeddingCache.clear();
                this.chunkCache.clear();
                this.statsCache = null;
                break;
        }
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): CacheStats {
        const calculateStats = (cache: Map<string, CacheEntry<any>>) => {
            const entries = Array.from(cache.values());
            const totalHits = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
            const expired = entries.filter(entry => this.isExpired(entry)).length;
            
            return {
                size: cache.size,
                totalHits,
                expired,
                hitRate: cache.size > 0 ? totalHits / cache.size : 0
            };
        };

        return {
            search: calculateStats(this.searchCache),
            embeddings: calculateStats(this.embeddingCache),
            chunks: calculateStats(this.chunkCache),
            stats: this.statsCache ? {
                size: 1,
                totalHits: this.statsCache.accessCount,
                expired: this.isExpired(this.statsCache) ? 1 : 0,
                hitRate: this.statsCache.accessCount > 0 ? 1 : 0
            } : { size: 0, totalHits: 0, expired: 0, hitRate: 0 }
        };
    }

    /**
     * Preload commonly used data
     */
    public async preload(commonQueries: string[], commonTexts: string[]): Promise<void> {
        // This would be implemented with actual embedding and search services
        console.debug('Preloading cache with common queries and texts');
    }

    private generateSearchKey(query: string, context: any): string {
        // Create a stable key for search results
        const contextStr = JSON.stringify({
            workspacePath: context.workspacePath,
            // Include only stable context elements
        });
        return `${this.hashText(query)}_${this.hashText(contextStr)}`;
    }

    private hashText(text: string): string {
        // Simple hash function for string keys
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    private isExpired(entry: CacheEntry<any>): boolean {
        return Date.now() - entry.timestamp > entry.ttl;
    }

    private enforceMaxSize<T>(cache: Map<string, CacheEntry<T>>): void {
        if (cache.size <= this.maxCacheSize) {
            return;
        }

        // Remove least recently used entries
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => {
            const aLastAccess = a[1].lastAccess || a[1].timestamp;
            const bLastAccess = b[1].lastAccess || b[1].timestamp;
            return aLastAccess - bLastAccess;
        });

        const toRemove = entries.slice(0, cache.size - this.maxCacheSize);
        for (const [key] of toRemove) {
            cache.delete(key);
        }
    }

    private cleanup(): void {
        // Remove expired entries
        const cleanupCache = <T>(cache: Map<string, CacheEntry<T>>) => {
            for (const [key, entry] of cache) {
                if (this.isExpired(entry)) {
                    cache.delete(key);
                }
            }
        };

        cleanupCache(this.searchCache);
        cleanupCache(this.embeddingCache);
        cleanupCache(this.chunkCache);

        if (this.statsCache && this.isExpired(this.statsCache)) {
            this.statsCache = null;
        }
    }
}

/**
 * Batch processing utilities for improved performance
 */
export class BatchProcessor {
    private static instance?: BatchProcessor;
    private processingQueues: Map<string, ProcessingQueue> = new Map();

    private constructor() {}

    public static getInstance(): BatchProcessor {
        if (!BatchProcessor.instance) {
            BatchProcessor.instance = new BatchProcessor();
        }
        return BatchProcessor.instance;
    }

    /**
     * Add item to batch processing queue
     */
    public addToBatch<T, R>(
        queueName: string,
        item: T,
        processor: (items: T[]) => Promise<R[]>,
        options: BatchOptions = {}
    ): Promise<R> {
        return new Promise((resolve, reject) => {
            if (!this.processingQueues.has(queueName)) {
                this.processingQueues.set(queueName, {
                    items: [],
                    promises: [],
                    processor,
                    options: {
                        batchSize: options.batchSize || 10,
                        maxWaitTime: options.maxWaitTime || 100,
                        maxConcurrency: options.maxConcurrency || 3
                    },
                    timer: null,
                    processing: false
                });
            }

            const queue = this.processingQueues.get(queueName)!;
            queue.items.push(item);
            queue.promises.push({ resolve, reject });

            // Process immediately if batch is full
            if (queue.items.length >= queue.options.batchSize) {
                this.processBatch(queueName);
            } else if (!queue.timer) {
                // Set timer for processing
                queue.timer = setTimeout(() => {
                    this.processBatch(queueName);
                }, queue.options.maxWaitTime);
            }
        });
    }

    private async processBatch(queueName: string): Promise<void> {
        const queue = this.processingQueues.get(queueName);
        if (!queue || queue.processing || queue.items.length === 0) {
            return;
        }

        queue.processing = true;
        
        if (queue.timer) {
            clearTimeout(queue.timer);
            queue.timer = null;
        }

        const itemsToProcess = queue.items.splice(0, queue.options.batchSize);
        const promisesToResolve = queue.promises.splice(0, queue.options.batchSize);

        try {
            const results = await queue.processor(itemsToProcess);
            
            // Resolve promises with corresponding results
            promisesToResolve.forEach((promise, index) => {
                if (results[index] !== undefined) {
                    promise.resolve(results[index]);
                } else {
                    promise.reject(new Error('No result for item'));
                }
            });
        } catch (error) {
            // Reject all promises in the batch
            promisesToResolve.forEach(promise => {
                promise.reject(error);
            });
        } finally {
            queue.processing = false;
            
            // Process remaining items if any
            if (queue.items.length > 0) {
                setTimeout(() => this.processBatch(queueName), 10);
            }
        }
    }
}

// Type definitions
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccess?: number;
}

interface CacheStats {
    search: CacheTypeStats;
    embeddings: CacheTypeStats;
    chunks: CacheTypeStats;
    stats: CacheTypeStats;
}

interface CacheTypeStats {
    size: number;
    totalHits: number;
    expired: number;
    hitRate: number;
}

interface ProcessingQueue {
    items: any[];
    promises: Array<{ resolve: (value: any) => void; reject: (error: any) => void }>;
    processor: (items: any[]) => Promise<any[]>;
    options: Required<BatchOptions>;
    timer: NodeJS.Timeout | null;
    processing: boolean;
}

interface BatchOptions {
    batchSize?: number;
    maxWaitTime?: number;
    maxConcurrency?: number;
}

export { CacheEntry, CacheStats, BatchOptions };