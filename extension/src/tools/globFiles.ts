import { spawn } from "node:child_process";

import type { ToolDefinition } from "./index";
import { resolveWorkspacePath } from "./workspacePath";

interface GlobFilesParams {
  pattern: string;
  path?: string;
  maxResults?: number;
  offset?: number;
}

interface GlobFilesResult {
  files: string[];
  truncated: boolean;
}

const DEFAULT_LIMIT = 100;
const MAX_FILES_OUTPUT_BYTES = 2 * 1024 * 1024;

/**
 * Ensures ripgrep is available in runtime PATH.
 */
async function ensureRipgrepAvailable(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const versionProcess = spawn("rg", ["--version"], { stdio: "ignore" });
    versionProcess.on("error", (error) => reject(error));
    versionProcess.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error("Falha ao verificar ripgrep (rg)."));
    });
  });
}

/**
 * Normalizes a user glob to recursive style when needed.
 */
function normalizeGlobPattern(pattern: string): string {
  const trimmedPattern = pattern.trim();
  if (trimmedPattern.startsWith("**/") || trimmedPattern.startsWith("!")) {
    return trimmedPattern;
  }
  if (trimmedPattern.includes("/")) {
    return trimmedPattern;
  }
  return `**/${trimmedPattern}`;
}

/**
 * Lists files using ripgrep file mode and glob filters.
 */
async function runGlobFiles(
  targetPath: string,
  globPattern: string,
  offset: number,
  maxResults: number,
): Promise<GlobFilesResult> {
  const args = [
    "--files",
    "--glob",
    normalizeGlobPattern(globPattern),
    "--glob",
    "!**/node_modules/**",
    "--glob",
    "!**/.git/**",
    "--glob",
    "!**/dist/**",
    "--glob",
    "!**/build/**",
    "--glob",
    "!**/out/**",
    targetPath,
  ];

  return new Promise<GlobFilesResult>((resolve, reject) => {
    const filesProcess = spawn("rg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let totalStdoutBytes = 0;
    let trailingBuffer = "";
    let hasExceededByteLimit = false;
    let stoppedByCollector = false;
    let scannedMatches = 0;
    const collectedMatches: string[] = [];
    const collectUntil = maxResults + 1;

    const processLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (line.length === 0) {
        return;
      }

      if (scannedMatches < offset) {
        scannedMatches += 1;
        return;
      }

      if (collectedMatches.length < collectUntil) {
        collectedMatches.push(line);
        return;
      }

      stoppedByCollector = true;
      filesProcess.kill();
    };

    const processChunk = (chunkText: string) => {
      trailingBuffer += chunkText;
      const lines = trailingBuffer.split(/\r?\n/u);
      trailingBuffer = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line);
        if (stoppedByCollector) {
          return;
        }
      }
    };

    filesProcess.stdout.on("data", (chunk: Buffer) => {
      if (hasExceededByteLimit || stoppedByCollector) {
        return;
      }
      totalStdoutBytes += chunk.byteLength;
      if (totalStdoutBytes > MAX_FILES_OUTPUT_BYTES) {
        hasExceededByteLimit = true;
        filesProcess.kill();
        return;
      }
      processChunk(chunk.toString("utf8"));
    });
    filesProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    filesProcess.on("error", (error) => reject(error));
    filesProcess.on("close", (code) => {
      if (trailingBuffer.length > 0 && !stoppedByCollector) {
        processLine(trailingBuffer);
      }

      if (hasExceededByteLimit) {
        resolve({
          files: collectedMatches.slice(0, maxResults),
          truncated: true,
        });
        return;
      }

      const endedEarlyByCollector = stoppedByCollector && code !== 0 && code !== 1;
      if (!endedEarlyByCollector && code !== 0 && code !== 1) {
        reject(new Error(stderr.trim().length > 0 ? stderr.trim() : `rg --files finalizou com código ${code}.`));
        return;
      }

      resolve({
        files: collectedMatches.slice(0, maxResults),
        truncated: stoppedByCollector || collectedMatches.length > maxResults,
      });
    });
  });
}

/**
 * Finds files by glob pattern using ripgrep file listing mode.
 */
export const globFilesTool: ToolDefinition<GlobFilesParams, GlobFilesResult> = {
  name: "globFiles",
  description: "Find files by glob pattern (e.g. *.ts, **/README.md).",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern to match files." },
      path: { type: "string", description: "Base directory for the search." },
      maxResults: { type: "number", description: "Maximum files to return.", default: DEFAULT_LIMIT },
      offset: { type: "number", description: "Skip first N files before returning." },
    },
    required: ["pattern"],
    additionalProperties: false,
  },
  async execute(params) {
    const rawPattern = params.pattern.trim();
    if (rawPattern.length === 0) {
      throw new Error('O parâmetro "pattern" não pode estar vazio.');
    }

    const targetPath = resolveWorkspacePath(params.path ?? ".");
    const maxResults = Number.isFinite(params.maxResults)
      ? Math.max(1, Math.trunc(params.maxResults ?? DEFAULT_LIMIT))
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(params.offset) ? Math.max(0, Math.trunc(params.offset ?? 0)) : 0;

    await ensureRipgrepAvailable();
    const globResult = await runGlobFiles(targetPath, rawPattern, offset, maxResults);

    return {
      files: globResult.files,
      truncated: globResult.truncated,
    };
  },
};
