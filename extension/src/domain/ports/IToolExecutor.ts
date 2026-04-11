/**
 * Port: tool executor abstraction.
 * Decouples the agent loop from concrete tool implementations.
 */

/** Metadata about a single tool — includes destructiveness flag. */
export interface ToolMeta {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Whether this tool mutates files, runs shell commands, or has side effects. */
  destructive: boolean;
  /** Whether this tool is purely read-only (safe for Ask mode). */
  readOnly: boolean;
}

export interface IToolExecutor {
  /** Returns all registered tool definitions. */
  getDefinitions(): ToolMeta[];

  /** Executes a tool by name. Throws if the name is unknown. */
  execute(name: string, params: Record<string, unknown>): Promise<unknown>;

  /** Returns true if a tool with this name is registered. */
  has(name: string): boolean;

  /** Case-insensitive lookup — returns canonical name or undefined. */
  resolveCanonicalName(name: string): string | undefined;
}
