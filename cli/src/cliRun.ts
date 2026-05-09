import { AgentLoop } from "../../extension/src/agent/loop.js";
import { toolsRegistry } from "../../extension/src/tools/index.js";
import { CliRenderer } from "./CliRenderer.js";
import { CliHitl } from "./CliHitl.js";

export type ChatMode = "agent" | "ask" | "plain";

export const DESTRUCTIVE_TOOL_NAMES = new Set([
  "writeFile", "Write", "runTerminal", "Bash", "Edit",
  "MemoryWrite", "MemoryDelete",
  "TodoWrite", "EnterPlanMode", "ExitPlanMode",
]);

export function filterToolsByMode(
  tools: typeof toolsRegistry,
  mode: ChatMode,
): typeof toolsRegistry {
  if (mode === "plain") return [];
  if (mode === "ask") return tools.filter((t) => !DESTRUCTIVE_TOOL_NAMES.has(t.name));
  return tools;
}

export type Message = { role: "user" | "assistant" | "tool"; content: string };

export interface RunOnceOptions {
  loop: AgentLoop;
  renderer: CliRenderer;
  hitl: CliHitl;
  history: Message[];
  userPrompt: string;
  mode: ChatMode;
  maxIterations: number | undefined;
  systemPromptPrefix?: string;
}

export async function runOnce(opts: RunOnceOptions): Promise<void> {
  const { loop, renderer, hitl, history, userPrompt, mode, maxIterations } = opts;

  history.push({ role: "user", content: userPrompt });

  loop.on("stream:token", (token) => renderer.onToken(token));
  loop.on("stream:done", () => renderer.onDone());
  loop.on("stream:system", (msg) => renderer.onSystemMessage(msg));
  loop.on("context:usage", (payload) =>
    renderer.onContextUsage(payload.usedTokens, payload.limitTokens, payload.didTrimForApi),
  );
  loop.on("tool:executing", (tc) => renderer.onToolExecuting(tc.name, tc.arguments));
  loop.on("tool:result", (tc, result) => renderer.onToolResult(tc.name, result));
  loop.on("tool:rejected", (tc) => renderer.onToolRejected(tc.name));
  loop.on("error", (err) => renderer.onError(err));
  loop.on("tool:confirm", async (tc) => {
    const approved = await hitl.confirm(tc.name, tc.arguments);
    if (approved) loop.approve(tc.id);
    else loop.reject(tc.id);
  });

  renderer.startThinking();

  const tools = filterToolsByMode(toolsRegistry, mode);

  try {
    const updated = await loop.run(history as Parameters<typeof loop.run>[0], tools, {
      chatMode: mode,
      maxLlmRounds: maxIterations,
      systemPromptPrefix: opts.systemPromptPrefix,
    });
    history.length = 0;
    history.push(...(updated as Message[]));
  } catch (err) {
    renderer.onError(err instanceof Error ? err : new Error(String(err)));
  }

  loop.removeAllListeners();
}
