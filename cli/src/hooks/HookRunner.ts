import { spawn } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { transform as esbuildTransform } from "esbuild";

import { HOOK_RUNNER_SCRIPT } from "./hookRunnerScript";
import {
  AggregateHookResult,
  BLOCKING_TRIGGERS,
  HOOK_PROTOCOL_VERSION,
  HookInput,
  HookOutput,
  HookRunResult,
  HookSpec,
  HookTrigger,
} from "./hookTypes";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CACHE_DIR = path.join(os.homedir(), ".cappy", "cache", "hooks");

export interface HookRunnerOptions {
  /** Wall-clock timeout for a single hook execution, in ms. */
  timeoutMs?: number;
  /** Directory where compiled .js files are cached by content hash. */
  cacheDir?: string;
  /** Path to the node binary. Defaults to `process.execPath`. */
  nodeBinary?: string;
  /** Optional callback invoked once per hook execution (for logging/telemetry). */
  onResult?: (result: HookRunResult) => void;
}

export interface RunHookContext {
  trigger: HookTrigger;
  sessionId: string;
  workspaceRoot: string | null;
  cwd: string;
  toolCall?: HookInput["toolCall"];
  toolResult?: HookInput["toolResult"];
  session?: HookInput["session"];
}

/**
 * Compiles `.ts` hooks on demand, executes them in a Node subprocess with stdin/stdout JSON,
 * and aggregates their decisions across multiple registered hooks for the same trigger.
 */
export class HookRunner {
  private readonly timeoutMs: number;
  private readonly cacheDir: string;
  private readonly nodeBinary: string;
  private readonly onResult: ((r: HookRunResult) => void) | undefined;

  public constructor(opts: HookRunnerOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR;
    this.nodeBinary = opts.nodeBinary ?? process.execPath;
    this.onResult = opts.onResult;
  }

  /**
   * Execute every hook registered for a trigger, in order. The first `block`
   * short-circuits the rest. Advisory-only hooks are skipped silently.
   */
  public async runAll(specs: HookSpec[], ctx: RunHookContext): Promise<AggregateHookResult> {
    const perHook: HookRunResult[] = [];
    let decision: "allow" | "block" = "allow";
    let blockingMessage: string | undefined;

    for (const spec of specs) {
      if (spec.advisoryOnly) {
        continue;
      }
      const result = await this.runOne(spec, ctx);
      perHook.push(result);
      this.onResult?.(result);
      if (result.outcome === "blocked" || (result.outcome === "error" && BLOCKING_TRIGGERS.has(ctx.trigger))) {
        decision = "block";
        blockingMessage = result.message ?? "blocked by hook";
        break;
      }
    }

    return blockingMessage !== undefined
      ? { decision, blockingMessage, perHook }
      : { decision, perHook };
  }

  /** Execute a single hook; `error` outcomes for non-blocking triggers are advisory. */
  public async runOne(spec: HookSpec, ctx: RunHookContext): Promise<HookRunResult> {
    const startedAt = Date.now();
    try {
      const compiled = await this.compileIfNeeded(spec.sourcePath);
      const input: HookInput = buildInput(spec, ctx);
      const output = await this.invoke(compiled, input);
      const durationMs = Date.now() - startedAt;
      return interpretOutput(spec, ctx.trigger, output, durationMs);
    } catch (err: unknown) {
      const durationMs = Date.now() - startedAt;
      const isBlocking = BLOCKING_TRIGGERS.has(ctx.trigger);
      const message = errorMessage(err);
      const partial = {
        hookName: spec.hookName,
        trigger: ctx.trigger,
        durationMs,
        decision: isBlocking ? ("block" as const) : ("allow" as const),
      };
      return isBlocking
        ? { ...partial, outcome: "blocked", message }
        : { ...partial, outcome: "error", message };
    }
  }

  private async compileIfNeeded(sourcePath: string): Promise<string> {
    const source = await fs.readFile(sourcePath, "utf-8");
    const hash = crypto.createHash("sha256").update(sourcePath).update("\0").update(source).digest("hex").slice(0, 32);
    const compiledPath = path.join(this.cacheDir, `${hash}.js`);
    try {
      await fs.access(compiledPath);
      return compiledPath;
    } catch {
      // Falls through to compile.
    }
    const result = await esbuildTransform(source, {
      loader: "ts",
      format: "cjs",
      platform: "node",
      target: "node18",
      sourcefile: sourcePath,
    });
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(compiledPath, result.code, "utf-8");
    return compiledPath;
  }

  private async getRunnerScriptPath(): Promise<string> {
    const runnerPath = path.join(this.cacheDir, "runner.js");
    try {
      await fs.access(runnerPath);
      return runnerPath;
    } catch {
      // fallthrough: write it.
    }
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(runnerPath, HOOK_RUNNER_SCRIPT, "utf-8");
    return runnerPath;
  }

  private async invoke(compiledPath: string, input: HookInput): Promise<HookOutput> {
    const runnerPath = await this.getRunnerScriptPath();
    return new Promise<HookOutput>((resolve, reject) => {
      const child = spawn(this.nodeBinary, [runnerPath, compiledPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: sanitizedEnv(input),
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, this.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf-8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new Error(`hook timed out after ${this.timeoutMs}ms`));
          return;
        }
        if (code !== 0) {
          const tail = stderr.trim().split(/\r?\n/).pop() ?? `exit ${code ?? "unknown"}`;
          reject(new Error(tail || `hook exited with code ${code ?? "unknown"}`));
          return;
        }
        try {
          resolve(parseLastJsonLine(stdout));
        } catch (parseErr) {
          reject(parseErr);
        }
      });

      try {
        child.stdin.end(JSON.stringify(input));
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }
}

function buildInput(spec: HookSpec, ctx: RunHookContext): HookInput {
  const base: HookInput = {
    v: HOOK_PROTOCOL_VERSION,
    trigger: ctx.trigger,
    hookName: spec.hookName,
    sessionId: ctx.sessionId,
    workspaceRoot: ctx.workspaceRoot,
    cwd: ctx.cwd,
  };
  if (ctx.toolCall) {
    base.toolCall = ctx.toolCall;
  }
  if (ctx.toolResult) {
    base.toolResult = ctx.toolResult;
  }
  if (ctx.session) {
    base.session = ctx.session;
  }
  return base;
}

function interpretOutput(
  spec: HookSpec,
  trigger: HookTrigger,
  output: HookOutput,
  durationMs: number,
): HookRunResult {
  const decision: "allow" | "block" = output.decision === "block" ? "block" : "allow";
  const outcome: HookRunResult["outcome"] = decision === "block" ? "blocked" : "ok";
  const result: HookRunResult = {
    hookName: spec.hookName,
    trigger,
    outcome,
    durationMs,
    decision,
  };
  if (output.message !== undefined) {
    result.message = output.message;
  }
  if (output.systemNotice !== undefined) {
    result.systemNotice = output.systemNotice;
  }
  return result;
}

function parseLastJsonLine(stdout: string): HookOutput {
  const lines = stdout.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = lines[i]?.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as HookOutput;
      return parsed;
    } catch {
      // Try previous line.
    }
  }
  throw new Error("hook produced no JSON on stdout");
}

function sanitizedEnv(input: HookInput): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    CAPPY_SESSION_ID: input.sessionId,
    CAPPY_HOOK_TRIGGER: input.trigger,
    CAPPY_HOOK_NAME: input.hookName,
  };
  if (input.workspaceRoot) {
    env.CAPPY_WORKSPACE_ROOT = input.workspaceRoot;
  }
  return env;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

