/**
 * @fileoverview Agent mode engine with optional MCP tool loop.
 * @module application/modes/AgentModeEngine
 */

import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';
import type {
  AgentModeResult,
  IAgentModeEngine,
  IProviderGateway,
  McpToolRequest,
  UserTurnInput,
} from '../../../shared/types/agent';
import { ToolBroker } from '../tools/ToolBroker';
import { ApprovalGate } from '../../infrastructure/sandbox/ApprovalGate';

const execAsync = util.promisify(cp.exec);

/**
 * Live tool event payload emitted while agent mode runs.
 */
export interface AgentLiveToolEvent {
  /**
   * Current session identifier.
   */
  sessionId: string;
  /**
   * Correlated run identifier.
   */
  runId: string;
  /**
   * Tool call snapshot to render in timeline.
   */
  toolCall: {
    tool: string;
    status: 'running' | 'done' | 'error';
    input?: string;
    output?: string;
  };
}

type AgentLoopAction =
  | { type: 'final'; content?: string }
  | { type: 'read_file'; filePath: string }
  | { type: 'search_workspace'; query: string; limit?: number }
  | { type: 'run_terminal'; command: string }
  | { type: 'mcp_call'; server: string; toolName: string; arguments?: Record<string, unknown> };

/**
 * Runs an agent-like turn using provider + optional MCP tool execution.
 */
export class AgentModeEngine implements IAgentModeEngine {
  private readonly approvalGate = new ApprovalGate();

  constructor(
    private readonly providerGateway: IProviderGateway,
    private readonly toolBroker: ToolBroker,
    private readonly onLiveToolEvent?: (event: AgentLiveToolEvent) => void,
  ) {}

  /**
   * Executes one Agent turn and returns markdown with tool timeline.
   */
  async run(input: UserTurnInput): Promise<AgentModeResult> {
    const toolCalls: AgentModeResult['toolCalls'] = [];
    const toolContextLog: string[] = [];
    let earlyFinal: string | undefined;
    const maxIterations = 4;

    this.pushLiveRecord(input, toolCalls, {
      tool: 'agent/thinking',
      status: 'running',
      output: 'Analisando solicitação e planejando próximos passos...',
    });

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      this.pushLiveRecord(input, toolCalls, {
        tool: 'agent/planner',
        status: 'running',
        output: `Escolhendo próxima ação (iteração ${iteration})...`,
      });
      const action = await this.resolveNextAction(input, toolContextLog.join('\n\n'), iteration);
      this.pushLiveRecord(input, toolCalls, {
        tool: 'agent/planner',
        status: 'done',
        output: this.describeActionInput(action),
      });
      if (action.type === 'final') {
        earlyFinal = action.content?.trim();
        break;
      }
      const runningRecord = this.createRunningRecord(action);
      this.pushLiveRecord(input, toolCalls, runningRecord);
      const resultRecord = await this.completeAction(input, action, iteration);
      this.pushLiveRecord(input, toolCalls, resultRecord);
      toolContextLog.push([
        `Iteração ${iteration}: ${resultRecord.tool}`,
        resultRecord.status === 'error' ? 'status=error' : 'status=done',
        resultRecord.output ?? '',
      ].join('\n'));
      if (resultRecord.status === 'error' && /negada pelo usuário/i.test(resultRecord.output ?? '')) {
        return {
          markdown: 'A ação solicitada foi negada. Se quiser, posso continuar com uma alternativa somente de leitura.',
          toolCalls,
        };
      }
    }

    if (earlyFinal && earlyFinal.length > 0) {
      return { markdown: earlyFinal, toolCalls };
    }

    const finalText = await this.providerGateway.chat({
      systemPrompt: [
        'Você é o modo Agent do Cappy.',
        'Responda em português.',
        'Use o resultado das ferramentas para responder de forma objetiva e acionável.',
      ].join(' '),
      prompt: this.buildProviderPrompt(input.prompt, toolContextLog.join('\n\n')),
    });
    this.pushLiveRecord(input, toolCalls, {
      tool: 'agent/thinking',
      status: 'done',
      output: 'Consolidação final concluída.',
    });
    return { markdown: finalText.text, toolCalls };
  }

  /**
   * Resolves next agent loop action (tool call or final answer).
   */
  private async resolveNextAction(
    input: UserTurnInput,
    toolContext: string,
    iteration: number,
  ): Promise<AgentLoopAction> {
    const explicitMcp = this.extractExplicitMcpRequest(input.prompt);
    if (explicitMcp && iteration === 1) {
      return {
        type: 'mcp_call',
        server: explicitMcp.server,
        toolName: explicitMcp.toolName,
        arguments: explicitMcp.arguments,
      };
    }
    const readmeHeuristic = this.resolveReadmeHeuristic(input.prompt, iteration);
    if (readmeHeuristic) {
      return readmeHeuristic;
    }
    const plannerPrompt = [
      `Solicitação do usuário:\n${input.prompt}`,
      toolContext ? `\nContexto já coletado:\n${toolContext}` : '\nContexto já coletado: (vazio)',
      '\nEscolha o próximo passo em JSON estrito.',
      'Formato:',
      '{"type":"read_file","filePath":"README.md"}',
      '{"type":"search_workspace","query":"README","limit":8}',
      '{"type":"run_terminal","command":"ls"}',
      '{"type":"mcp_call","server":"user-github","toolName":"...","arguments":{}}',
      '{"type":"final","content":"resposta final ao usuário"}',
      'Use no máximo uma ação por iteração.',
    ].join('\n');
    const planner = await this.providerGateway.chat({
      systemPrompt: 'Retorne somente um JSON válido para a próxima ação.',
      prompt: plannerPrompt,
    });
    const parsed = this.parseActionJson(planner.text);
    if (!parsed) {
      return { type: 'final' };
    }
    return parsed;
  }

  /**
   * Executes one selected action and returns timeline records.
   */
  private createRunningRecord(action: AgentLoopAction): AgentModeResult['toolCalls'][number] {
    const toolLabel = this.describeAction(action);
    const inputPayload = this.describeActionInput(action);
    return {
      tool: toolLabel,
      status: 'running',
      input: inputPayload,
    };
  }

  /**
   * Completes one selected action and returns final status record.
   */
  private async completeAction(
    input: UserTurnInput,
    action: AgentLoopAction,
    iteration: number,
  ): Promise<AgentModeResult['toolCalls'][number]> {
    const toolLabel = this.describeAction(action);
    const inputPayload = this.describeActionInput(action);
    try {
      const risk = this.classifyActionRisk(action);
      const approved = await this.approvalGate.requestApproval({
        action: `Executar ${toolLabel}`,
        risk,
        command: inputPayload,
      });
      if (!approved) {
        return {
          tool: toolLabel,
          status: 'error',
          output: 'Execução negada pelo usuário.',
        };
      }
      const output = await this.dispatchAction(input, action, iteration);
      return {
        tool: toolLabel,
        status: 'done',
        output: output,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        tool: toolLabel,
        status: 'error',
        output: message,
      };
    }
  }

  /**
   * Dispatches one action to the corresponding tool implementation.
   */
  private async dispatchAction(input: UserTurnInput, action: AgentLoopAction, iteration: number): Promise<string> {
    if (action.type === 'read_file') {
      return this.localReadFile(action.filePath);
    }
    if (action.type === 'search_workspace') {
      return this.localSearchWorkspace(action.query, action.limit);
    }
    if (action.type === 'run_terminal') {
      return this.localRunTerminal(action.command);
    }
    if (action.type === 'mcp_call') {
      const output = await this.toolBroker.executeMcpTool({
        server: action.server,
        toolName: action.toolName,
        arguments: action.arguments ?? {},
      }, {
        sessionId: input.sessionId,
        runId: input.runId,
        actor: 'orchestrator',
        attempt: iteration,
      });
      return this.formatToolOutput(output);
    }
    return action.content ?? '';
  }

  /**
   * Reads one workspace file with path safety guard.
   */
  private async localReadFile(filePath: string): Promise<string> {
    const workspaceRoot = this.getWorkspaceRoot();
    const normalized = filePath.trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (!normalized || normalized.includes('..')) {
      throw new Error('Caminho de arquivo inválido.');
    }
    const absolute = path.isAbsolute(normalized)
      ? normalized
      : path.join(workspaceRoot, normalized);
    if (!absolute.startsWith(workspaceRoot)) {
      throw new Error('Acesso fora do workspace não permitido.');
    }
    const content = await fs.readFile(absolute, 'utf8');
    const maxChars = 12000;
    if (content.length > maxChars) {
      return `${content.slice(0, maxChars)}\n... [conteúdo truncado]`;
    }
    return content;
  }

  /**
   * Searches file names in workspace matching query.
   */
  private async localSearchWorkspace(query: string, limit = 10): Promise<string> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Query vazia para busca no workspace.');
    }
    const files = await vscode.workspace.findFiles(
      '**/*',
      '**/{node_modules,.git,.cursor,.cappy,dist,out,build,coverage}/**',
      500,
    );
    const matches = files
      .map((uri) => vscode.workspace.asRelativePath(uri, false))
      .filter((item) => item.toLowerCase().includes(normalized))
      .slice(0, Math.max(1, Math.min(30, limit)));
    if (!matches.length) {
      return 'Nenhum arquivo encontrado.';
    }
    return matches.join('\n');
  }

  /**
   * Executes one terminal command in workspace root with safeguards.
   */
  private async localRunTerminal(command: string): Promise<string> {
    const trimmed = command.trim();
    if (!trimmed) {
      throw new Error('Comando vazio.');
    }
    if (/\b(rm\s+-rf|mkfs|shutdown|reboot|halt|poweroff|diskutil\s+eraseDisk)\b/i.test(trimmed)) {
      throw new Error('Comando bloqueado por política de segurança.');
    }
    const cwd = this.getWorkspaceRoot();
    const shell = process.platform === 'win32'
      ? (process.env.ComSpec || 'powershell.exe')
      : (process.env.SHELL || (os.platform() === 'darwin' ? '/bin/zsh' : '/bin/bash'));
    const { stdout, stderr } = await execAsync(trimmed, {
      cwd,
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
      shell,
    });
    const output = [`STDOUT:\n${stdout || '(vazio)'}`, `STDERR:\n${stderr || '(vazio)'}`].join('\n\n');
    const maxChars = 20000;
    return output.length > maxChars ? `${output.slice(0, maxChars)}\n... [output truncado]` : output;
  }

  /**
   * Returns workspace root path used by local tools.
   */
  private getWorkspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  }

  /**
   * Extracts explicit MCP call pattern from prompt.
   */
  private extractExplicitMcpRequest(prompt: string): McpToolRequest | null {
    const match = prompt.match(/mcp:([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(\s+\{[\s\S]*\})?/);
    if (!match) {
      return null;
    }
    const rawArgs = match[3]?.trim();
    let args: Record<string, unknown> = {};
    if (rawArgs) {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        args = { rawInput: rawArgs };
      }
    }
    return {
      server: match[1],
      toolName: match[2],
      arguments: args,
    };
  }

  /**
   * Resolves deterministic README action in first iteration.
   */
  private resolveReadmeHeuristic(prompt: string, iteration: number): AgentLoopAction | null {
    if (iteration !== 1) {
      return null;
    }
    if (!/readme/i.test(prompt)) {
      return null;
    }
    return { type: 'read_file', filePath: 'README.md' };
  }

  /**
   * Parses model output into one loop action JSON.
   */
  private parseActionJson(text: string): AgentLoopAction | null {
    const candidate = this.extractJsonObject(text);
    if (!candidate) {
      return null;
    }
    try {
      const raw = JSON.parse(candidate) as Record<string, unknown>;
      const type = String(raw.type ?? '').trim();
      if (type === 'final') {
        return { type: 'final', content: String(raw.content ?? '') };
      }
      if (type === 'read_file') {
        return { type: 'read_file', filePath: String(raw.filePath ?? '') };
      }
      if (type === 'search_workspace') {
        return {
          type: 'search_workspace',
          query: String(raw.query ?? ''),
          limit: Number(raw.limit ?? 10),
        };
      }
      if (type === 'run_terminal') {
        return { type: 'run_terminal', command: String(raw.command ?? '') };
      }
      if (type === 'mcp_call') {
        return {
          type: 'mcp_call',
          server: String(raw.server ?? ''),
          toolName: String(raw.toolName ?? ''),
          arguments: (raw.arguments as Record<string, unknown> | undefined) ?? {},
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts one JSON object from plain text or fenced block.
   */
  private extractJsonObject(text: string): string | null {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    const raw = (fenced ? fenced[1] : text).trim();
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) {
      return null;
    }
    return raw.slice(firstBrace, lastBrace + 1);
  }

  /**
   * Maps action into approval risk level.
   */
  private classifyRisk(request: McpToolRequest): 'low' | 'medium' | 'high' {
    const tool = request.toolName.toLowerCase();
    if (/(delete|drop|remove|destroy|truncate)/.test(tool)) {
      return 'high';
    }
    if (/(write|update|insert|create|merge|publish|deploy)/.test(tool)) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Maps generic loop actions into approval risk levels.
   */
  private classifyActionRisk(action: AgentLoopAction): 'low' | 'medium' | 'high' {
    if (action.type === 'run_terminal') {
      if (/(rm\s+-rf|mkfs|shutdown|reboot|halt|poweroff|diskutil\s+eraseDisk)/i.test(action.command)) {
        return 'high';
      }
      return 'medium';
    }
    if (action.type === 'mcp_call') {
      return this.classifyRisk({
        server: action.server,
        toolName: action.toolName,
        arguments: action.arguments ?? {},
      });
    }
    return 'low';
  }

  /**
   * Returns one display label for the selected action.
   */
  private describeAction(action: AgentLoopAction): string {
    if (action.type === 'read_file') {
      return 'workspace/read_file';
    }
    if (action.type === 'search_workspace') {
      return 'workspace/search';
    }
    if (action.type === 'run_terminal') {
      return 'workspace/run_terminal';
    }
    if (action.type === 'mcp_call') {
      return `${action.server}/${action.toolName}`;
    }
    return 'agent/final';
  }

  /**
   * Returns action input payload in printable format.
   */
  private describeActionInput(action: AgentLoopAction): string {
    if (action.type === 'read_file') {
      return JSON.stringify({ filePath: action.filePath }, null, 2);
    }
    if (action.type === 'search_workspace') {
      return JSON.stringify({ query: action.query, limit: action.limit ?? 10 }, null, 2);
    }
    if (action.type === 'run_terminal') {
      return JSON.stringify({ command: action.command }, null, 2);
    }
    if (action.type === 'mcp_call') {
      return JSON.stringify({
        server: action.server,
        toolName: action.toolName,
        arguments: action.arguments ?? {},
      }, null, 2);
    }
    if (action.type === 'final') {
      return JSON.stringify({ content: action.content ?? '' }, null, 2);
    }
    return '{}';
  }

  /**
   * Formats tool output for user-visible markdown.
   */
  private formatToolOutput(output: unknown): string {
    if (typeof output === 'string') {
      return output;
    }
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }

  /**
   * Builds final provider prompt with optional tool output context.
   */
  private buildProviderPrompt(prompt: string, toolOutputSummary: string): string {
    if (!toolOutputSummary) {
      return `Solicitação do usuário: ${prompt}`;
    }
    return [
      `Solicitação do usuário: ${prompt}`,
      '',
      'Saída da ferramenta executada:',
      toolOutputSummary,
      '',
      'Com base nisso, proponha próximos passos objetivos.',
    ].join('\n');
  }

  /**
   * Emits one tool state update while the agent is still running.
   */
  private emitLiveToolCall(
    input: UserTurnInput,
    toolCall: {
      tool: string;
      status: 'running' | 'done' | 'error';
      input?: string;
      output?: string;
    },
  ): void {
    this.onLiveToolEvent?.({
      sessionId: input.sessionId,
      runId: input.runId,
      toolCall,
    });
  }

  /**
   * Pushes one record into timeline and emits live update.
   */
  private pushLiveRecord(
    input: UserTurnInput,
    records: AgentModeResult['toolCalls'],
    toolCall: AgentModeResult['toolCalls'][number],
  ): void {
    records.push(toolCall);
    this.emitLiveToolCall(input, toolCall);
  }
}

