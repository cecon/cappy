/**
 * JSON Schema property metadata used by tools.
 */
export interface JsonSchemaProperty {
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
  default?: string | number | boolean;
}

/**
 * Minimal JSON Schema object used by tools.
 */
export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty | Record<string, unknown>>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Shared contract for all Cappy tools.
 */
export interface ToolDefinition<TParams = any, TResult = unknown> {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute: (params: TParams) => Promise<TResult>;
  /**
   * When true, the tool has no side-effects on workspace state.
   * Readonly tools may be executed in parallel and their results cached within a run.
   */
  readonly?: boolean;
}
