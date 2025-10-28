/**
 * CAPPY Validation Utilities
 */

import type { TaskCategory, TaskStatus } from '../types';

/**
 * Check if value is a valid task status
 */
export function isValidTaskStatus(value: unknown): value is TaskStatus {
  return value === 'active' || value === 'paused' || value === 'done';
}

/**
 * Check if value is a valid task category
 */
export function isValidTaskCategory(value: unknown): value is TaskCategory {
  const validCategories: TaskCategory[] = ['feature', 'bugfix', 'refactor', 'docs', 'test', 'chore'];
  return typeof value === 'string' && validCategories.includes(value as TaskCategory);
}

/**
 * Validate task title
 */
export function validateTaskTitle(title: string): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Title cannot be empty' };
  }
  
  if (title.length < 5) {
    return { valid: false, error: 'Title must be at least 5 characters' };
  }
  
  if (title.length > 200) {
    return { valid: false, error: 'Title must be less than 200 characters' };
  }
  
  return { valid: true };
}

/**
 * Validate file path
 */
export function validateFilePath(path: string): { valid: boolean; error?: string } {
  if (!path || path.trim().length === 0) {
    return { valid: false, error: 'Path cannot be empty' };
  }
  
  // Check for invalid characters (excluding control chars)
  const invalidChars = /[<>"|?*]/;
  if (invalidChars.test(path)) {
    return { valid: false, error: 'Path contains invalid characters' };
  }
  
  return { valid: true };
}

/**
 * Validate task ID format
 */
export function validateTaskId(id: string): { valid: boolean; error?: string } {
  if (!id || id.trim().length === 0) {
    return { valid: false, error: 'Task ID cannot be empty' };
  }
  
  // Format: YYYYMMDD_xxxx
  const pattern = /^\d{8}_[a-z0-9]{4}$/;
  if (!pattern.test(id)) {
    return { valid: false, error: 'Invalid task ID format (expected: YYYYMMDD_xxxx)' };
  }
  
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email cannot be empty' };
  }
  
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true };
}

/**
 * Validate URL format
 */
export function validateURL(url: string): { valid: boolean; error?: string } {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }
  
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Check if object has required properties
 */
export function hasRequiredProps<T extends Record<string, unknown>>(
  obj: unknown,
  requiredProps: (keyof T)[]
): obj is T {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  return requiredProps.every(prop => prop in obj);
}
