import { EventEmitter } from "node:events";

import { AgentLoop } from "./loop";
import type { AgentTool, Message, PipelineDefinition, PipelineStage } from "./types";
import type { McpTool } from "../mcp/client";
import type { FileDiffPayload } from "../utils/fileDiffPayload";
import type { ContextUsagePayload } from "./contextBudget";
import type { PlanStatePayload, ToolCall } from "./types";

export interface PipelineRunOptions {
  tools: AgentTool[];
  mcpTools?: McpTool[];
  workspaceRoot?: string;
  onMcpCall?: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<string>;
}

export interface PipelineRunnerEvents {
  "pipeline:start": (pipeline: PipelineDefinition) => void;
  "pipeline:stage:start": (stage: PipelineStage, index: number, total: number) => void;
  "pipeline:stage:done": (stage: PipelineStage, index: number, total: number) => void;
  "pipeline:stage:approve": (stage: PipelineStage, index: number) => void;
  "pipeline:done": (messages: Message[]) => void;
  // Forwarded from the active AgentLoop
  "stream:token": (token: string) => void;
  "stream:done": () => void;
  "stream:system": (message: string) => void;
  "context:usage": (payload: ContextUsagePayload) => void;
  "tool:confirm": (toolCall: ToolCall) => void;
  "tool:executing": (toolCall: ToolCall) => void;
  "tool:result": (toolCall: ToolCall, result: string, fileDiff?: FileDiffPayload) => void;
  "tool:rejected": (toolCall: ToolCall) => void;
  "plan:state": (payload: PlanStatePayload) => void;
  error: (err: Error) => void;
}

const FORWARDED_LOOP_EVENTS = [
  "stream:token",
  "stream:done",
  "stream:system",
  "context:usage",
  "tool:confirm",
  "tool:executing",
  "tool:result",
  "tool:rejected",
  "plan:state",
  "error",
] as const;

/**
 * Predefined pipeline templates available to all workspaces.
 * Stages filter the tool set and inject stage-specific system prompt suffixes.
 */
export const BUILT_IN_PIPELINES: PipelineDefinition[] = [
  {
    id: "feature",
    name: "Feature Pipeline",
    stages: [
      {
        id: "research",
        name: "Research",
        blockedTools: ["writeFile", "Write", "Edit", "Bash", "runTerminal", "MemoryWrite", "MemoryDelete"],
        systemPromptSuffix:
          "PIPELINE STAGE 1/4 — Research. Explore the codebase, read relevant files, and understand the context. " +
          "Do NOT write or modify any files during this stage.",
      },
      {
        id: "plan",
        name: "Plan",
        blockedTools: ["writeFile", "Write", "Edit", "Bash", "runTerminal"],
        systemPromptSuffix:
          "PIPELINE STAGE 2/4 — Planning. Create a detailed, step-by-step implementation plan using PlanWrite and TodoWrite. " +
          "Do NOT write production code yet. The plan will be reviewed before implementation begins.",
        requiresApproval: true,
      },
      {
        id: "implement",
        name: "Implement",
        systemPromptSuffix:
          "PIPELINE STAGE 3/4 — Implementation. Follow the plan from the previous stage precisely. " +
          "Make all required file changes, staying faithful to the agreed plan.",
      },
      {
        id: "verify",
        name: "Verify",
        allowedTools: ["Bash", "runTerminal", "Read", "readFile", "Grep", "Glob", "globFiles", "ListDir", "listDir"],
        systemPromptSuffix:
          "PIPELINE STAGE 4/4 — Verification. Run tests and linting, check for errors, and confirm the implementation is correct.",
        requiresApproval: true,
      },
    ],
  },
  {
    id: "review",
    name: "Review Pipeline",
    stages: [
      {
        id: "analyze",
        name: "Analyze",
        blockedTools: ["writeFile", "Write", "Edit", "Bash", "runTerminal", "MemoryWrite", "MemoryDelete"],
        systemPromptSuffix:
          "PIPELINE STAGE 1/2 — Analysis. Read all relevant code and identify bugs, issues, and improvement opportunities. " +
          "Do not modify anything yet.",
      },
      {
        id: "report",
        name: "Report",
        blockedTools: ["Bash", "runTerminal"],
        systemPromptSuffix:
          "PIPELINE STAGE 2/2 — Report. Summarize all findings, suggest concrete fixes, and document what should be addressed.",
      },
    ],
  },
];

/**
 * Orchestrates multiple AgentLoop runs in sequence, one per pipeline stage.
 * Events from the active inner loop are forwarded to listeners of this runner.
 */
export class PipelineRunner extends EventEmitter {
  private currentLoop: AgentLoop | null = null;
  private pendingAdvance: (() => void) | null = null;
  private aborted = false;

  public override on<K extends keyof PipelineRunnerEvents>(
    eventName: K,
    listener: PipelineRunnerEvents[K],
  ): this {
    return super.on(eventName, listener as (...args: unknown[]) => void);
  }

  public override off<K extends keyof PipelineRunnerEvents>(
    eventName: K,
    listener: PipelineRunnerEvents[K],
  ): this {
    return super.off(eventName, listener as (...args: unknown[]) => void);
  }

  /** Approves a pending HITL tool call in the currently active stage loop. */
  public approve(toolCallId: string): boolean {
    return this.currentLoop?.approve(toolCallId) ?? false;
  }

  /** Rejects a pending HITL tool call in the currently active stage loop. */
  public reject(toolCallId: string): boolean {
    return this.currentLoop?.reject(toolCallId) ?? false;
  }

  public approveSessionAutoDestructive(toolCallId: string): boolean {
    return this.currentLoop?.approveSessionAutoDestructive(toolCallId) ?? false;
  }

  public async persistAllowAllDestructive(toolCallId: string): Promise<boolean> {
    return this.currentLoop?.persistAllowAllDestructive(toolCallId) ?? false;
  }

  /** Advances from the current stage to the next when requiresApproval is true. */
  public advance(): void {
    if (this.pendingAdvance) {
      const fn = this.pendingAdvance;
      this.pendingAdvance = null;
      fn();
    }
  }

  /** Aborts the running pipeline and the active stage loop. */
  public abort(): void {
    this.aborted = true;
    this.currentLoop?.abort();
    if (this.pendingAdvance) {
      const fn = this.pendingAdvance;
      this.pendingAdvance = null;
      fn();
    }
  }

  /**
   * Runs the pipeline end-to-end.
   * Returns the full conversation history (all stages accumulated).
   */
  public async run(
    pipeline: PipelineDefinition,
    initialMessages: Message[],
    options: PipelineRunOptions,
  ): Promise<Message[]> {
    this.aborted = false;
    this.emit("pipeline:start", pipeline);

    let messages = [...initialMessages];

    for (let i = 0; i < pipeline.stages.length; i++) {
      if (this.aborted) break;

      const stage = pipeline.stages[i];
      if (!stage) break;

      this.emit("pipeline:stage:start", stage, i, pipeline.stages.length);

      const stageTools = filterToolsForStage(options.tools, stage);

      const loopOptions: { workspaceRoot?: string; onMcpCall?: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<string> } = {};
      if (options.workspaceRoot !== undefined) loopOptions.workspaceRoot = options.workspaceRoot;
      if (options.onMcpCall !== undefined) loopOptions.onMcpCall = options.onMcpCall;

      const loop = new AgentLoop(loopOptions);
      this.currentLoop = loop;

      const listeners: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];
      for (const event of FORWARDED_LOOP_EVENTS) {
        const listener = (...args: unknown[]): void => {
          this.emit(event, ...args);
        };
        loop.on(event, listener);
        listeners.push({ event, listener });
      }

      const runOpts: { systemPromptPrefix?: string; maxLlmRounds?: number; mcpTools?: import("../mcp/client").McpTool[] } = {};
      if (stage.systemPromptSuffix !== undefined) runOpts.systemPromptPrefix = stage.systemPromptSuffix;
      if (stage.maxIterations !== undefined) runOpts.maxLlmRounds = stage.maxIterations;
      if (options.mcpTools !== undefined) runOpts.mcpTools = options.mcpTools;

      try {
        messages = await loop.run(messages, stageTools, runOpts);
      } finally {
        for (const { event, listener } of listeners) {
          loop.off(event, listener);
        }
      }

      this.emit("pipeline:stage:done", stage, i, pipeline.stages.length);

      if (stage.requiresApproval && i < pipeline.stages.length - 1 && !this.aborted) {
        this.emit("pipeline:stage:approve", stage, i);
        await new Promise<void>((resolve) => {
          this.pendingAdvance = resolve;
        });
      }
    }

    this.currentLoop = null;
    if (!this.aborted) {
      this.emit("pipeline:done", messages);
    }
    return messages;
  }
}

function filterToolsForStage(tools: AgentTool[], stage: PipelineStage): AgentTool[] {
  if (stage.allowedTools && stage.allowedTools.length > 0) {
    const allowed = new Set(stage.allowedTools);
    return tools.filter((t) => allowed.has(t.name));
  }
  if (stage.blockedTools && stage.blockedTools.length > 0) {
    const blocked = new Set(stage.blockedTools);
    return tools.filter((t) => !blocked.has(t.name));
  }
  return tools;
}
