/**
 * @fileoverview Sample TypeScript file for testing AST extraction
 * @module test-sample-simple
 * @author Test User
 * @since 1.0.0
 */

/**
 * Calculates the sum of two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Calculates the product of two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The product of a and b
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * User interface
 */
export interface User {
  id: number;
  name: string;
  email: string;
}

/**
 * Creates a new user
 * @param name - User's name
 * @param email - User's email
 * @returns A new User object
 */
export function createUser(name: string, email: string): User {
  return {
    id: Math.floor(Math.random() * 1000),
    name,
    email
  };
}

/**
 * Calculator class for advanced operations
 */
export class Calculator {
  private result: number = 0;

  /**
   * Adds a value to the current result
   * @param value - Value to add
   * @returns The calculator instance for chaining
   */
  add(value: number): Calculator {
    this.result = add(this.result, value);
    return this;
  }

  /**
   * Multiplies the current result by a value
   * @param value - Value to multiply by
   * @returns The calculator instance for chaining
   */
  multiply(value: number): Calculator {
    this.result = multiply(this.result, value);
    return this;
  }

  /**
   * Gets the current result
   * @returns The current calculation result
   */
  getResult(): number {
    return this.result;
  }

  /**
   * Resets the calculator
   */
  reset(): void {
    this.result = 0;
  }
}

/**
 * Configuration type
 */
export type Config = {
  apiUrl: string;
  timeout: number;
  retries: number;
};

/**
 * Default configuration
 */
export const defaultConfig: Config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
};
