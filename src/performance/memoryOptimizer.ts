import { PerformanceMonitor } from './monitor';
import { LightRAGCache } from './cache';

/**
 * Memory optimization utilities for LightRAG
 */
export class MemoryOptimizer {
    private static instance?: MemoryOptimizer;
    private performanceMonitor: PerformanceMonitor;
    private cache: LightRAGCache;
    private memoryPressureThreshold = 0.8; // 80% of available memory
    private gcInterval: NodeJS.Timeout | null = null;
    private memoryCheckInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.cache = LightRAGCache.getInstance();
        this.startMemoryMonitoring();
    }

    public static getInstance(): MemoryOptimizer {
        if (!MemoryOptimizer.instance) {
            MemoryOptimizer.instance = new MemoryOptimizer();
        }
        return MemoryOptimizer.instance;
    }

    /**
     * Start memory monitoring and optimization
     */
    private startMemoryMonitoring(): void {
        // Check memory every 30 seconds
        this.memoryCheckInterval = setInterval(() => {
            this.checkMemoryPressure();
        }, 30000);

        // Force garbage collection every 5 minutes if enabled
        if (global.gc) {
            this.gcInterval = setInterval(() => {
                this.performGarbageCollection();
            }, 300000);
        }
    }

    /**
     * Check for memory pressure and take action
     */
    private checkMemoryPressure(): void {
        const memoryUsage = this.performanceMonitor.getCurrentMemoryUsage();
        const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;

        if (memoryPressure > this.memoryPressureThreshold) {
            console.warn(`Memory pressure detected: ${Math.round(memoryPressure * 100)}%`);
            this.handleMemoryPressure();
        }
    }

    /**
     * Handle memory pressure by clearing caches and optimizing
     */
    private handleMemoryPressure(): void {
        console.log('Handling memory pressure...');

        // Clear least important caches first
        this.cache.invalidate('search');
        
        // Force garbage collection if available
        this.performGarbageCollection();

        // If still under pressure, clear more caches
        setTimeout(() => {
            const memoryUsage = this.performanceMonitor.getCurrentMemoryUsage();
            const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
            
            if (memoryPressure > this.memoryPressureThreshold) {
                console.warn('Clearing additional caches due to continued memory pressure');
                this.cache.invalidate('chunks');
                this.performGarbageCollection();
            }
        }, 5000);
    }

    /**
     * Force garbage collection if available
     */
    private performGarbageCollection(): void {
        if (global.gc) {
            const beforeGC = process.memoryUsage().heapUsed;
            global.gc();
            const afterGC = process.memoryUsage().heapUsed;
            const recovered = beforeGC - afterGC;
            
            if (recovered > 0) {
                console.log(`Garbage collection recovered ${Math.round(recovered / 1024 / 1024)}MB`);
            }
        }
    }

    /**
     * Optimize data structures for memory efficiency
     */
    public optimizeDataStructure<T>(data: T[]): OptimizedArray<T> {
        // Use typed arrays when possible for better memory efficiency
        if (data.length === 0) {
            return new OptimizedArray<T>([]);
        }

        // Check if all elements are numbers
        if (typeof data[0] === 'number' && data.every(item => typeof item === 'number')) {
            return new OptimizedArray(new Float32Array(data as unknown as number[]) as unknown as T[]);
        }

        return new OptimizedArray(data);
    }

    /**
     * Create memory-efficient buffer for large datasets
     */
    public createBuffer(size: number): ArrayBuffer {
        return new ArrayBuffer(size);
    }

    /**
     * Stream large datasets to avoid memory spikes
     */
    public async* streamArray<T>(array: T[], chunkSize: number = 100): AsyncGenerator<T[], void, unknown> {
        for (let i = 0; i < array.length; i += chunkSize) {
            yield array.slice(i, i + chunkSize);
            
            // Allow other operations to run
            await new Promise(resolve => setImmediate(resolve));
        }
    }

    /**
     * Cleanup and dispose resources
     */
    public dispose(): void {
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }

        if (this.gcInterval) {
            clearInterval(this.gcInterval);
            this.gcInterval = null;
        }
    }
}

/**
 * Optimized array wrapper for better memory efficiency
 */
export class OptimizedArray<T> {
    private data: T[] | Float32Array;
    private readonly isTypedArray: boolean;

    constructor(data: T[] | Float32Array) {
        this.data = data;
        this.isTypedArray = data instanceof Float32Array;
    }

    get length(): number {
        return this.data.length;
    }

    get(index: number): T | undefined {
        if (index < 0 || index >= this.data.length) {
            return undefined;
        }
        return this.data[index] as T;
    }

    set(index: number, value: T): void {
        if (index >= 0 && index < this.data.length) {
            this.data[index] = value as any;
        }
    }

    slice(start?: number, end?: number): T[] {
        if (this.isTypedArray) {
            const sliced = (this.data as Float32Array).slice(start, end);
            return Array.from(sliced) as unknown as T[];
        } else {
            return (this.data as T[]).slice(start, end);
        }
    }

    forEach(callback: (value: T, index: number) => void): void {
        for (let i = 0; i < this.data.length; i++) {
            callback(this.data[i] as T, i);
        }
    }

    map<U>(callback: (value: T, index: number) => U): U[] {
        const result: U[] = [];
        for (let i = 0; i < this.data.length; i++) {
            result.push(callback(this.data[i] as T, i));
        }
        return result;
    }

    filter(predicate: (value: T, index: number) => boolean): T[] {
        const result: T[] = [];
        for (let i = 0; i < this.data.length; i++) {
            if (predicate(this.data[i] as T, i)) {
                result.push(this.data[i] as T);
            }
        }
        return result;
    }

    toArray(): T[] {
        if (this.isTypedArray) {
            return Array.from(this.data as Float32Array) as unknown as T[];
        } else {
            return [...(this.data as T[])];
        }
    }

    getMemoryUsage(): number {
        if (this.isTypedArray) {
            return (this.data as Float32Array).byteLength;
        } else {
            // Rough estimate for regular arrays
            return this.data.length * 8; // Assume 8 bytes per element
        }
    }
}

/**
 * Resource pool for managing expensive objects
 */
export class ResourcePool<T> {
    private available: T[] = [];
    private inUse: Set<T> = new Set();
    private factory: () => T;
    private destroyer?: (resource: T) => void;
    private maxSize: number;
    private minSize: number;

    constructor(
        factory: () => T,
        options: {
            maxSize?: number;
            minSize?: number;
            destroyer?: (resource: T) => void;
        } = {}
    ) {
        this.factory = factory;
        this.destroyer = options.destroyer;
        this.maxSize = options.maxSize || 10;
        this.minSize = options.minSize || 1;

        // Pre-create minimum resources
        for (let i = 0; i < this.minSize; i++) {
            this.available.push(this.factory());
        }
    }

    /**
     * Acquire a resource from the pool
     */
    public acquire(): T {
        let resource: T;

        if (this.available.length > 0) {
            resource = this.available.pop()!;
        } else if (this.inUse.size < this.maxSize) {
            resource = this.factory();
        } else {
            throw new Error('Resource pool exhausted');
        }

        this.inUse.add(resource);
        return resource;
    }

    /**
     * Release a resource back to the pool
     */
    public release(resource: T): void {
        if (!this.inUse.has(resource)) {
            return;
        }

        this.inUse.delete(resource);
        
        if (this.available.length < this.maxSize) {
            this.available.push(resource);
        } else if (this.destroyer) {
            this.destroyer(resource);
        }
    }

    /**
     * Get pool statistics
     */
    public getStats(): PoolStats {
        return {
            available: this.available.length,
            inUse: this.inUse.size,
            total: this.available.length + this.inUse.size,
            maxSize: this.maxSize
        };
    }

    /**
     * Dispose the entire pool
     */
    public dispose(): void {
        if (this.destroyer) {
            this.available.forEach(resource => this.destroyer!(resource));
            this.inUse.forEach(resource => this.destroyer!(resource));
        }
        
        this.available.length = 0;
        this.inUse.clear();
    }
}

// Type definitions
interface PoolStats {
    available: number;
    inUse: number;
    total: number;
    maxSize: number;
}

export { PoolStats };
