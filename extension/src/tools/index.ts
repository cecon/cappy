export * from "./toolTypes";

import { agentTool } from "./agentTool";
import { editTool } from "./fileEdit";
import { exploreAgentTool } from "./exploreAgent";
import { globFilesTool, globOpenClaudeTool } from "./globFiles";
import { grepTool } from "./grepTool";
import { listDirTool } from "./listDir";
import { enterPlanModeTool, exitPlanModeTool, planWriteTool } from "./planModeTools";
import { readFileTool, readOpenClaudeTool } from "./readFile";
import { bashTool, runTerminalTool } from "./runTerminal";
import { memoryDeleteTool, memoryListTool, memoryReadTool, memoryWriteTool } from "./memoryTools";
import { ragSearchTool } from "./ragSearchTool";
import { searchCodeTool } from "./searchCode";
import { sendMessageTool } from "./sendMessageTool";
import { createSkillTool, listSkillsTool, readSkillTool } from "./skillTools";
import { teamCreateTool } from "./teamCreateTool";
import { todoWriteTool } from "./todoWrite";
import type { ToolDefinition } from "./toolTypes";
import { webFetchTool } from "./webFetch";
import { webSearchTool } from "./webSearch";
import { writeFileTool, writeOpenClaudeTool } from "./writeFile";
import { gitDiffTool, gitStatusTool } from "./gitTools";

/**
 * Full agent surface: OpenClaude-style names plus ExploreAgent subagent and multiagent tools.
 */
export const toolsRegistry: ToolDefinition<any, unknown>[] = [
  agentTool,
  teamCreateTool,
  sendMessageTool,
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
  ragSearchTool,
  memoryListTool,
  memoryReadTool,
  memoryWriteTool,
  memoryDeleteTool,
  gitStatusTool,
  gitDiffTool,
];
