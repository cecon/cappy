/**
 * Test file for TypeScript parser
 * 
 * @fileoverview This file contains examples for testing the TypeScript parser
 * @module test/sample
 */

/**
 * Calculates the sum of two numbers
 * 
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 * @example
 * ```ts
 * const result = add(2, 3); // returns 5
 * ```
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * User interface representing a system user
 * 
 * @interface User
 * @property id - Unique identifier
 * @property name - User's full name
 * @property email - User's email address
 */
export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * UserService class for managing users
 * 
 * @class UserService
 * @description Provides methods for user CRUD operations
 */
export class UserService {
  private users: User[] = [];

  /**
   * Adds a new user
   * 
   * @param user - User to add
   * @returns The added user
   */
  addUser(user: User): User {
    this.users.push(user);
    return user;
  }

  /**
   * Finds a user by ID
   * 
   * @param id - User ID to search for
   * @returns User if found, undefined otherwise
   */
  findUser(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }
}
