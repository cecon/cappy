/**
 * Adapter: VS Code workspace file system → IFileSystem.
 * Uses vscode.workspace.fs for reads/writes so the extension respects workspace FS providers.
 */

import * as vscode from "vscode";
import path from "node:path";

import type { DirectoryEntry, IFileSystem } from "../../domain/ports/IFileSystem";

export class VsCodeFsAdapter implements IFileSystem {
  async readFile(absolutePath: string): Promise<string> {
    const uri = vscode.Uri.file(absolutePath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf-8");
  }

  async writeFile(absolutePath: string, content: string): Promise<void> {
    const uri = vscode.Uri.file(absolutePath);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
  }

  async fileExists(absolutePath: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
      return true;
    } catch {
      return false;
    }
  }

  async glob(pattern: string, exclude?: string): Promise<string[]> {
    const files = await vscode.workspace.findFiles(pattern, exclude ?? null);
    return files.map((f) => f.fsPath);
  }

  async readDirectory(absolutePath: string): Promise<DirectoryEntry[]> {
    const uri = vscode.Uri.file(absolutePath);
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries.map(([name, fileType]) => ({
      name,
      type: fileType === vscode.FileType.Directory ? "directory" : "file",
    }));
  }
}

/**
 * Resolves an absolute path from a workspace-relative or absolute path string.
 * Returns the path unchanged if it's already absolute.
 */
export function resolveWorkspacePath(maybeRelative: string): string {
  if (path.isAbsolute(maybeRelative)) return maybeRelative;
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  return path.join(root, maybeRelative);
}
