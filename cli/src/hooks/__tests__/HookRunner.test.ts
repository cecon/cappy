import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { HookRunner } from "../HookRunner";
import type { HookSpec } from "../hookTypes";

let tmp: string;
let cacheDir: string;
let runner: HookRunner;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cappy-hookrun-"));
  cacheDir = path.join(tmp, "cache");
  runner = new HookRunner({ cacheDir, timeoutMs: 5_000 });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writeTsHook(name: string, body: string): Promise<HookSpec> {
  const dir = path.join(tmp, "hooks", name);
  await fs.mkdir(dir, { recursive: true });
  const sourcePath = path.join(dir, "before_edit.ts");
  await fs.writeFile(sourcePath, body, "utf-8");
  return {
    hookName: name,
    trigger: "before_edit",
    sourcePath,
    scope: "workspace",
    advisoryOnly: false,
  };
}

const baseCtx = {
  trigger: "before_edit" as const,
  sessionId: "test-session",
  workspaceRoot: null,
  cwd: process.cwd(),
};

describe("HookRunner — execution", () => {
  it("retorna decision allow para hook que retorna allow", async () => {
    const spec = await writeTsHook(
      "allowing",
      `export default async (input: any) => ({ v: 1, decision: "allow", message: "ok-" + input.sessionId });`,
    );
    const result = await runner.runOne(spec, baseCtx);
    expect(result.outcome).toBe("ok");
    expect(result.decision).toBe("allow");
    expect(result.message).toBe("ok-test-session");
  });

  it("retorna decision block quando hook retorna block", async () => {
    const spec = await writeTsHook(
      "denying",
      `export default async () => ({ v: 1, decision: "block", message: "nope" });`,
    );
    const result = await runner.runOne(spec, baseCtx);
    expect(result.outcome).toBe("blocked");
    expect(result.decision).toBe("block");
    expect(result.message).toBe("nope");
  });

  it("trata exit code != 0 como block em gatilho bloqueante", async () => {
    const spec = await writeTsHook(
      "throwing",
      `export default async () => { throw new Error("boom"); };`,
    );
    const result = await runner.runOne(spec, baseCtx);
    expect(result.outcome).toBe("blocked");
    expect(result.message).toContain("boom");
  });

  it("trata exit != 0 como error advisório em gatilho não-bloqueante", async () => {
    const spec = await writeTsHook(
      "throwing-step",
      `export default async () => { throw new Error("oops"); };`,
    );
    spec.trigger = "step_complete";
    const result = await runner.runOne(spec, { ...baseCtx, trigger: "step_complete" });
    expect(result.outcome).toBe("error");
    expect(result.decision).toBe("allow");
  });

  it("recebe input com toolCall e dados de sessão", async () => {
    const spec = await writeTsHook(
      "echo",
      `export default async (input: any) => ({
        v: 1,
        decision: "allow",
        message: input.toolCall.name + ":" + input.toolCall.arguments.path
      });`,
    );
    const result = await runner.runOne(spec, {
      ...baseCtx,
      toolCall: { id: "t1", name: "Edit", arguments: { path: "src/foo.ts" } },
    });
    expect(result.outcome).toBe("ok");
    expect(result.message).toBe("Edit:src/foo.ts");
  });

  it("usa cache do .js compilado em chamadas sucessivas", async () => {
    const spec = await writeTsHook(
      "cached",
      `export default async () => ({ v: 1, decision: "allow" });`,
    );
    const r1 = await runner.runOne(spec, baseCtx);
    const r2 = await runner.runOne(spec, baseCtx);
    expect(r1.outcome).toBe("ok");
    expect(r2.outcome).toBe("ok");
    const files = await fs.readdir(cacheDir);
    const compiled = files.filter((f) => f.endsWith(".js") && f !== "runner.js");
    expect(compiled).toHaveLength(1);
  });
});

describe("HookRunner — runAll", () => {
  it("executa em ordem e curto-circuita no primeiro block", async () => {
    const order: string[] = [];
    const a = await writeTsHook(
      "alpha",
      `export default async () => ({ v: 1, decision: "allow", systemNotice: "alpha-ran" });`,
    );
    const b = await writeTsHook(
      "bravo",
      `export default async () => ({ v: 1, decision: "block", message: "stop" });`,
    );
    const c = await writeTsHook(
      "charlie",
      `export default async () => ({ v: 1, decision: "allow" });`,
    );

    const r = await new HookRunner({
      cacheDir,
      timeoutMs: 5_000,
      onResult: (res) => order.push(res.hookName),
    }).runAll([a, b, c], baseCtx);

    expect(r.decision).toBe("block");
    expect(r.blockingMessage).toBe("stop");
    expect(order).toEqual(["alpha", "bravo"]);
    expect(r.perHook).toHaveLength(2);
  });

  it("ignora advisoryOnly", async () => {
    const a = await writeTsHook(
      "alpha",
      `export default async () => ({ v: 1, decision: "allow" });`,
    );
    const advisory: HookSpec = {
      hookName: "doc",
      trigger: "before_edit",
      sourcePath: "/dev/null",
      scope: "global",
      advisoryOnly: true,
    };
    const r = await runner.runAll([advisory, a], baseCtx);
    expect(r.perHook.map((p) => p.hookName)).toEqual(["alpha"]);
  });
});

describe("HookRunner — timeout", () => {
  it("mata hook que ultrapassa o timeout e bloqueia em before_edit", async () => {
    const spec = await writeTsHook(
      "slow",
      `export default async () => { await new Promise((r) => setTimeout(r, 5000)); return { v: 1, decision: "allow" }; };`,
    );
    const fast = new HookRunner({ cacheDir, timeoutMs: 200 });
    const result = await fast.runOne(spec, baseCtx);
    expect(result.outcome).toBe("blocked");
    expect(result.message?.toLowerCase()).toContain("timed out");
  });
});
