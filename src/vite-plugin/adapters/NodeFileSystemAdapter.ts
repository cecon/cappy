import fs from "node:fs";
import type { IFileSystem } from "../ports/IFileSystem";

/**
 * Adapter: Implementação de sistema de arquivos usando Node.js fs
 */
export class NodeFileSystemAdapter implements IFileSystem {
  exists(path: string): boolean {
    return fs.existsSync(path);
  }

  readFile(path: string): string {
    return fs.readFileSync(path, "utf-8");
  }

  writeFile(path: string, content: string): void {
    fs.writeFileSync(path, content, "utf-8");
  }

  deleteFile(path: string): void {
    fs.unlinkSync(path);
  }

  createDirectory(path: string): void {
    fs.mkdirSync(path, { recursive: true });
  }

  readDirectory(path: string): string[] {
    return fs.readdirSync(path);
  }
}
