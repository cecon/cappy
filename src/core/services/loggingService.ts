import { ProcessingLogEntry } from '../../models/cappyragTypes';

/**
 * Log level enumeration
 */
export enum LogLevel {
    debug = 0,
    info = 1,
    warn = 2,
    error = 3,
    fatal = 4
}

/**
 * Performance timing data
 */
export interface PerformanceTiming {
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
    metadata?: Record<string, any>;
}

/**
 * Simple log entry
 */
export interface SimpleLogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    category: string;
    sessionId: string;
    metadata?: Record<string, any>;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
    minLevel: LogLevel;
    enableConsole: boolean;
    maxLogEntries: number;
    performanceThresholdMs: number;
}

/**
 * Centralized logging and metrics service
 * Provides structured logging, performance monitoring, and system health tracking
 */
export class LoggingService {
    private config: LoggingConfig;
    private logs: SimpleLogEntry[] = [];
    private performanceTimings: PerformanceTiming[] = [];
    private activeTimers: Map<string, number> = new Map();
    private sessionId: string;
    private processingStats = {
        totalDocuments: 0,
        successfulDocuments: 0,
        failedDocuments: 0,
        totalEntities: 0,
        totalRelationships: 0,
        totalChunks: 0
    };

    constructor(config: Partial<LoggingConfig> = {}) {
        this.config = {
            minLevel: config.minLevel ?? LogLevel.info,
            enableConsole: config.enableConsole ?? true,
            maxLogEntries: config.maxLogEntries ?? 10000,
            performanceThresholdMs: config.performanceThresholdMs ?? 1000
        };

        this.sessionId = this.generateSessionId();
    }

    /**
     * Log a message with specified level
     */
    log(level: LogLevel, message: string, category: string = 'general', metadata?: Record<string, any>): void {
        if (level < this.config.minLevel) {
            return;
        }

        const entry: SimpleLogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            category,
            sessionId: this.sessionId,
            metadata: metadata || {}
        };

        this.addLogEntry(entry);
    }

    /**
     * Log debug message
     */
    debug(message: string, category: string = 'debug', metadata?: Record<string, any>): void {
        this.log(LogLevel.debug, message, category, metadata);
    }

    /**
     * Log info message
     */
    info(message: string, category: string = 'info', metadata?: Record<string, any>): void {
        this.log(LogLevel.info, message, category, metadata);
    }

    /**
     * Log warning message
     */
    warn(message: string, category: string = 'warning', metadata?: Record<string, any>): void {
        this.log(LogLevel.warn, message, category, metadata);
    }

    /**
     * Log error message
     */
    error(message: string, category: string = 'error', metadata?: Record<string, any>): void {
        this.log(LogLevel.error, message, category, metadata);
    }

    /**
     * Start performance timing
     */
    startTiming(name: string, metadata?: Record<string, any>): string {
        const timerId = `${name}_${Date.now()}_${Math.random()}`;
        this.activeTimers.set(timerId, Date.now());
        
        this.debug(`Started timing: ${name}`, 'performance', { timerId, ...metadata });
        return timerId;
    }

    /**
     * End performance timing and record result
     */
    endTiming(timerId: string, metadata?: Record<string, any>): PerformanceTiming | null {
        const startTime = this.activeTimers.get(timerId);
        if (!startTime) {
            this.warn(`Timer not found: ${timerId}`, 'performance');
            return null;
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        const name = timerId.split('_')[0];

        const timing: PerformanceTiming = {
            name,
            startTime,
            endTime,
            duration,
            metadata: metadata || {}
        };

        this.performanceTimings.push(timing);
        this.activeTimers.delete(timerId);

        // Log slow operations
        if (duration > this.config.performanceThresholdMs) {
            this.warn(`Slow operation detected: ${name} took ${duration}ms`, 'performance', {
                duration,
                threshold: this.config.performanceThresholdMs,
                ...metadata
            });
        }

        this.debug(`Completed timing: ${name} (${duration}ms)`, 'performance', { duration, ...metadata });
        return timing;
    }

    /**
     * Log processing step
     */
    logStep(
        phase: string,
        status: 'started' | 'completed' | 'failed',
        message: string,
        metadata?: Record<string, any>
    ): void {
        const level = status === 'failed' ? LogLevel.error : LogLevel.info;
        const category = `processing.${phase}`;
        
        this.log(level, `${phase.toUpperCase()}: ${message}`, category, {
            phase,
            status,
            timestamp: new Date().toISOString(),
            ...metadata
        });
    }

    /**
     * Update processing statistics
     */
    updateProcessingStats(updates: Partial<typeof this.processingStats>): void {
        Object.assign(this.processingStats, updates);
        
        this.debug('Processing stats updated', 'stats', {
            stats: this.processingStats,
            updates
        });
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): {
        totalOperations: number;
        averageDuration: number;
        minDuration: number;
        maxDuration: number;
        slowestOperations: PerformanceTiming[];
    } {
        if (this.performanceTimings.length === 0) {
            return {
                totalOperations: 0,
                averageDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                slowestOperations: []
            };
        }

        const durations = this.performanceTimings.map(t => t.duration);
        const totalDuration = durations.reduce((sum, d) => sum + d, 0);
        
        // Get slowest operations
        const sortedByDuration = [...this.performanceTimings].sort((a, b) => b.duration - a.duration);

        return {
            totalOperations: this.performanceTimings.length,
            averageDuration: totalDuration / this.performanceTimings.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            slowestOperations: sortedByDuration.slice(0, 10)
        };
    }

    /**
     * Get recent logs
     */
    getRecentLogs(count: number = 100, level?: LogLevel, category?: string): SimpleLogEntry[] {
        let filteredLogs = this.logs;

        if (level !== undefined) {
            filteredLogs = filteredLogs.filter(log => log.level >= level);
        }

        if (category) {
            filteredLogs = filteredLogs.filter(log => log.category === category);
        }

        return filteredLogs.slice(-count);
    }

    /**
     * Get processing statistics
     */
    getProcessingStats(): typeof this.processingStats {
        return { ...this.processingStats };
    }

    /**
     * Clear logs and metrics
     */
    clearLogs(): void {
        this.logs = [];
        this.performanceTimings = [];
        this.info('Logs and metrics cleared', 'system');
    }

    /**
     * Convert simple log to ProcessingLogEntry format
     */
    createProcessingLogEntry(
        phase: 'chunking' | 'extraction' | 'deduplication' | 'indexing', 
        status: 'started' | 'completed' | 'error', 
        message: string, 
        details?: any
    ): ProcessingLogEntry {
        return {
            timestamp: new Date().toISOString(),
            step: phase,
            status,
            message,
            details
        };
    }

    /**
     * Add log entry to storage
     */
    private addLogEntry(entry: SimpleLogEntry): void {
        this.logs.push(entry);

        // Trim logs if needed
        if (this.logs.length > this.config.maxLogEntries) {
            this.logs = this.logs.slice(-this.config.maxLogEntries);
        }

        // Console output if enabled
        if (this.config.enableConsole) {
            this.outputToConsole(entry);
        }
    }

    /**
     * Output log entry to console
     */
    private outputToConsole(entry: SimpleLogEntry): void {
        const levelName = LogLevel[entry.level];
        const message = `[${entry.timestamp}] [${levelName}] [${entry.category}] ${entry.message}`;
        
        switch (entry.level) {
            case LogLevel.debug:
                console.debug(message, entry.metadata);
                break;
            case LogLevel.info:
                console.info(message, entry.metadata);
                break;
            case LogLevel.warn:
                console.warn(message, entry.metadata);
                break;
            case LogLevel.error:
            case LogLevel.fatal:
                console.error(message, entry.metadata);
                break;
        }
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}