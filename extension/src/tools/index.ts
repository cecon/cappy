export * from "./toolTypes";

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
import type { ToolDefinition } from "./toolTypes";
import { webFetchTool } from "./webFetch";
import { webSearchTool } from "./webSearch";
import { writeFileTool, writeOpenClaudeTool } from "./writeFile";

/**
 * Full agent surface: OpenClaude-style names plus ExploreAgent subagent.
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
  exitPlanModeTool,
  webFetchTool,
  webSearchTool,
];
