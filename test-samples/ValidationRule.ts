/**
 * ValidationRule - Level 4 (deepest level)
 */
export class ValidationRule {
  constructor(private ruleName: string) {}

  async initialize(): Promise<void> {
    // Simulate async initialization
    await Promise.resolve();
  }

  check(data: string): boolean {
    switch (this.ruleName) {
      case 'notEmpty':
        return data.length > 0;
      case 'maxLength':
        return data.length <= 1000;
      default:
        return true;
    }
  }

  getName(): string {
    return this.ruleName;
  }
}
