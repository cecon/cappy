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
  const args: string[] = ["--json", "--line-number", "--context", "2"];

  if (!isCaseSensitive) {
    args.push("--ignore-case");
  }
  if (params.filePattern && params.filePattern.trim().length > 0) {
    args.push("--glob", params.filePattern.trim());
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

    searchProcess.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    searchProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    searchProcess.on("error", (error) => {
      reject(error);
    });
    searchProcess.on("close", (code) => {
      if (code === 0 || code === 1) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim().length > 0 ? stderr.trim() : `rg finalizou com código ${code}.`));
    });
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

    await ensureRipgrepAvailable();
    const args = buildRipgrepArgs({ ...params, query }, targetPath);
    const rawOutput = await runRipgrep(args);
    const matches = parseSearchResults(rawOutput, maxResults);

    return { matches };
  },
};

