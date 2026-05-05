import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { HookRegistry } from "../HookRegistry";

let tmp: string;
let global: string;
let workspace: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cappy-hooks-"));
  global = path.join(tmp, "global");
  workspace = path.join(tmp, "workspace");
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writeHook(root: string, name: string, file: string, content: string): Promise<void> {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, file), content, "utf-8");
}

describe("HookRegistry — discovery", () => {
  it("retorna vazio quando nenhuma raiz existe", async () => {
    const reg = new HookRegistry({ workspace, global });
    await reg.scan();
    expect(reg.allSpecs()).toEqual([]);
    expect(reg.hasAny("before_edit")).toBe(false);
  });

  it("descobre hook com .ts em raiz global", async () => {
    await writeHook(global, "no-secrets", "before_edit.ts", "export default async () => ({v:1});");
    const reg = new HookRegistry({ workspace: null, global });
    await reg.scan();
    const specs = reg.forTrigger("before_edit");
    expect(specs).toHaveLength(1);
    expect(specs[0]?.hookName).toBe("no-secrets");
    expect(specs[0]?.scope).toBe("global");
    expect(specs[0]?.advisoryOnly).toBe(false);
  });

  it("trata .md sem .ts como advisoryOnly", async () => {
    await writeHook(global, "doc-only", "before_edit.md", "# doc");
    const reg = new HookRegistry({ workspace: null, global });
    await reg.scan();
    const specs = reg.forTrigger("before_edit");
    expect(specs).toHaveLength(1);
    expect(specs[0]?.advisoryOnly).toBe(true);
  });

  it("workspace tem precedência sobre global no mesmo (nome,trigger)", async () => {
    await writeHook(global, "audit", "before_edit.ts", "export default async () => ({v:1});");
    await writeHook(workspace, "audit", "before_edit.ts", "export default async () => ({v:1, message:'ws'});");

    const reg = new HookRegistry({ workspace, global });
    await reg.scan();
    const specs = reg.forTrigger("before_edit");
    expect(specs).toHaveLength(1);
    expect(specs[0]?.scope).toBe("workspace");
  });

  it("ordena hooks alfabeticamente por nome", async () => {
    await writeHook(global, "zeta", "step_complete.ts", "export default async () => ({v:1});");
    await writeHook(global, "alpha", "step_complete.ts", "export default async () => ({v:1});");
    await writeHook(global, "mike", "step_complete.ts", "export default async () => ({v:1});");
    const reg = new HookRegistry({ workspace: null, global });
    await reg.scan();
    expect(reg.forTrigger("step_complete").map((s) => s.hookName)).toEqual(["alpha", "mike", "zeta"]);
  });

  it("ignora arquivos com nomes que não são gatilhos", async () => {
    await writeHook(global, "noisy", "README.md", "doc");
    await writeHook(global, "noisy", "random.ts", "// nope");
    const reg = new HookRegistry({ workspace: null, global });
    await reg.scan();
    expect(reg.allSpecs()).toEqual([]);
  });

  it("descobre vários gatilhos no mesmo hook", async () => {
    await writeHook(global, "multi", "before_edit.ts", "export default async () => ({v:1});");
    await writeHook(global, "multi", "step_complete.ts", "export default async () => ({v:1});");
    await writeHook(global, "multi", "session_start.ts", "export default async () => ({v:1});");
    const reg = new HookRegistry({ workspace: null, global });
    await reg.scan();
    expect(reg.forTrigger("before_edit")).toHaveLength(1);
    expect(reg.forTrigger("step_complete")).toHaveLength(1);
    expect(reg.forTrigger("session_start")).toHaveLength(1);
  });
});
