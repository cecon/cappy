import * as crypto from 'crypto';

/**
 * Interface for cache entries with metadata
 */
export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    hitCount: number;
    size?: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
    maxEntries: number;
    maxAge: number; // in milliseconds
    maxSizeBytes?: number;
    cleanupInterval: number;
}

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
    totalEntries: number;
    hits: number;
    misses: number;
    hitRate: number;
    totalSizeBytes: number;
    oldestEntry: number;
    newestEntry: number;
}

/**
 * High-performance caching service with intelligent cleanup
 * Specialized for embedding vectors and computation results
 */
export class CacheService<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private config: CacheConfig;
    private metrics = {
        hits: 0,
        misses: 0,
        cleanups: 0
    };

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = {
            maxEntries: config.maxEntries ?? 1000,
            maxAge: config.maxAge ?? 24 * 60 * 60 * 1000, // 24 hours
            maxSizeBytes: config.maxSizeBytes ?? 100 * 1024 * 1024, // 100MB
            cleanupInterval: config.cleanupInterval ?? 60 * 60 * 1000 // 1 hour
        };

        // Start periodic cleanup
        setInterval(() => this.cleanup(), this.config.cleanupInterval);
    }

    /**
     * Generate cache key from any data
     */
    generateKey(data: any): string {
        const serialized = typeof data === 'string' ? data : JSON.stringify(data);
        return crypto.createHash('md5').update(serialized).digest('hex');
    }

    /**
     * Store item in cache
     */
    set(key: string, data: T): void {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            hitCount: 0,
            size: this.estimateSize(data)
        };

        this.cache.set(key, entry);

        // Check if cleanup is needed
        if (this.cache.size > this.config.maxEntries) {
            this.cleanup();
        }
    }

    /**
     * Retrieve item from cache
     */
    get(key: string): T | null {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.metrics.misses++;
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > this.config.maxAge) {
            this.cache.delete(key);
            this.metrics.misses++;
            return null;
        }

        // Update hit metrics
        entry.hitCount++;
        this.metrics.hits++;
        
        return entry.data;
    }

    /**
     * Check if key exists in cache
     */
    has(key: string): boolean {
        return this.cache.has(key) && this.get(key) !== null;
    }

    /**
     * Remove item from cache
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
        this.metrics.hits = 0;
        this.metrics.misses = 0;
        this.metrics.cleanups = 0;
    }

    /**
     * Get cache metrics
     */
    getMetrics(): CacheMetrics {
        const entries = Array.from(this.cache.values());
        const totalSize = entries.reduce((sum, entry) => sum + (entry.size ?? 0), 0);
        const timestamps = entries.map(e => e.timestamp);

        return {
            totalEntries: this.cache.size,
            hits: this.metrics.hits,
            misses: this.metrics.misses,
            hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0,
            totalSizeBytes: totalSize,
            oldestEntry: timestamps.length ? Math.min(...timestamps) : 0,
            newestEntry: timestamps.length ? Math.max(...timestamps) : 0
        };
    }

    /**
     * Intelligent cache cleanup using LRU + age + size policies
     */
    private cleanup(): void {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());
        
        // Remove expired entries
        let removedExpired = 0;
        for (const [key, entry] of entries) {
            if (now - entry.timestamp > this.config.maxAge) {
                this.cache.delete(key);
                removedExpired++;
            }
        }

        // If still over limit, remove least recently used
        if (this.cache.size > this.config.maxEntries) {
            const sortedEntries = Array.from(this.cache.entries())
                .sort((a, b) => {
                    // Sort by hit count (ascending) then by timestamp (ascending)
                    if (a[1].hitCount !== b[1].hitCount) {
                        return a[1].hitCount - b[1].hitCount;
                    }
                    return a[1].timestamp - b[1].timestamp;
                });

            const toRemove = this.cache.size - this.config.maxEntries;
            for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
                this.cache.delete(sortedEntries[i][0]);
            }
        }

        this.metrics.cleanups++;
    }

    /**
     * Estimate memory size of cached data
     */
    private estimateSize(data: T): number {
        try {
            if (Array.isArray(data)) {
                // For arrays (like embeddings), estimate size based on length and type
                return data.length * 8; // Assume 8 bytes per number
            }
            
            const serialized = JSON.stringify(data);
            return serialized.length * 2; // UTF-16 encoding
        } catch {
            return 1024; // Default estimate
        }
    }

    /**
     * Get cache configuration
     */
    getConfig(): CacheConfig {
        return { ...this.config };
    }

    /**
     * Update cache configuration
     */
    updateConfig(newConfig: Partial<CacheConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
}

/**
 * Specialized embedding cache
 */
export class EmbeddingCacheService extends CacheService<number[]> {
    constructor() {
        super({
            maxEntries: 2000,
            maxAge: 48 * 60 * 60 * 1000, // 48 hours for embeddings
            maxSizeBytes: 200 * 1024 * 1024, // 200MB
            cleanupInterval: 30 * 60 * 1000 // 30 minutes
        });
    }

    /**
     * Cache embedding with text-based key
     */
    cacheEmbedding(text: string, embedding: number[]): void {
        const key = this.generateKey(text);
        this.set(key, embedding);
    }

    /**
     * Get cached embedding
     */
    getEmbedding(text: string): number[] | null {
        const key = this.generateKey(text);
        return this.get(key);
    }
}

/**
 * Specialized result cache for complex operations
 */
export class ResultCacheService extends CacheService<any> {
    constructor() {
        super({
            maxEntries: 500,
            maxAge: 60 * 60 * 1000, // 1 hour for results
            maxSizeBytes: 50 * 1024 * 1024, // 50MB
            cleanupInterval: 15 * 60 * 1000 // 15 minutes
        });
    }
}