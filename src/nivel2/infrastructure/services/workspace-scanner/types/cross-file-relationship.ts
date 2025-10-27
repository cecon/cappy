/**
 * Cross-file relationship
 */
export interface CrossFileRelationship {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, string | number | boolean | string[] | null>;
}