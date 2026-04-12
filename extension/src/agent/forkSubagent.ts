import { AgentLoop } from "./loop";
import { toolsRegistry } from "../tools";
import type { AgentTool, Message } from "./types";
import type { ToolDefinition } from "../tools/toolTypes";

/**
 * Names of tools excluded from forked subagents to prevent recursion.
 * Children cannot spawn further workers, create teams, or re-fork.
 */
const FORK_EXCLUDED_TOOLS = new Set<string>(["Agent", "TeamCreate", "SendMessage"]);

/**
 * Returns the full tool registry minus fork/swarm tools (anti-recursion guard).
 */
export function getForkableTools(): ToolDefinition[] {
  return toolsRegistry.filter((t) => !FORK_EXCLUDED_TOOLS.has(t.name));
}

export interface ForkSubagentParams {
  agentId: string;
  task: string;
  /** Optional extra context injected before the task message. */
  context?: string;
  /** Parent conversation history forwarded to the child (context inheritance). */
  parentHistory?: Message[];
  workspaceRoot: string;
  maxIterations: number;
}

export interface ForkSubagentResult {
  agentId: string;
  result: string;
  truncated: boolean;
  assistantTurns: number;
}

function buildSystemPrefix(agentId: string): string {
  return (
    `És um agente worker (id: ${agentId}). ` +
    "Executa a tarefa que te foi atribuída de forma autónoma e devolve um relatório completo com os resultados. " +
    "Não delega nem cria sub-equipas — implementa directamente."
  );
}

function buildTaskMessage(task: string, context?: string): string {
  const parts: string[] = [];
  if (context && context.trim().length > 0) {
    parts.push(`Contexto adicional:\n${context.trim()}`);
  }
  parts.push(`Tarefa:\n${task.trim()}`);
  parts.push("\nConclui com um resumo executivo dos resultados e de quaisquer ficheiros modificados.");
  return parts.join("\n\n");
}

/**
 * Spawns a full-capability nested agent loop that inherits the parent's history.
 * The child tool pool excludes Agent/TeamCreate/SendMessage to prevent recursion.
 */
export async function runForkSubagent(params: ForkSubagentParams): Promise<ForkSubagentResult> {
  const loop = new AgentLoop({ workspaceRoot: params.workspaceRoot });
  const tools = getForkableTools() as unknown as AgentTool[];

  const messages: Message[] = [
    ...(params.parentHistory ?? []),
    {
      role: "user",
      content: buildTaskMessage(params.task, params.context),
    },
  ];

  const history = await loop.run(messages, tools, {
    silent: true,
    ignorePlanMode: true,
    systemPromptPrefix: buildSystemPrefix(params.agentId),
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
    agentId: params.agentId,
    result: lastAssistant?.content?.trim() ?? "(sem resposta textual do subagente)",
    truncated,
    assistantTurns,
  };
}
