import { globFilesTool } from "./globFiles";
import { listDirTool } from "./listDir";
import { readFileTool } from "./readFile";
import { runTerminalTool } from "./runTerminal";
import { searchCodeTool } from "./searchCode";
import { writeFileTool } from "./writeFile";

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
  properties: Record<string, JsonSchemaProperty>;
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
}

/**
 * Registry with all scaffold tools.
 */
export const toolsRegistry: ToolDefinition<any, unknown>[] = [
  globFilesTool,
  readFileTool,
  writeFileTool,
  listDirTool,
  runTerminalTool,
  searchCodeTool,
];
