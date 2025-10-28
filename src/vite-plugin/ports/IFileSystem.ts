/**
 * Port: Interface para operações de sistema de arquivos
 */
export interface IFileSystem {
  exists(path: string): boolean;
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
  deleteFile(path: string): void;
  createDirectory(path: string): void;
  readDirectory(path: string): string[];
}
