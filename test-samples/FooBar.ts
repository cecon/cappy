/**
 * Sample class to test graph relationships
 */

import { BaseService } from './BaseService';
import { Logger } from './Logger';
import { DataProcessor } from './DataProcessor';

/**
 * Main FooBar class that demonstrates multiple relationship levels
 */
export class FooBar extends BaseService {
  private logger: Logger;
  private processor: DataProcessor;
  private config: FooBarConfig;

  constructor(config: FooBarConfig) {
    super();
    this.config = config;
    this.logger = new Logger('FooBar');
    this.processor = new DataProcessor();
  }

  /**
   * Initialize the FooBar service
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing FooBar...');
    await this.processor.initialize();
  }

  /**
   * Process data using the processor
   */
  async processData(data: string): Promise<ProcessResult> {
    const validated = this.validateData(data);
    if (!validated) {
      throw new Error('Invalid data');
    }

    const result = await this.processor.process(data);
    this.logger.info('Data processed successfully');
    
    return {
      success: true,
      data: result,
      timestamp: Date.now()
    };
  }

  /**
   * Validate input data
   */
  private validateData(data: string): boolean {
    return data && data.length > 0;
  }

  /**
   * Get current configuration
   */
  getConfig(): FooBarConfig {
    return { ...this.config };
  }
}

/**
 * Configuration interface for FooBar
 */
export interface FooBarConfig {
  name: string;
  maxRetries: number;
  timeout: number;
}

/**
 * Result of processing operation
 */
export interface ProcessResult {
  success: boolean;
  data: string;
  timestamp: number;
}
