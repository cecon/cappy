import path from "node:path";
import type { ICodeAnalyzer, IEntityPipeline, AnalysisResult } from "../ports/IAnalyzer";
import type { IFileSystem } from "../ports/IFileSystem";
import type { IWebSocketClient } from "../ports/IWebSocketServer";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface DebugAnalyzeRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  content: string;
}

/**
 * Use Case: Debug e análise de arquivos
 */
export class DebugAnalyzeUseCase {
  private analyzers = new Map<string, ICodeAnalyzer>();

  private fileSystem: IFileSystem;
  private pipeline: IEntityPipeline;
  private workspaceRoot: string;

  constructor(
    fileSystem: IFileSystem,
    pipeline: IEntityPipeline,
    workspaceRoot: string
  ) {
    this.fileSystem = fileSystem;
    this.pipeline = pipeline;
    this.workspaceRoot = workspaceRoot;
  }

  registerAnalyzer(analyzer: ICodeAnalyzer): void {
    for (const ext of analyzer.getSupportedExtensions()) {
      this.analyzers.set(ext, analyzer);
    }
  }

  async analyzeViaWebSocket(request: DebugAnalyzeRequest, client: IWebSocketClient): Promise<void> {
    try {
      const { fileName, fileSize, mimeType, content } = request;
      console.log("🐛 [DebugAnalyze] Analyzing file:", fileName);

      const ext = path.extname(fileName).toLowerCase();
      const analyzer = this.analyzers.get(ext);

      if (!analyzer) {
        const supported = Array.from(this.analyzers.keys());
        client.send({
          type: "debug/analyze-error",
          payload: {
            error: `Unsupported file type: ${ext}. Supported: ${supported.join(", ")}`,
          },
        });
        return;
      }

      const tempDir = path.join(this.workspaceRoot, ".cappy-debug-temp");
      const tempFilePath = path.join(tempDir, fileName);

      if (!this.fileSystem.exists(tempDir)) {
        this.fileSystem.createDirectory(tempDir);
      }

      this.fileSystem.writeFile(tempFilePath, content);

      try {
        const analysisResult = await analyzer.analyze(tempFilePath, content);
        const pipelineResult = await this.pipeline.process(
          analysisResult.rawEntities,
          tempFilePath,
          analysisResult.jsdocChunks,
          content
        );

        const response = this.buildResponse(
          fileName,
          fileSize,
          mimeType,
          analysisResult,
          pipelineResult,
          "vite-websocket"
        );

        client.send({
          type: "debug/analyze-result",
          payload: response,
        });

        console.log("✅ [DebugAnalyze] Analysis complete");
      } finally {
        try {
          this.fileSystem.deleteFile(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error("❌ [DebugAnalyze] Error:", error);
      client.send({
        type: "debug/analyze-error",
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async analyzeViaHTTP(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const request: DebugAnalyzeRequest = JSON.parse(body);
        const { fileName, fileSize, mimeType, content } = request;
        console.log("🐛 [DebugAnalyze] Analyzing file:", fileName);

        const ext = path.extname(fileName).toLowerCase();
        const analyzer = this.analyzers.get(ext);

        if (!analyzer) {
          const supported = Array.from(this.analyzers.keys());
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: `Unsupported file type: ${ext}. Supported: ${supported.join(", ")}`,
            })
          );
          return;
        }

        const tempDir = path.join(this.workspaceRoot, ".cappy-debug-temp");
        const tempFilePath = path.join(tempDir, fileName);

        if (!this.fileSystem.exists(tempDir)) {
          this.fileSystem.createDirectory(tempDir);
        }

        this.fileSystem.writeFile(tempFilePath, content);

        try {
          const analysisResult = await analyzer.analyze(tempFilePath, content);
          const pipelineResult = await this.pipeline.process(
            analysisResult.rawEntities,
            tempFilePath,
            analysisResult.jsdocChunks,
            content
          );

          const response = this.buildResponse(
            fileName,
            fileSize,
            mimeType,
            analysisResult,
            pipelineResult,
            "vite-dev-server"
          );

          res.end(JSON.stringify(response));
          console.log("✅ [DebugAnalyze] Analysis complete");
        } finally {
          try {
            this.fileSystem.deleteFile(tempFilePath);
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (error) {
        console.error("❌ [DebugAnalyze] Error:", error);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });
  }

  private buildResponse(
    fileName: string,
    fileSize: number,
    mimeType: string,
    analysisResult: AnalysisResult,
    pipelineResult: unknown,
    mode: string
  ) {
    return {
      fileName,
      fileSize,
      mimeType,
      ast: analysisResult.ast,
      entities: analysisResult.rawEntities,
      signatures: analysisResult.signatures,
      pipeline: pipelineResult,
      metadata: {
        ...analysisResult.metadata,
        hasErrors: false,
        mode,
      },
    };
  }
}
