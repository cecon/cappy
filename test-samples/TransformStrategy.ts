/**
 * TransformStrategy - Level 4 (deepest level)
 */
export class TransformStrategy {
  private transformType = 'uppercase';

  async initialize(): Promise<void> {
    // Simulate async initialization
    await Promise.resolve();
  }

  apply(data: string): string {
    switch (this.transformType) {
      case 'uppercase':
        return data.toUpperCase();
      case 'lowercase':
        return data.toLowerCase();
      default:
        return data;
    }
  }

  setType(type: string): void {
    this.transformType = type;
  }
}
