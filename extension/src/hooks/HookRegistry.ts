import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import type { HookSpec, HookTrigger } from "./hookTypes";

const VALID_TRIGGERS: ReadonlySet<HookTrigger> = new Set<HookTrigger>([
  "session_start",
  "before_edit",
  "step_complete",
  "session_stop",
]);

export interface HookRegistryRoots {
  /** Workspace-scoped hooks (`<workspace>/.cappy/hooks`). When null, only global is scanned. */
  workspace: string | null;
  /** Global hooks (`~/.cappy/hooks`). */
  global: string;
}

/**
 * Discovers hook directories from workspace + global roots and indexes them by trigger.
 * Workspace hooks override global hooks when (hookName, trigger) collide.
 */
export class HookRegistry {
  private byTrigger = new Map<HookTrigger, HookSpec[]>();

  public constructor(private readonly roots: HookRegistryRoots) {}

  public async scan(): Promise<void> {
    const globalSpecs = await scanRoot(this.roots.global, "global");
    const workspaceSpecs = this.roots.workspace
      ? await scanRoot(this.roots.workspace, "workspace")
      : [];

    const merged = new Map<string, HookSpec>();
    for (const spec of globalSpecs) {
      merged.set(`${spec.hookName}::${spec.trigger}`, spec);
    }
    for (const spec of workspaceSpecs) {
      merged.set(`${spec.hookName}::${spec.trigger}`, spec);
    }

    const grouped = new Map<HookTrigger, HookSpec[]>();
    for (const spec of merged.values()) {
      const list = grouped.get(spec.trigger) ?? [];
      list.push(spec);
      grouped.set(spec.trigger, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.hookName.localeCompare(b.hookName));
    }
    this.byTrigger = grouped;
  }

  public forTrigger(trigger: HookTrigger): HookSpec[] {
    return this.byTrigger.get(trigger) ?? [];
  }

  public hasAny(trigger: HookTrigger): boolean {
    return (this.byTrigger.get(trigger)?.length ?? 0) > 0;
  }

  public allSpecs(): HookSpec[] {
    const out: HookSpec[] = [];
    for (const list of this.byTrigger.values()) {
      out.push(...list);
    }
    return out;
  }
}

async function scanRoot(root: string, scope: "workspace" | "global"): Promise<HookSpec[]> {
  let dirs: string[] = [];
  try {
    dirs = await fs.readdir(root);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const specs: HookSpec[] = [];
  for (const name of dirs) {
    const dirPath = path.join(root, name);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) {
      continue;
    }
    const files = await fs.readdir(dirPath);
    const triggersSeen = new Map<HookTrigger, { ts: string | null; md: string | null }>();
    for (const f of files) {
      const trigger = parseTriggerFromFilename(f);
      if (!trigger) {
        continue;
      }
      const slot = triggersSeen.get(trigger) ?? { ts: null, md: null };
      if (f.endsWith(".ts")) {
        slot.ts = path.join(dirPath, f);
      } else if (f.endsWith(".md")) {
        slot.md = path.join(dirPath, f);
      }
      triggersSeen.set(trigger, slot);
    }
    for (const [trigger, slot] of triggersSeen) {
      if (slot.ts) {
        specs.push({ hookName: name, trigger, sourcePath: slot.ts, scope, advisoryOnly: false });
      } else if (slot.md) {
        specs.push({ hookName: name, trigger, sourcePath: slot.md, scope, advisoryOnly: true });
      }
    }
  }
  return specs;
}

function parseTriggerFromFilename(filename: string): HookTrigger | null {
  if (!filename.endsWith(".ts") && !filename.endsWith(".md")) {
    return null;
  }
  const base = filename.replace(/\.(ts|md)$/u, "");
  if (VALID_TRIGGERS.has(base as HookTrigger)) {
    return base as HookTrigger;
  }
  return null;
}

/** Default global hook root: `~/.cappy/hooks`. */
export function defaultGlobalHookRoot(): string {
  return path.join(os.homedir(), ".cappy", "hooks");
}

/** Workspace hook root: `<workspaceRoot>/.cappy/hooks`. */
export function workspaceHookRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".cappy", "hooks");
}
