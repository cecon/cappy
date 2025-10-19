/**
 * Transformer utility - Level 3
 */
import { TransformStrategy } from './TransformStrategy';

export class Transformer {
  private strategy: TransformStrategy;

  constructor() {
    this.strategy = new TransformStrategy();
  }

  async initialize(): Promise<void> {
    await this.strategy.initialize();
  }

  transform(data: string): string {
    return this.strategy.apply(data);
  }
}
