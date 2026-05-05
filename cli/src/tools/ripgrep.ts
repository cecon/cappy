import path from "node:path";
import fs from "node:fs";

let _rgPathCache: string | undefined;

function findRgInTree(dir: string, bin: string, maxDepth = 5): string | undefined {
  for (let i = 0; i < maxDepth; i++) {
    const candidates = [
      path.join(dir, "node_modules", "@vscode", "ripgrep", "bin", bin),
      path.join(dir, "node_modules", "vscode-ripgrep", "bin", bin),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Returns the path to ripgrep bundled with VS Code, falling back to "rg" in PATH.
 * Works on Windows, macOS and Linux.
 */
export function getRgPath(): string {
  if (_rgPathCache) return _rgPathCache;

  const isWindows = process.platform === "win32";
  const bin = isWindows ? "rg.exe" : "rg";

  // 1. Try the official VS Code API (available in newer VS Code versions)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscode = require("vscode") as typeof import("vscode");
    const rgPath = (vscode.env as any).ripgrepPath;
    if (rgPath && fs.existsSync(rgPath)) {
      _rgPathCache = rgPath;
      return rgPath;
    }
    // 2. Search from appRoot upward (VS Code bundles rg next to the app)
    const fromAppRoot = findRgInTree(vscode.env.appRoot, bin);
    if (fromAppRoot) {
      _rgPathCache = fromAppRoot;
      return fromAppRoot;
    }
  } catch {}

  // 3. Search from the Code executable directory upward
  const execDir = path.dirname(process.execPath);
  const fromExec = findRgInTree(execDir, bin);
  if (fromExec) {
    _rgPathCache = fromExec;
    return fromExec;
  }

  // 4. Fallback to PATH
  _rgPathCache = "rg";
  return "rg";
}
