export * from "./toolTypes";

import { editTool } from "./fileEdit";
import { exploreAgentTool } from "./exploreAgent";
import { globFilesTool, globOpenClaudeTool } from "./globFiles";
import { grepTool } from "./grepTool";
import { listDirTool } from "./listDir";
import { enterPlanModeTool, exitPlanModeTool, planWriteTool } from "./planModeTools";
import { readFileTool, readOpenClaudeTool } from "./readFile";
import { bashTool, runTerminalTool } from "./runTerminal";
import { memoryDeleteTool, memoryListTool, memoryReadTool, memoryWriteTool } from "./memoryTools";
import { searchCodeTool } from "./searchCode";
import { createSkillTool, listSkillsTool, readSkillTool } from "./skillTools";
import { todoWriteTool } from "./todoWrite";
import type { ToolDefinition } from "./toolTypes";
import { webFetchTool } from "./webFetch";
import { webSearchTool } from "./webSearch";
import { writeFileTool, writeOpenClaudeTool } from "./writeFile";

/**
 * Full agent surface kept for the CLI: file ops, search, terminal, plan/todo,
 * skills, memory, web. Multi-agent swarm tools and RAG were removed in the
 * pivot to a CLI-first architecture.
 */
export const toolsRegistry: ToolDefinition<any, unknown>[] = [
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
  planWriteTool,
  exitPlanModeTool,
  webFetchTool,
  webSearchTool,
  memoryListTool,
  memoryReadTool,
  memoryWriteTool,
  memoryDeleteTool,
];
