import { AgentLoop } from "./loop";
import type { AgentTool, Message } from "./types";
import type { ToolDefinition } from "../tools/toolTypes";
import { globOpenClaudeTool } from "../tools/globFiles";
import { grepTool } from "../tools/grepTool";
import { listDirTool } from "../tools/listDir";
import { readOpenClaudeTool } from "../tools/readFile";
import { searchCodeTool } from "../tools/searchCode";
import { webFetchTool } from "../tools/webFetch";
import { webSearchTool } from "../tools/webSearch";

export type ExploreFocus = "codebase" | "web" | "both";

/**
 * Read-only tool set for nested exploration (no writes, shell, or recursive ExploreAgent).
 */
export function getReadOnlySubagentTools(): ToolDefinition[] {
  return [
    readOpenClaudeTool,
    grepTool,
    globOpenClaudeTool,
    listDirTool,
    searchCodeTool,
    webFetchTool,
    webSearchTool,
  ];
}

function buildSystemPrefix(focus: ExploreFocus): string {
  const codeHint =
    "No repositório: use Grep (regex/ripgrep), Glob, listDir, searchCode e Read. Não use Bash nem ferramentas de escrita.";
  const webHint = "Na web: use WebSearch e WebFetch (URLs públicas). Cite fontes.";
  if (focus === "codebase") {
    return `És um subagente só de leitura focado no código. ${codeHint} Produz um relatório curto com caminhos de ficheiros e excertos relevantes.`;
  }
  if (focus === "web") {
    return `És um subagente só de leitura focado em dados públicos na web. ${webHint} Produz um relatório com URLs e factos verificáveis.`;
  }
  return `És um subagente só de leitura. ${codeHint} ${webHint} Produz um relatório estruturado (código + web conforme o pedido).`;
}

function buildUserMessage(goal: string, focus: ExploreFocus): string {
  return [
    "Tarefa do subagente:",
    goal.trim(),
    "",
    `Âmbito preferido: ${focus}. Se o pedido for só código ou só web, ignora o outro domínio.`,
    "Termina com um resumo executivo e lista de achados (ficheiros ou URLs).",
  ].join("\n");
}

export interface ExploreSubagentParams {
  goal: string;
  focus: ExploreFocus;
  maxIterations: number;
  workspaceRoot: string;
}

export interface ExploreSubagentResult {
  report: string;
  truncated: boolean;
  assistantTurns: number;
}

/**
 * Runs a silent nested agent loop for codebase/web exploration.
 */
export async function runExploreSubagent(params: ExploreSubagentParams): Promise<ExploreSubagentResult> {
  const loop = new AgentLoop({ workspaceRoot: params.workspaceRoot });
  const tools = getReadOnlySubagentTools() as unknown as AgentTool[];
  const messages: Message[] = [
    {
      role: "user",
      content: buildUserMessage(params.goal, params.focus),
    },
  ];

  const history = await loop.run(messages, tools, {
    silent: true,
    ignorePlanMode: true,
    systemPromptPrefix: buildSystemPrefix(params.focus),
    maxLlmRounds: params.maxIterations,
  });

  const assistantTurns = history.filter((m) => m.role === "assistant").length;
  const lastAssistant = [...history]
    .reverse()
    .find((m) => m.role === "assistant" && m.content.trim().length > 0);
  const truncated = history.some(
    (m) => m.role === "assistant" && m.content.includes("Limite de rodadas do agente aninhado"),
  );

  return {
    report: lastAssistant?.content?.trim() ?? "(sem resposta textual do subagente)",
    truncated,
    assistantTurns,
  };
}
