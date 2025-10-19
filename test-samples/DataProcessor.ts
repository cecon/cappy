/**
 * Data processor with multiple dependencies
 */
import { Logger } from './Logger';
import { Validator } from './Validator';
import { Transformer } from './Transformer';

export class DataProcessor {
  private logger: Logger;
  private validator: Validator;
  private transformer: Transformer;
  private initialized = false;

  constructor() {
    this.logger = new Logger('DataProcessor');
    this.validator = new Validator();
    this.transformer = new Transformer();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing processor...');
    await this.validator.initialize();
    await this.transformer.initialize();
    this.initialized = true;
  }

  async process(data: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Processor not initialized');
    }

    const isValid = this.validator.validate(data);
    if (!isValid) {
      throw new Error('Validation failed');
    }

    const transformed = this.transformer.transform(data);
    return transformed;
  }

  isReady(): boolean {
    return this.initialized;
  }
}
