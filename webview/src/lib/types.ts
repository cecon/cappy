/**
 * One tool invocation requested by the model.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Message model shared by the webview chat UI and bridge payloads.
 */
export interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/**
 * MCP server endpoint configuration.
 */
export interface McpServerConfig {
  name: string;
  url: string;
}

/**
 * MCP tool metadata displayed in the webview.
 */
export interface McpTool {
  serverName: string;
  name: string;
  description: string;
}

/**
 * Cappy runtime configuration payload.
 */
export type ActiveAgent = "coder" | "planner" | "reviewer";

/**
 * Cappy runtime configuration payload.
 */
export interface CappyConfig {
  openrouter: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
  agent: {
    activeAgent: ActiveAgent;
    systemPrompt: string;
    maxIterations: number;
  };
  mcp: {
    servers: McpServerConfig[];
  };
}
