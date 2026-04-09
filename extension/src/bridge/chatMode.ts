import type { McpTool } from "../mcp/client";
import type { AgentTool } from "../agent/types";

/**
 * UI chat mode from the webview (Plain = só texto, Agent = tools completos, Ask = só leitura/pesquisa).
 */
export type ChatUiMode = "plain" | "agent" | "ask";

const ASK_ALLOWED_TOOL_NAMES = new Set<string>([
  "ExploreAgent",
  "Read",
  "readFile",
  "Grep",
  "Glob",
  "globFiles",
  "listDir",
  "searchCode",
  "webFetch",
  "WebSearch",
  "TodoWrite",
  "ListSkills",
  "ReadSkill",
  "EnterPlanMode",
  "ExitPlanMode",
]);

/**
 * Narrows unknown bridge payloads to ChatUiMode; default agent.
 */
export function parseChatUiMode(value: unknown): ChatUiMode {
  if (value === "plain" || value === "agent" || value === "ask") {
    return value;
  }
  return "agent";
}

/**
 * Native tools exposed to the model for the selected UI mode.
 */
export function selectToolsForChatMode(mode: ChatUiMode, allTools: AgentTool[]): AgentTool[] {
  if (mode === "plain") {
    return [];
  }
  if (mode === "agent") {
    return allTools;
  }
  return allTools.filter((tool) => ASK_ALLOWED_TOOL_NAMES.has(tool.name));
}

/**
 * MCP tools: only full agent mode loads MCP (Ask/Plain avoid side effects e custo).
 */
export function mcpToolsForChatMode(mode: ChatUiMode, list: McpTool[]): McpTool[] {
  if (mode === "agent") {
    return list;
  }
  return [];
}
