import * as readline from "node:readline";

import { AgentLoop } from "../../extension/src/agent/loop.js";
import { toolsRegistry } from "../../extension/src/tools/index.js";
import { PipelineRunner, BUILT_IN_PIPELINES } from "../../extension/src/agent/PipelineRunner.js";
import { CliRenderer } from "./CliRenderer.js";
import { CliHitl, type HitlPolicy } from "./CliHitl.js";
import { c, BOLD, CYAN, GRAY, GREEN, RED, YELLOW } from "./cliColors.js";

export { BUILT_IN_PIPELINES };

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

// ─── runOnce ─────────────────────────────────────────────────────────────────

export type Message = { role: "user" | "assistant" | "tool"; content: string };

export interface RunOnceOptions {
  loop: AgentLoop;
  renderer: CliRenderer;
  hitl: CliHitl;
  history: Message[];
  userPrompt: string;
  mode: ChatMode;
  maxIterations: number | undefined;
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
    });
    history.length = 0;
    history.push(...(updated as Message[]));
  } catch (err) {
    renderer.onError(err instanceof Error ? err : new Error(String(err)));
  }

  loop.removeAllListeners();
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function runCliPipeline(opts: {
  pipelineId: string;
  userPrompt: string;
  workspaceRoot: string;
  hitlPolicy: HitlPolicy;
  maxIterations?: number;
  verbose: boolean;
}): Promise<void> {
  const { pipelineId, userPrompt, workspaceRoot, hitlPolicy, maxIterations, verbose } = opts;

  const pipeline = BUILT_IN_PIPELINES.find((p) => p.id === pipelineId);
  if (!pipeline) {
    const ids = BUILT_IN_PIPELINES.map((p) => `${c(CYAN, p.id)} (${p.stages.length} stages)`).join(", ");
    process.stderr.write(`${c(RED, "✗")} Pipeline desconhecido: "${pipelineId}". Disponíveis: ${ids}\n`);
    process.exit(1);
  }

  const renderer = new CliRenderer(verbose);
  const hitl = new CliHitl(hitlPolicy);
  const runner = new PipelineRunner();

  // Forward agent events to renderer
  runner.on("stream:token", (token) => renderer.onToken(token));
  runner.on("stream:done", () => renderer.onDone());
  runner.on("stream:system", (msg) => renderer.onSystemMessage(msg));
  runner.on("context:usage", (payload) =>
    renderer.onContextUsage(payload.usedTokens, payload.limitTokens, payload.didTrimForApi),
  );
  runner.on("tool:executing", (tc) => renderer.onToolExecuting(tc.name, tc.arguments));
  runner.on("tool:result", (tc, result) => renderer.onToolResult(tc.name, result));
  runner.on("tool:rejected", (tc) => renderer.onToolRejected(tc.name));
  runner.on("error", (err) => renderer.onError(err));
  runner.on("tool:confirm", async (tc) => {
    const approved = await hitl.confirm(tc.name, tc.arguments);
    if (approved) runner.approve(tc.id);
    else runner.reject(tc.id);
  });

  // Stage progress
  runner.on("pipeline:start", (p) => {
    process.stderr.write(`\n${c(BOLD + CYAN, `◆ ${p.name}`)} ${c(GRAY, `(${p.stages.length} stages)`)}\n`);
  });

  runner.on("pipeline:stage:start", (stage, index, total) => {
    process.stderr.write(
      `\n${c(CYAN, "▶")} ${c(BOLD, `Stage ${index + 1}/${total}`)} — ${stage.name}\n${c(GRAY, "─".repeat(44))}\n`,
    );
    renderer.startThinking();
  });

  runner.on("pipeline:stage:done", (stage, index, total) => {
    process.stderr.write(`${c(GRAY, "─".repeat(44))}\n${c(GREEN, "✓")} Stage ${index + 1}/${total} — ${stage.name}\n`);
  });

  // Approval gate: pause until user confirms
  runner.on("pipeline:stage:approve", async (stage, index) => {
    const next = pipeline.stages[index + 1];
    const nextName = next ? `"${next.name}"` : "finalizar";
    process.stderr.write(
      `\n${c(YELLOW, "⏸")}  Revisar output acima antes de avançar para ${nextName}.\n`,
    );
    const answer = await askLine("   Continuar? [s/N]: ");
    if (answer.trim().toLowerCase() === "s" || answer.trim().toLowerCase() === "sim") {
      runner.advance();
    } else {
      process.stderr.write(c(YELLOW, "   Pipeline abortado.\n"));
      runner.abort();
    }
  });

  runner.on("pipeline:done", () => {
    process.stderr.write(`\n${c(GREEN + BOLD, "✓ Pipeline concluído.")}\n`);
  });

  const sigintHandler = (): void => {
    process.stderr.write(c(YELLOW, "\n⚠  Abortando pipeline...") + "\n");
    runner.abort();
  };
  process.on("SIGINT", sigintHandler);

  const pipelineDef = maxIterations !== undefined
    ? { ...pipeline, stages: pipeline.stages.map((s) => ({ ...s, maxIterations })) }
    : pipeline;

  try {
    await runner.run(pipelineDef, [{ role: "user", content: userPrompt }], {
      tools: toolsRegistry,
      workspaceRoot,
    });
  } finally {
    process.off("SIGINT", sigintHandler);
  }
}

function askLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    rl.question(prompt, (answer) => { rl.close(); resolve(answer); });
  });
}
