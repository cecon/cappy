/**
 * Performance monitoring and optimization utilities for LightRAG
 */
export class PerformanceMonitor {
    private static instance?: PerformanceMonitor;
    private metrics: Map<string, OperationMetric[]> = new Map();
    private memoryBaseline: number = 0;
    private isMonitoring = false;

    private constructor() {
        this.memoryBaseline = process.memoryUsage().heapUsed;
    }

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * Start monitoring a specific operation
     */
    public startOperation(operationName: string): OperationTimer {
        return new OperationTimer(operationName, this);
    }

    /**
     * Record operation completion
     */
    public recordOperation(operationName: string, duration: number, memoryDelta: number, metadata?: any): void {
        if (!this.metrics.has(operationName)) {
            this.metrics.set(operationName, []);
        }

        const operations = this.metrics.get(operationName)!;
        operations.push({
            timestamp: Date.now(),
            duration,
            memoryDelta,
            metadata
        });

        // Keep only last 100 operations per type
        if (operations.length > 100) {
            operations.splice(0, operations.length - 100);
        }
    }

    /**
     * Get performance statistics for an operation
     */
    public getStats(operationName: string): OperationStats | undefined {
        const operations = this.metrics.get(operationName);
        if (!operations || operations.length === 0) {
            return undefined;
        }

        const durations = operations.map(op => op.duration);
        const memoryDeltas = operations.map(op => op.memoryDelta);

        return {
            operationName,
            totalOperations: operations.length,
            averageDuration: this.average(durations),
            medianDuration: this.median(durations),
            p95Duration: this.percentile(durations, 95),
            p99Duration: this.percentile(durations, 99),
            averageMemoryDelta: this.average(memoryDeltas),
            lastOperation: operations[operations.length - 1]
        };
    }

    /**
     * Get all performance statistics
     */
    public getAllStats(): Map<string, OperationStats> {
        const stats = new Map<string, OperationStats>();
        
        for (const operationName of this.metrics.keys()) {
            const stat = this.getStats(operationName);
            if (stat) {
                stats.set(operationName, stat);
            }
        }

        return stats;
    }

    /**
     * Get current memory usage
     */
    public getCurrentMemoryUsage(): MemoryUsage {
        const usage = process.memoryUsage();
        return {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            rss: usage.rss,
            deltaFromBaseline: usage.heapUsed - this.memoryBaseline
        };
    }

    /**
     * Check if performance is degraded
     */
    public isPerformanceDegraded(): PerformanceAlert[] {
        const alerts: PerformanceAlert[] = [];
        const memoryUsage = this.getCurrentMemoryUsage();

        // Check memory usage
        if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
            alerts.push({
                type: 'memory',
                severity: 'warning',
                message: `High memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                metric: memoryUsage.heapUsed
            });
        }

        if (memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
            alerts.push({
                type: 'memory',
                severity: 'critical',
                message: `Critical memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                metric: memoryUsage.heapUsed
            });
        }

        // Check operation performance
        for (const [operationName, stats] of this.getAllStats()) {
            if (stats.p95Duration > 5000) { // 5 seconds
                alerts.push({
                    type: 'latency',
                    severity: 'warning',
                    message: `Slow operation "${operationName}": P95 = ${stats.p95Duration}ms`,
                    metric: stats.p95Duration
                });
            }

            if (stats.averageMemoryDelta > 50 * 1024 * 1024) { // 50MB per operation
                alerts.push({
                    type: 'memory_leak',
                    severity: 'warning',
                    message: `Memory leak in "${operationName}": ${Math.round(stats.averageMemoryDelta / 1024 / 1024)}MB per operation`,
                    metric: stats.averageMemoryDelta
                });
            }
        }

        return alerts;
    }

    /**
     * Generate performance report
     */
    public generateReport(): PerformanceReport {
        const allStats = this.getAllStats();
        const memoryUsage = this.getCurrentMemoryUsage();
        const alerts = this.isPerformanceDegraded();

        return {
            timestamp: Date.now(),
            memoryUsage,
            operationStats: Array.from(allStats.values()),
            alerts,
            recommendations: this.generateRecommendations(allStats, memoryUsage, alerts)
        };
    }

    private generateRecommendations(
        stats: Map<string, OperationStats>,
        memory: MemoryUsage,
        alerts: PerformanceAlert[]
    ): string[] {
        const recommendations: string[] = [];

        // Memory recommendations
        if (memory.heapUsed > 200 * 1024 * 1024) {
            recommendations.push('Consider reducing batch sizes or implementing result streaming');
        }

        // Performance recommendations
        for (const [operationName, stat] of stats) {
            if (stat.p95Duration > 2000) {
                recommendations.push(`Optimize "${operationName}" operation - consider caching or indexing`);
            }
        }

        // Alert-based recommendations
        for (const alert of alerts) {
            switch (alert.type) {
                case 'memory_leak':
                    recommendations.push('Check for memory leaks in long-running operations');
                    break;
                case 'latency':
                    recommendations.push('Consider implementing operation timeouts and cancellation');
                    break;
            }
        }

        return recommendations;
    }

    private average(numbers: number[]): number {
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    private median(numbers: number[]): number {
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    private percentile(numbers: number[], p: number): number {
        const sorted = [...numbers].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
}

/**
 * Timer for measuring operation performance
 */
export class OperationTimer {
    private startTime: number;
    private startMemory: number;
    private operationName: string;
    private monitor: PerformanceMonitor;

    constructor(operationName: string, monitor: PerformanceMonitor) {
        this.operationName = operationName;
        this.monitor = monitor;
        this.startTime = performance.now();
        this.startMemory = process.memoryUsage().heapUsed;
    }

    /**
     * End the operation and record metrics
     */
    public end(metadata?: any): OperationResult {
        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;
        
        const duration = endTime - this.startTime;
        const memoryDelta = endMemory - this.startMemory;

        this.monitor.recordOperation(this.operationName, duration, memoryDelta, metadata);

        return {
            operationName: this.operationName,
            duration,
            memoryDelta,
            metadata
        };
    }
}

// Type definitions
export interface OperationMetric {
    timestamp: number;
    duration: number;
    memoryDelta: number;
    metadata?: any;
}

export interface OperationStats {
    operationName: string;
    totalOperations: number;
    averageDuration: number;
    medianDuration: number;
    p95Duration: number;
    p99Duration: number;
    averageMemoryDelta: number;
    lastOperation: OperationMetric;
}

export interface MemoryUsage {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    deltaFromBaseline: number;
}

export interface PerformanceAlert {
    type: 'memory' | 'latency' | 'memory_leak';
    severity: 'warning' | 'critical';
    message: string;
    metric: number;
}

export interface PerformanceReport {
    timestamp: number;
    memoryUsage: MemoryUsage;
    operationStats: OperationStats[];
    alerts: PerformanceAlert[];
    recommendations: string[];
}

export interface OperationResult {
    operationName: string;
    duration: number;
    memoryDelta: number;
    metadata?: any;
}