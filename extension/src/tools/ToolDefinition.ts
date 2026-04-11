/**
 * Enhanced ToolDefinition with metadata — replaces toolTypes.ts.
 * The `destructive` and `readOnly` flags eliminate magic string lists in the loop.
 */

/** Minimal JSON Schema property descriptor. */
export interface JsonSchemaProperty {
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
  default?: string | number | boolean;
  items?: JsonSchemaProperty | Record<string, unknown>;
  properties?: Record<string, JsonSchemaProperty | Record<string, unknown>>;
}

/** Minimal JSON Schema object used by tools. */
export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty | Record<string, unknown>>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Enhanced tool contract.
 *
 * - `destructive` — true for tools that mutate files, run shell commands, or have
 *   external side effects. Used by HitlPolicyService; eliminates DESTRUCTIVE_TOOLS lists.
 * - `readOnly` — true for tools safe in Ask mode (read, glob, grep, web fetch).
 */
export interface ToolDefinition<TParams = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: JsonSchema;
  /** Whether this tool writes files, runs shell, or has external side effects. */
  destructive: boolean;
  /** Whether this tool is purely read-only (allowed in Ask mode). */
  readOnly: boolean;
  execute: (params: TParams) => Promise<TResult>;
}
