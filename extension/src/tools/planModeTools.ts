import type { ToolDefinition } from "./toolTypes";
import { getPlanMode, setPlanMode } from "../agent/sessionContext";

/**
 * Enters plan mode: design/explore before coding (OpenClaude-compatible EnterPlanMode).
 */
export const enterPlanModeTool: ToolDefinition<Record<string, unknown>, { message: string }> = {
  name: "EnterPlanMode",
  description:
    "Requests entering plan mode for complex tasks: explore the codebase and design an approach before writing code or running destructive commands.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  async execute(_params) {
    setPlanMode(true);
    return {
      message:
        "Entered plan mode. Focus on exploring the codebase and designing an implementation approach. " +
        "Avoid editing files or running shell commands until you exit plan mode or the user asks you to implement.",
    };
  },
};

/**
 * Exits plan mode (OpenClaude-compatible ExitPlanMode).
 */
export const exitPlanModeTool: ToolDefinition<Record<string, unknown>, { message: string }> = {
  name: "ExitPlanMode",
  description: "Leaves plan mode and returns to normal execution with tools enabled as usual.",
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
        ? "Exited plan mode. You may now implement changes using tools."
        : "Plan mode was already off.",
    };
  },
};
