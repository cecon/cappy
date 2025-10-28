import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { IHTTPHandler } from "../ports/IHTTPHandler";
import type { IFileSystem } from "../ports/IFileSystem";

/**
 * Use Case: API de Grafo
 */
export class GraphAPIHandler implements IHTTPHandler {
  private fileSystem: IFileSystem;
  private workspaceRoot: string;

  constructor(
    fileSystem: IFileSystem,
    workspaceRoot: string
  ) {
    this.fileSystem = fileSystem;
    this.workspaceRoot = workspaceRoot;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || "";
    const dbPath = path.join(this.workspaceRoot, ".cappy", "knowledge-graph.db");

    if (url === "/graph/status") {
      const exists = this.fileSystem.exists(dbPath);
      res.end(
        JSON.stringify({
          type: "db-status",
          exists,
          path: dbPath,
        })
      );
      return;
    }

    if (url === "/graph/load") {
      res.end(
        JSON.stringify({
          type: "subgraph",
          nodes: [],
          edges: [],
        })
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Graph endpoint not found" }));
  }
}
