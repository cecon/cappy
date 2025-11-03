import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { IHTTPHandler } from "../ports/IHTTPHandler";
import type { IFileSystem } from "../ports/IFileSystem";

/**
 * Use Case: API de Tasks
 */
export class TasksAPIHandler implements IHTTPHandler {
  private readonly fileSystem: IFileSystem;
  private readonly workspaceRoot: string;

  constructor(fileSystem: IFileSystem, workspaceRoot: string) {
    this.fileSystem = fileSystem;
    this.workspaceRoot = workspaceRoot;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || "";
    const tasksDir = path.join(this.workspaceRoot, ".cappy", "tasks");

    if (url === "/tasks/list") {
      try {
        const files = this.fileSystem.exists(tasksDir) 
          ? this.fileSystem.readDirectory(tasksDir) 
          : [];
        
        const tasks = files
          .filter((f) => f.endsWith(".xml"))
          .map((f) => ({
            id: f.replace(".xml", ""),
            name: f,
            path: path.join(tasksDir, f),
          }));

        res.end(JSON.stringify({ tasks }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Tasks endpoint not found" }));
  }
}
