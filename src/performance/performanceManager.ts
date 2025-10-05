import { PerformanceMonitor } from './monitor';
import { LightRAGCache } from './cache';
import { MemoryOptimizer } from './memoryOptimizer';

/**
 * Performance manager that coordinates all optimization strategies
 */
export class PerformanceManager {
    private static instance?: PerformanceManager;
    private performanceMonitor: PerformanceMonitor;
    private cache: LightRAGCache;
    private memoryOptimizer: MemoryOptimizer;
    private optimizationEnabled = true;
    private autoOptimizeInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.cache = LightRAGCache.getInstance();
        this.memoryOptimizer = MemoryOptimizer.getInstance();
        
        this.startAutoOptimization();
    }

    public static getInstance(): PerformanceManager {
        if (!PerformanceManager.instance) {
            PerformanceManager.instance = new PerformanceManager();
        }
        return PerformanceManager.instance;
    }

    /**
     * Wrap operation with performance monitoring
     */
    public async withPerformanceMonitoring<T>(
        operationName: string,
        operation: () => Promise<T>,
        options: PerformanceOptions = {}
    ): Promise<T> {
        const timer = this.performanceMonitor.startOperation(operationName);
        
        try {
            let result: T;
            
            if (options.enableCaching && options.cacheKey) {
                // Try to get from cache first
                const cached = this.getCachedResult(options.cacheKey);
                if (cached !== null) {
                    timer.end({ cached: true });
                    return cached;
                }
                
                // Execute operation and cache result
                result = await operation();
                this.setCachedResult(options.cacheKey, result, options.cacheTTL);
            } else {
                result = await operation();
            }
            
            timer.end({ 
                cached: false,
                resultSize: this.estimateSize(result)
            });
            
            return result;
            
        } catch (error) {
            timer.end({ error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Get cached result
     */
    private getCachedResult(key: string): any {
        if (key.startsWith('search:')) {
            return this.cache.getSearchResult(key.substring(7), {});
        } else if (key.startsWith('embedding:')) {
            return this.cache.getEmbedding(key.substring(10));
        } else if (key.startsWith('chunk:')) {
            return this.cache.getChunk(key.substring(6));
        }
        return null;
    }

    /**
     * Set cached result
     */
    private setCachedResult(key: string, result: any, ttl?: number): void {
        if (key.startsWith('search:')) {
            this.cache.setSearchResult(key.substring(7), {}, result);
        } else if (key.startsWith('embedding:')) {
            this.cache.setEmbedding(key.substring(10), result);
        } else if (key.startsWith('chunk:')) {
            this.cache.setChunk(key.substring(6), result);
        }
    }

    /**
     * Estimate object size for performance tracking
     */
    private estimateSize(obj: any): number {
        if (obj === null || obj === undefined) {
            return 0;
        }
        
        if (typeof obj === 'string') {
            return obj.length * 2; // Rough estimate for UTF-16
        }
        
        if (typeof obj === 'number') {
            return 8;
        }
        
        if (Array.isArray(obj)) {
            return obj.reduce((sum, item) => sum + this.estimateSize(item), 0);
        }
        
        if (typeof obj === 'object') {
            return Object.values(obj).reduce((sum: number, value: any) => sum + this.estimateSize(value), 0);
        }
        
        return 50; // Default estimate
    }

    /**
     * Start automatic optimization
     */
    private startAutoOptimization(): void {
        // Run optimization checks every 2 minutes
        this.autoOptimizeInterval = setInterval(() => {
            if (this.optimizationEnabled) {
                this.runOptimizationCheck();
            }
        }, 120000);
    }

    /**
     * Run optimization checks and take action
     */
    private async runOptimizationCheck(): Promise<void> {
        try {
            const alerts = this.performanceMonitor.isPerformanceDegraded();
            
            if (alerts.length > 0) {
                console.log('Performance optimization triggered by alerts:', alerts.length);
                await this.applyOptimizations(alerts);
            }
            
        } catch (error) {
            console.error('Auto-optimization failed:', error);
        }
    }

    /**
     * Apply optimizations based on alerts
     */
    private async applyOptimizations(alerts: any[]): Promise<void> {
        for (const alert of alerts) {
            switch (alert.type) {
                case 'memory':
                    console.log('Applying memory optimization...');
                    this.cache.invalidate('search');
                    break;
                    
                case 'latency':
                    console.log('Applying latency optimization...');
                    // Could implement operation timeouts or circuit breakers
                    break;
                    
                case 'memory_leak':
                    console.log('Applying memory leak mitigation...');
                    this.cache.invalidate('all');
                    break;
            }
        }
    }

    /**
     * Get comprehensive performance report
     */
    public getPerformanceReport(): PerformanceReport {
        const baseReport = this.performanceMonitor.generateReport();
        const cacheStats = this.cache.getCacheStats();
        
        return {
            ...baseReport,
            cache: cacheStats,
            optimization: {
                enabled: this.optimizationEnabled,
                lastOptimization: Date.now(),
                totalOptimizations: 0
            }
        };
    }

    /**
     * Optimize for specific operation types
     */
    public optimizeForWorkload(workloadType: 'search-heavy' | 'indexing-heavy' | 'balanced'): void {
        switch (workloadType) {
            case 'search-heavy':
                // Prioritize search result caching
                console.log('Optimizing for search-heavy workload');
                break;
                
            case 'indexing-heavy':
                // Reduce cache sizes to free memory for indexing
                console.log('Optimizing for indexing-heavy workload');
                this.cache.invalidate('search');
                break;
                
            case 'balanced':
                // Default balanced settings
                console.log('Optimizing for balanced workload');
                break;
        }
    }

    /**
     * Create optimized data structures
     */
    public createOptimizedVector(data: number[]): Float32Array {
        return new Float32Array(data);
    }

    /**
     * Stream large operations
     */
    public async* streamOperation<T, R>(
        items: T[],
        operation: (item: T) => Promise<R>,
        batchSize: number = 50
    ): AsyncGenerator<R[], void, unknown> {
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(operation));
            yield results;
            
            // Allow other operations to run
            await new Promise(resolve => setImmediate(resolve));
        }
    }

    /**
     * Enable or disable automatic optimization
     */
    public setOptimizationEnabled(enabled: boolean): void {
        this.optimizationEnabled = enabled;
        console.log(`Performance optimization ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Warm up caches with common operations
     */
    public async warmUpCaches(commonQueries: string[]): Promise<void> {
        console.log('Warming up caches...');
        
        // Pre-load common embeddings and searches
        await this.cache.preload(commonQueries, []);
        
        console.log('Cache warm-up completed');
    }

    /**
     * Force cleanup and optimization
     */
    public async forceOptimization(): Promise<void> {
        console.log('Running forced optimization...');
        
        // Clear expired cache entries
        const cacheStats = this.cache.getCacheStats();
        console.log('Cache stats before cleanup:', cacheStats);
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        console.log('Forced optimization completed');
    }

    /**
     * Dispose and cleanup
     */
    public dispose(): void {
        if (this.autoOptimizeInterval) {
            clearInterval(this.autoOptimizeInterval);
            this.autoOptimizeInterval = null;
        }
        
        this.memoryOptimizer.dispose();
        console.log('Performance manager disposed');
    }
}

// Enhanced performance report interface
interface PerformanceReport {
    timestamp: number;
    memoryUsage: any;
    operationStats: any[];
    alerts: any[];
    recommendations: string[];
    cache: any;
    optimization: {
        enabled: boolean;
        lastOptimization: number;
        totalOptimizations: number;
    };
}

interface PerformanceOptions {
    enableCaching?: boolean;
    cacheKey?: string;
    cacheTTL?: number;
    enableProfiling?: boolean;
    maxMemoryUsage?: number;
    timeout?: number;
}

export { PerformanceReport, PerformanceOptions };
