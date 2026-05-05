import type { FileDiffPayload } from "../utils/fileDiffPayload";
import type { SessionMetadata } from "../session/sessionTypes";

export const HOOK_PROTOCOL_VERSION = 1 as const;

export type HookTrigger = "session_start" | "before_edit" | "step_complete" | "session_stop";

export const BLOCKING_TRIGGERS: ReadonlySet<HookTrigger> = new Set<HookTrigger>(["before_edit"]);

export const FILE_MUTATING_TOOL_NAMES: ReadonlySet<string> = new Set([
  "Edit",
  "edit",
  "writeFile",
  "Write",
]);

export interface HookToolCallPayload {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface HookToolResultPayload {
  toolCallId: string;
  output: string;
  fileDiff?: FileDiffPayload;
}

export interface HookInput {
  v: typeof HOOK_PROTOCOL_VERSION;
  trigger: HookTrigger;
  hookName: string;
  sessionId: string;
  workspaceRoot: string | null;
  cwd: string;
  toolCall?: HookToolCallPayload;
  toolResult?: HookToolResultPayload;
  session?: SessionMetadata;
}

export type HookDecision = "allow" | "block";

export interface HookOutput {
  v: typeof HOOK_PROTOCOL_VERSION;
  decision?: HookDecision;
  message?: string;
  systemNotice?: string;
}

/**
 * One discovered hook on disk.
 */
export interface HookSpec {
  /** Directory name (kebab-case). */
  hookName: string;
  trigger: HookTrigger;
  /** Absolute path to the hook source. */
  sourcePath: string;
  /** "workspace" beats "global" when same hookName+trigger collide. */
  scope: "workspace" | "global";
  /** True when only an .md exists; the hook is treated as advisory documentation. */
  advisoryOnly: boolean;
}

export interface HookRunResult {
  hookName: string;
  trigger: HookTrigger;
  outcome: "ok" | "blocked" | "error";
  durationMs: number;
  decision?: HookDecision;
  message?: string;
  systemNotice?: string;
}

export interface AggregateHookResult {
  /** Final decision after running every hook for the trigger in order. */
  decision: HookDecision;
  /** First blocking hook's message, if any. */
  blockingMessage?: string;
  perHook: HookRunResult[];
}
