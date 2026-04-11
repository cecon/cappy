/**
 * Port: file system abstraction.
 * Allows swapping VS Code workspace FS with Node.js fs for tests.
 */

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
}

export interface IFileSystem {
  readFile(absolutePath: string): Promise<string>;
  writeFile(absolutePath: string, content: string): Promise<void>;
  fileExists(absolutePath: string): Promise<boolean>;
  /**
   * Returns absolute paths matching the glob pattern.
   * @param exclude Optional glob pattern to exclude.
   */
  glob(pattern: string, exclude?: string): Promise<string[]>;
  readDirectory(absolutePath: string): Promise<DirectoryEntry[]>;
}
