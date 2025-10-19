/**
 * Validator utility - Level 3
 */
import { ValidationRule } from './ValidationRule';

export class Validator {
  private rules: ValidationRule[];

  constructor() {
    this.rules = [
      new ValidationRule('notEmpty'),
      new ValidationRule('maxLength')
    ];
  }

  async initialize(): Promise<void> {
    // Initialize validation rules
    await Promise.all(this.rules.map(r => r.initialize()));
  }

  validate(data: string): boolean {
    return this.rules.every(rule => rule.check(data));
  }
}
