import path from "node:path";
import { spawn } from "node:child_process";

import type { ToolDefinition } from "./index";

interface SearchCodeParams {
  query: string;
  mode?: "text" | "semantic";
  path?: string;
  filePattern?: string;
  caseSensitive?: boolean;
  maxResults?: number;
}

interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
  context: { before: string[]; after: string[] };
}

const MAX_RIPGREP_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_RIPGREP_FILES_OUTPUT_BYTES = 2 * 1024 * 1024;

/**
 * Represents one parsed regular expression using /pattern/flags syntax.
 */
interface ParsedRegexQuery {
  pattern: string;
  flags: string;
}

/**
 * Represents one `rg --json` path payload.
 */
interface RgPathPayload {
  text: string;
}

/**
 * Represents one `rg --json` line payload.
 */
interface RgLinesPayload {
  text: string;
}

/**
 * Represents one `rg --json` submatch payload.
 */
interface RgSubmatchPayload {
  start: number;
}

/**
 * Represents one `rg --json` event payload.
 */
interface RgEvent {
  type: "match" | "context" | string;
  data?: {
    path?: RgPathPayload;
    line_number?: number;
    lines?: RgLinesPayload;
    submatches?: RgSubmatchPayload[];
  };
}

/**
 * Internal partial match cache used while parsing rg events.
 */
interface ParsedMatch {
  file: string;
  line: number;
  column: number;
  content: string;
}

/**
 * Escapes a value for literal regex usage.
 */
function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Parses query in /pattern/flags format for text mode.
 */
function parseRegexLiteral(query: string): ParsedRegexQuery | null {
  if (!query.startsWith("/") || query.length < 2) {
    return null;
  }
  const lastSlash = query.lastIndexOf("/");
  if (lastSlash <= 0) {
    return null;
  }
  const pattern = query.slice(1, lastSlash);
  const flags = query.slice(lastSlash + 1);
  if (pattern.length === 0) {
    return null;
  }
  if (!/^[i]*$/u.test(flags)) {
    return null;
  }
  return { pattern, flags };
}

/**
 * Builds regex pattern for semantic declaration lookup.
 */
function buildSemanticPattern(rawQuery: string): string {
  const identifier = rawQuery.trim();
  if (identifier.length === 0) {
    throw new Error('O parâmetro "query" não pode estar vazio.');
  }
  const escapedIdentifier = escapeForRegex(identifier);
  return [
    `(?:^|\\s)(?:export\\s+)?(?:async\\s+)?function\\s+${escapedIdentifier}\\b`,
    `(?:^|\\s)(?:export\\s+)?class\\s+${escapedIdentifier}\\b`,
    `(?:^|\\s)(?:export\\s+)?interface\\s+${escapedIdentifier}\\b`,
    `(?:^|\\s)(?:export\\s+)?type\\s+${escapedIdentifier}\\b`,
    `(?:^|\\s)(?:export\\s+)?(?:const|let|var)\\s+${escapedIdentifier}\\b`,
    `(?:^|\\s)export\\s+\\{[^}]*\\b${escapedIdentifier}\\b[^}]*\\}`,
  ].join("|");
}

/**
 * Returns arguments used to execute ripgrep for one request.
 */
function buildRipgrepArgs(params: SearchCodeParams, targetPath: string): string[] {
  const mode = params.mode ?? "text";
  const isCaseSensitive = params.caseSensitive ?? false;
  const args: string[] = [
    "--json",
    "--line-number",
    "--context",
    "2",
    "--glob",
    "!**/node_modules/**",
    "--glob",
    "!**/.git/**",
    "--glob",
    "!**/dist/**",
    "--glob",
    "!**/out/**",
    "--glob",
    "!**/build/**",
  ];

  if (!isCaseSensitive) {
    args.push("--ignore-case");
  }
  if (params.filePattern && params.filePattern.trim().length > 0) {
    args.push("--glob", params.filePattern.trim());
  }
  if (Number.isFinite(params.maxResults)) {
    const safeLimit = Math.max(1, Math.trunc(params.maxResults ?? 20));
    args.push("--max-count", String(Math.max(10, safeLimit * 3)));
  }

  if (mode === "semantic") {
    args.push("--regexp", buildSemanticPattern(params.query));
  } else {
    const parsedRegex = parseRegexLiteral(params.query);
    if (parsedRegex) {
      args.push("--regexp", parsedRegex.pattern);
      if (parsedRegex.flags.includes("i") && !args.includes("--ignore-case")) {
        args.push("--ignore-case");
      }
    } else {
      args.push("--fixed-strings", "--regexp", params.query);
    }
  }

  args.push(targetPath);
  return args;
}

/**
 * Builds a stricter ripgrep command for broad-query fallback.
 */
function buildEmergencyRipgrepArgs(
  params: SearchCodeParams,
  targetPath: string,
  fallbackQuery: string,
  maxResults: number,
): string[] {
  const args: string[] = [
    "--json",
    "--line-number",
    "--max-count",
    String(Math.max(1, maxResults)),
    "--glob",
    "!**/node_modules/**",
    "--glob",
    "!**/.git/**",
    "--glob",
    "!**/dist/**",
    "--glob",
    "!**/out/**",
    "--glob",
    "!**/build/**",
  ];
  if (!(params.caseSensitive ?? false)) {
    args.push("--ignore-case");
  }
  args.push("--fixed-strings", "--regexp", fallbackQuery, targetPath);
  return args;
}

/**
 * Checks whether query likely targets file names (e.g. "readme", "package.json").
 */
function shouldPreferFileNameSearch(params: SearchCodeParams, normalizedQuery: string): boolean {
  if ((params.mode ?? "text") !== "text") {
    return false;
  }
  if (normalizedQuery.length < 3) {
    return false;
  }
  if (normalizedQuery.length > 80) {
    return false;
  }
  if (normalizedQuery.includes(" ")) {
    return false;
  }
  return true;
}

/**
 * Ensures ripgrep is available in runtime PATH.
 */
async function ensureRipgrepAvailable(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const versionProcess = spawn("rg", ["--version"], { stdio: "ignore" });
    versionProcess.on("error", (error) => {
      if (isNodeErrorWithCode(error) && error.code === "ENOENT") {
        reject(
          new Error(
            'ripgrep (rg) não está instalado ou não está no PATH. Instale com `brew install ripgrep` e tente novamente.',
          ),
        );
        return;
      }
      reject(error);
    });
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
 * Executes ripgrep and returns collected output.
 */
async function runRipgrep(args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const searchProcess = spawn("rg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let totalStdoutBytes = 0;
    let hasExceededLimit = false;

    searchProcess.stdout.on("data", (chunk: Buffer) => {
      if (hasExceededLimit) {
        return;
      }
      totalStdoutBytes += chunk.byteLength;
      if (totalStdoutBytes > MAX_RIPGREP_OUTPUT_BYTES) {
        hasExceededLimit = true;
        searchProcess.kill();
        return;
      }
      stdout += chunk.toString("utf8");
    });
    searchProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    searchProcess.on("error", (error) => {
      reject(error);
    });
    searchProcess.on("close", (code) => {
      if (hasExceededLimit) {
        reject(
          new Error(
            "Busca muito ampla para processamento seguro. Refine a query ou limite o escopo (path/filePattern).",
          ),
        );
        return;
      }
      if (code === 0 || code === 1) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim().length > 0 ? stderr.trim() : `rg finalizou com código ${code}.`));
    });
  });
}

/**
 * Lists files via ripgrep and returns matching paths for filename-like queries.
 */
async function runRipgrepFiles(targetPath: string, normalizedQuery: string, maxResults: number): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const filesProcess = spawn("rg", ["--files", targetPath], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let totalStdoutBytes = 0;
    let hasExceededLimit = false;

    filesProcess.stdout.on("data", (chunk: Buffer) => {
      if (hasExceededLimit) {
        return;
      }
      totalStdoutBytes += chunk.byteLength;
      if (totalStdoutBytes > MAX_RIPGREP_FILES_OUTPUT_BYTES) {
        hasExceededLimit = true;
        filesProcess.kill();
        return;
      }
      stdout += chunk.toString("utf8");
    });
    filesProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    filesProcess.on("error", (error) => reject(error));
    filesProcess.on("close", (code) => {
      if (hasExceededLimit) {
        resolve([]);
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim().length > 0 ? stderr.trim() : `rg --files finalizou com código ${code}.`));
        return;
      }

      const candidates = stdout
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => line.toLowerCase().includes(normalizedQuery))
        .slice(0, maxResults);
      resolve(candidates);
    });
  });
}

/**
 * Tries filename lookup using query tokens.
 */
async function runRipgrepFilesByTokens(
  targetPath: string,
  query: string,
  maxResults: number,
): Promise<string[]> {
  const normalizedQuery = query.toLowerCase();
  const tokens = normalizedQuery
    .split(/[^a-z0-9._-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  if (tokens.length === 0) {
    return [];
  }

  const broadCandidates = await runRipgrepFiles(targetPath, "", Math.max(maxResults * 10, 200));
  const filtered = broadCandidates.filter((candidate) => {
    const normalizedCandidate = candidate.toLowerCase();
    return tokens.every((token) => normalizedCandidate.includes(token));
  });

  return filtered.slice(0, maxResults);
}

/**
 * Converts file path candidates into SearchResult output shape.
 */
function toFileNameMatches(fileCandidates: string[], targetPath: string): SearchResult[] {
  return fileCandidates.map((candidate) => {
    const absoluteFilePath = path.resolve(targetPath, candidate);
    return {
      file: absoluteFilePath,
      line: 1,
      column: 1,
      content: `Arquivo encontrado: ${path.basename(candidate)}`,
      context: {
        before: [],
        after: [],
      },
    };
  });
}

/**
 * Parses one JSON event line from ripgrep output.
 */
function parseRgEvent(rawLine: string): RgEvent | null {
  if (rawLine.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(rawLine) as RgEvent;
  } catch {
    return null;
  }
}

/**
 * Removes line ending characters from rg line payloads.
 */
function normalizeLineText(text: string): string {
  return text.replace(/\r?\n$/u, "");
}

/**
 * Builds context lines around one match using parsed line cache.
 */
function buildContext(linesByFile: Map<string, Map<number, string>>, file: string, line: number): {
  before: string[];
  after: string[];
} {
  const fileLines = linesByFile.get(file);
  if (!fileLines) {
    return { before: [], after: [] };
  }

  const before: string[] = [];
  const after: string[] = [];
  for (let currentLine = line - 2; currentLine <= line - 1; currentLine += 1) {
    const content = fileLines.get(currentLine);
    if (typeof content === "string") {
      before.push(content);
    }
  }
  for (let currentLine = line + 1; currentLine <= line + 2; currentLine += 1) {
    const content = fileLines.get(currentLine);
    if (typeof content === "string") {
      after.push(content);
    }
  }

  return { before, after };
}

/**
 * Parses raw rg JSON output and maps it to SearchResult objects.
 */
function parseSearchResults(rawOutput: string, maxResults: number): SearchResult[] {
  const linesByFile = new Map<string, Map<number, string>>();
  const parsedMatches: ParsedMatch[] = [];
  const rawLines = rawOutput.split(/\r?\n/u);

  for (const rawLine of rawLines) {
    const event = parseRgEvent(rawLine);
    if (!event || !event.data || !event.data.path || !event.data.lines || typeof event.data.line_number !== "number") {
      continue;
    }

    const file = event.data.path.text;
    const line = event.data.line_number;
    const content = normalizeLineText(event.data.lines.text);
    const fileLines = linesByFile.get(file) ?? new Map<number, string>();
    fileLines.set(line, content);
    linesByFile.set(file, fileLines);

    if (event.type !== "match") {
      continue;
    }

    const firstSubmatch = event.data.submatches?.[0];
    const column = firstSubmatch ? firstSubmatch.start + 1 : 1;
    parsedMatches.push({ file, line, column, content });
  }

  return parsedMatches.slice(0, maxResults).map((match) => ({
    file: match.file,
    line: match.line,
    column: match.column,
    content: match.content,
    context: buildContext(linesByFile, match.file, match.line),
  }));
}

/**
 * Checks whether unknown runtime error has a code property.
 */
function isNodeErrorWithCode(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string";
}

/**
 * Searches code in text or semantic mode using ripgrep.
 */
export const searchCodeTool: ToolDefinition<SearchCodeParams, { matches: SearchResult[] }> = {
  name: "searchCode",
  description: "Searches code via ripgrep in text or semantic mode.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Texto ou nome alvo da busca." },
      mode: {
        type: "string",
        enum: ["text", "semantic"],
        description: 'Modo da busca: "text" para conteúdo e "semantic" para declarações.',
        default: "text",
      },
      path: { type: "string", description: "Caminho base da busca. Padrão: raiz do workspace." },
      filePattern: { type: "string", description: 'Filtro opcional de arquivos (ex: "*.ts").' },
      caseSensitive: { type: "boolean", description: "Define se a busca diferencia maiúsculas/minúsculas." },
      maxResults: { type: "number", description: "Quantidade máxima de resultados retornados.", default: 20 },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(params) {
    const query = params.query.trim();
    if (query.length === 0) {
      throw new Error('O parâmetro "query" não pode estar vazio.');
    }

    const maxResults = Number.isFinite(params.maxResults) ? Math.max(1, Math.trunc(params.maxResults ?? 20)) : 20;
    const targetPath = path.resolve(params.path ?? process.cwd());
    const normalizedQuery = query.toLowerCase();

    await ensureRipgrepAvailable();
    if (shouldPreferFileNameSearch(params, normalizedQuery)) {
      const fileCandidates = await runRipgrepFiles(targetPath, normalizedQuery, maxResults);
      if (fileCandidates.length > 0) {
        return { matches: toFileNameMatches(fileCandidates, targetPath) };
      }
    }

    let matches: SearchResult[] = [];
    try {
      const args = buildRipgrepArgs({ ...params, query }, targetPath);
      const rawOutput = await runRipgrep(args);
      matches = parseSearchResults(rawOutput, maxResults);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Busca muito ampla")) {
        const fileCandidates = await runRipgrepFilesByTokens(targetPath, query, maxResults);
        if (fileCandidates.length > 0) {
          return { matches: toFileNameMatches(fileCandidates, targetPath) };
        }

        // Last safe fallback: retry with strict limits and no broad context expansion.
        const fallbackToken =
          query
            .split(/[^a-zA-Z0-9._-]+/u)
            .map((token) => token.trim())
            .find((token) => token.length >= 3) ?? query;
        try {
          const emergencyArgs = buildEmergencyRipgrepArgs(params, targetPath, fallbackToken, maxResults);
          const emergencyOutput = await runRipgrep(emergencyArgs);
          const emergencyMatches = parseSearchResults(emergencyOutput, maxResults);
          return { matches: emergencyMatches };
        } catch {
          // Do not hard-fail agent loop for broad queries; return empty and let model refine.
          return { matches: [] };
        }
      }
      throw error;
    }

    return { matches };
  },
};

