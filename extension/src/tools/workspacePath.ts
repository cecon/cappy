import path from "node:path";

/**
 * Returns the workspace root configured by the extension host.
 */
export function getWorkspaceRoot(): string {
  const configuredWorkspaceRoot = process.env.CAPPY_WORKSPACE_ROOT;
  if (typeof configuredWorkspaceRoot === "string" && configuredWorkspaceRoot.trim().length > 0) {
    return configuredWorkspaceRoot;
  }
  return process.cwd();
}

/**
 * Resolves one user path against the workspace root.
 */
export function resolveWorkspacePath(inputPath: string): string {
  return path.resolve(getWorkspaceRoot(), inputPath);
}

