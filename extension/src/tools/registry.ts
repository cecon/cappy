/**
 * Tool registry — single source of truth for all built-in tools.
 * Exports helpers for name lookup used by the agent loop.
 */

import type { ToolDefinition } from "./ToolDefinition";

// ── Tool imports ───────────────────────────────────────────────────────────
import { editTool } from "./fileEdit";
import { exploreAgentTool } from "./exploreAgent";
import { globFilesTool, globOpenClaudeTool } from "./globFiles";
import { grepTool } from "./grepTool";
import { listDirTool } from "./listDir";
import { enterPlanModeTool, exitPlanModeTool } from "./planModeTools";
import { readFileTool, readOpenClaudeTool } from "./readFile";
import { bashTool, runTerminalTool } from "./runTerminal";
import { searchCodeTool } from "./searchCode";
import { createSkillTool, listSkillsTool, readSkillTool } from "./skillTools";
import { todoWriteTool } from "./todoWrite";
import { webFetchTool } from "./webFetch";
import { webSearchTool } from "./webSearch";
import { writeFileTool, writeOpenClaudeTool } from "./writeFile";
import { ragSearchTool } from "./ragSearchTool";

/** All registered built-in tools. */
export const toolsRegistry: ToolDefinition[] = [
  exploreAgentTool,
  readOpenClaudeTool,
  readFileTool,
  writeOpenClaudeTool,
  writeFileTool,
  editTool,
  globOpenClaudeTool,
  globFilesTool,
  listDirTool,
  bashTool,
  runTerminalTool,
  grepTool,
  searchCodeTool,
  todoWriteTool,
  listSkillsTool,
  readSkillTool,
  createSkillTool,
  enterPlanModeTool,
  exitPlanModeTool,
  webFetchTool,
  webSearchTool,
  ragSearchTool,
];

/** Exact-name lookup map. */
const byName = new Map<string, ToolDefinition>(toolsRegistry.map((t) => [t.name, t]));

/** Case-insensitive fallback map. */
const byLowerName = new Map<string, ToolDefinition>(toolsRegistry.map((t) => [t.name.toLowerCase(), t]));

export function findTool(name: string): ToolDefinition | undefined {
  return byName.get(name) ?? byLowerName.get(name.toLowerCase());
}

/** Returns tools allowed for Ask mode (readOnly = true). */
export function askModeTools(): ToolDefinition[] {
  return toolsRegistry.filter((t) => t.readOnly);
}
