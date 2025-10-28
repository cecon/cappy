/**
 * CAPPY Logger Utility
 * 
 * Centralized logging with levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = 'info';
  private readonly prefix: string;
  
  private constructor(prefix: string = 'CAPPY') {
    this.prefix = prefix;
  }
  
  static getInstance(prefix?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(prefix);
    }
    return Logger.instance;
  }
  
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[${this.prefix}] [DEBUG]`, message, ...args);
    }
  }
  
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(`[${this.prefix}] [INFO]`, message, ...args);
    }
  }
  
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[${this.prefix}] [WARN]`, message, ...args);
    }
  }
  
  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[${this.prefix}] [ERROR]`, message, error, ...args);
    }
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }
}

// Export default instance
export const logger = Logger.getInstance();
