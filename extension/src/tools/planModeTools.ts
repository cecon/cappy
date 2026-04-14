import * as path from "node:path";
import type { ToolDefinition } from "./toolTypes";
import {
  getPlanContent,
  getPlanFilePath,
  getPlanMode,
  getSessionId,
  getSessionPlanPath,
  initSessionPlanFile,
  setPlanMode,
  writeSessionPlan,
} from "../agent/sessionContext";

/**
 * Enters plan mode: design/explore before coding (OpenClaude-compatible EnterPlanMode).
 * Also initialises the session plan file at ~/.cappy/sessions/<id>/plan.md.
 */
export const enterPlanModeTool: ToolDefinition<Record<string, unknown>, { message: string; planFilePath: string }> = {
  name: "EnterPlanMode",
  description:
    "Requests entering plan mode for complex tasks: explore the codebase and design an approach before writing code or running destructive commands. " +
    "Creates a plan file at ~/.cappy/sessions/<session-id>/plan.md to record the plan. " +
    "Use PlanWrite to write the plan content progressively.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  async execute(_params) {
    setPlanMode(true);
    const planFilePath = await initSessionPlanFile();
    return {
      message:
        "Entered plan mode. Focus on exploring the codebase and designing an implementation approach. " +
        `Plan file initialised at: ${planFilePath}. ` +
        "Use PlanWrite to record the plan. " +
        "Avoid editing files or running shell commands until you call ExitPlanMode.",
      planFilePath,
    };
  },
};

/**
 * Writes or updates the session plan file (plan mode-specific write tool).
 * Saves markdown content to ~/.cappy/sessions/<id>/plan.md and notifies the UI.
 */
export const planWriteTool: ToolDefinition<{ content: string }, { message: string; path: string }> = {
  name: "PlanWrite",
  description:
    "Writes or updates the session plan file (~/.cappy/sessions/<id>/plan.md). " +
    "Use this during plan mode to record and progressively refine the implementation plan in markdown. " +
    "The plan panel in the UI will update immediately.",
  parameters: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "Full markdown content of the plan (replaces previous content).",
      },
    },
    required: ["content"],
    additionalProperties: false,
  },
  async execute(params) {
    const { content } = params;
    const filePath = await writeSessionPlan(content);
    return {
      message: `Plan written to ${filePath}`,
      path: filePath,
    };
  },
};

/**
 * Exits plan mode (OpenClaude-compatible ExitPlanMode).
 */
export const exitPlanModeTool: ToolDefinition<Record<string, unknown>, { message: string }> = {
  name: "ExitPlanMode",
  description: "Leaves plan mode and returns to normal execution with all tools enabled. The plan panel will remain visible for reference.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  async execute(_params) {
    const wasPlan = getPlanMode();
    setPlanMode(false);
    return {
      message: wasPlan
        ? "Exited plan mode. You may now implement changes using all tools."
        : "Plan mode was already off.",
    };
  },
};
