import * as vscode from "vscode";
import type { ContextUsagePayload } from "../agent/contextBudget";
import { AgentLoop } from "../agent/loop";
import type { AgentTool, Message, ToolCall } from "../agent/types";
import { resetSessionContext } from "../agent/sessionContext";
import { loadAgentPreferences } from "../agent/agentPreferences";
import { type CappyConfig, loadConfig, saveConfig } from "../config";
import { McpManager, type McpTool } from "../mcp/client";
import { toolsRegistry } from "../tools";
import { type ChatUiMode, mcpToolsForChatMode, parseChatUiMode, selectToolsForChatMode } from "./chatMode";
import type { FileDiffPayload } from "../utils/fileDiffPayload";
import { logDebug, logError, logInfo, resetLoggerCache } from "../utils/logger";
import {
  isAgentShellTool,
  parseShellToolResultString,
  shellToolMeta,
  truncateShellText,
} from "./agentShellMirror";

/**
 * Message sent from extension host to webview.
 */
export type HostToWebviewMessage =
  | { type: "stream:token"; token: string }
  | { type: "stream:done" }
  | { type: "stream:system"; message: string }
  /** Eco do mesmo comando que o agente vai executar via Bash/runTerminal. */
  | { type: "agent:shell:start"; command: string; cwd?: string }
  /** Saída do mesmo `exec` que alimenta a tool (stdout/stderr). */
  | { type: "agent:shell:complete"; command: string; stdout: string; stderr: string; errorText?: string }
  | { type: "tool:confirm"; toolCall: ToolCall }
  | { type: "tool:executing"; toolCall: ToolCall }
  | { type: "tool:result"; toolCall: ToolCall; result: string; fileDiff?: FileDiffPayload }
  | { type: "tool:rejected"; toolCall: ToolCall }
  | { type: "config:loaded"; config: CappyConfig }
  | { type: "config:saved" }
  | { type: "mcp:tools"; tools: McpTool[] }
  | {
      type: "context:usage";
      usedTokens: number;
      limitTokens: number;
      effectiveInputBudgetTokens: number;
      didTrimForApi: boolean;
      droppedMessageCount: number;
    }
  | {
      type: "hitl:policy";
      destructiveTools: "confirm_each" | "allow_all";
      sessionAutoApproveDestructive: boolean;
    }
  | { type: "error"; message: string };

/**
 * Message sent from webview to extension host.
 */
export type WebviewToHostMessage =
  | { type: "chat:send"; messages: Message[]; mode?: ChatUiMode }
  | { type: "chat:stop" }
  /** Nova sessão: `onNewSession` no bridge ou comando `cappy.clearChat` (fallback). */
  | { type: "session:new" }
  | { type: "tool:approve"; toolCallId: string }
  /** Aprovar o pedido actual e todos os destrutivos até ao fim da sessão (mesmo AgentLoop). */
  | { type: "hitl:approveSession"; toolCallId: string }
  /** Aprovar e gravar `allow_all` em `.cappy/agent-preferences.json`. */
  | { type: "hitl:approvePersist"; toolCallId: string }
  | { type: "tool:reject"; toolCallId: string }
  | { type: "file:open"; path: string }
  | { type: "config:load" }
  | { type: "config:save"; config: CappyConfig }
  | { type: "mcp:list" };

/**
 * Opções do bridge; use `onNewSession` para nova sessão sem reentrância de comandos.
 */
export interface WebviewBridgeOptions {
  /**
   * Chamado em `session:new` — deve recarregar o webview (ex.: `provider.clearChat`).
   * Preferível a `executeCommand("cappy.clearChat")` dentro do handler de mensagens.
   */
  onNewSession?: () => Promise<void>;
}

/**
 * Creates a message bridge for a VS Code webview with AgentLoop integration.
 */
export function createWebviewBridge(webview: vscode.Webview, options?: WebviewBridgeOptions): vscode.Disposable[] {
  const mcpManager = new McpManager();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    process.env.CAPPY_WORKSPACE_ROOT = workspaceRoot;
  }
  /** Estado espelhado no webview para auto-aprovar HITL na camada UI. */
  const hitlUiSessionState = { sessionAutoApproveDestructive: false };
  const agentLoop = new AgentLoop({
    ...(workspaceRoot ? { workspaceRoot } : {}),
    onMcpCall: async (serverName, toolName, args) => mcpManager.callTool(serverName, toolName, args),
  });
  const tools = toolsRegistry as unknown as AgentTool[];
  const bridgeDisposables: vscode.Disposable[] = [];

  const streamTokenListener = (token: string) => {
    void postToWebview(webview, { type: "stream:token", token });
  };
  const streamDoneListener = () => {
    void postToWebview(webview, { type: "stream:done" });
  };
  const streamSystemListener = (message: string) => {
    void postToWebview(webview, { type: "stream:system", message });
  };
  const toolConfirmListener = (toolCall: ToolCall) => {
    void postToWebview(webview, { type: "tool:confirm", toolCall });
  };
  const toolExecutingListener = (toolCall: ToolCall) => {
    void postToWebview(webview, { type: "tool:executing", toolCall });
    if (isAgentShellTool(toolCall.name)) {
      const { command, cwd } = shellToolMeta(toolCall);
      void postToWebview(webview, { type: "agent:shell:start", command, ...(cwd !== undefined ? { cwd } : {}) });
    }
  };
  const toolResultListener = (toolCall: ToolCall, result: string, fileDiff?: FileDiffPayload) => {
    void postToWebview(webview, { type: "tool:result", toolCall, result, ...(fileDiff ? { fileDiff } : {}) });
    if (isAgentShellTool(toolCall.name)) {
      const { command } = shellToolMeta(toolCall);
      const parsed = parseShellToolResultString(result);
      if (parsed) {
        void postToWebview(webview, {
          type: "agent:shell:complete",
          command,
          stdout: truncateShellText(parsed.stdout),
          stderr: truncateShellText(parsed.stderr),
        });
      } else {
        void postToWebview(webview, {
          type: "agent:shell:complete",
          command,
          stdout: "",
          stderr: "",
          errorText: truncateShellText(result),
        });
      }
    }
  };
  const toolRejectedListener = (toolCall: ToolCall) => {
    void postToWebview(webview, { type: "tool:rejected", toolCall });
  };
  const errorListener = (error: Error) => {
    logError(`Agent error event: ${error.message}`);
    void postToWebview(webview, { type: "error", message: error.message });
  };
  const contextUsageListener = (payload: ContextUsagePayload) => {
    void postToWebview(webview, {
      type: "context:usage",
      usedTokens: payload.usedTokens,
      limitTokens: payload.limitTokens,
      effectiveInputBudgetTokens: payload.effectiveInputBudgetTokens,
      didTrimForApi: payload.didTrimForApi,
      droppedMessageCount: payload.droppedMessageCount,
    });
  };

  agentLoop.on("stream:token", streamTokenListener);
  agentLoop.on("stream:done", streamDoneListener);
  agentLoop.on("stream:system", streamSystemListener);
  agentLoop.on("tool:confirm", toolConfirmListener);
  agentLoop.on("tool:executing", toolExecutingListener);
  agentLoop.on("tool:result", toolResultListener);
  agentLoop.on("tool:rejected", toolRejectedListener);
  agentLoop.on("error", errorListener);
  agentLoop.on("context:usage", contextUsageListener);

  void pushHitlPolicyToWebview(webview, workspaceRoot, hitlUiSessionState);

  bridgeDisposables.push(
    webview.onDidReceiveMessage((raw: unknown) => {
      void handleWebviewMessage(raw, agentLoop, webview, tools, mcpManager, options, workspaceRoot, hitlUiSessionState);
    }),
  );

  bridgeDisposables.push(
    vscode.Disposable.from({
      dispose: () => {
      agentLoop.off("stream:token", streamTokenListener);
      agentLoop.off("stream:done", streamDoneListener);
      agentLoop.off("stream:system", streamSystemListener);
      agentLoop.off("tool:confirm", toolConfirmListener);
      agentLoop.off("tool:executing", toolExecutingListener);
      agentLoop.off("tool:result", toolResultListener);
      agentLoop.off("tool:rejected", toolRejectedListener);
      agentLoop.off("error", errorListener);
      agentLoop.off("context:usage", contextUsageListener);
      void mcpManager.disconnect();
      resetSessionContext();
      },
    }),
  );

  return bridgeDisposables;
}

/**
 * Opens a workspace-relative file in the editor (segments from `path`, forward slashes).
 */
async function openWorkspaceRelativeFile(webview: vscode.Webview, relativePath: string): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await postToWebview(webview, { type: "error", message: "Abra uma pasta de workspace para abrir ficheiros." });
    return;
  }
  const normalized = relativePath.replace(/\\/gu, "/").trim();
  if (!normalized || normalized.includes("..")) {
    await postToWebview(webview, { type: "error", message: "Caminho de ficheiro invalido." });
    return;
  }
  const segments = normalized.split("/").filter((s) => s.length > 0);
  let targetUri = folder.uri;
  for (const segment of segments) {
    targetUri = vscode.Uri.joinPath(targetUri, segment);
  }
  try {
    const document = await vscode.workspace.openTextDocument(targetUri);
    await vscode.window.showTextDocument(document, { preview: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel abrir o ficheiro.";
    await postToWebview(webview, { type: "error", message });
  }
}

/**
 * Envia política HITL actual (ficheiro `.cappy` + «aprovar todos nesta sessão») para o webview aplicar auto-aprovação na UI.
 */
async function pushHitlPolicyToWebview(
  webview: vscode.Webview,
  workspaceRoot: string | undefined,
  hitlUiSessionState: { sessionAutoApproveDestructive: boolean },
): Promise<void> {
  let destructiveTools: "confirm_each" | "allow_all" = "confirm_each";
  if (workspaceRoot) {
    const prefs = await loadAgentPreferences(workspaceRoot);
    destructiveTools = prefs?.hitl.destructiveTools ?? "confirm_each";
  }
  await postToWebview(webview, {
    type: "hitl:policy",
    destructiveTools,
    sessionAutoApproveDestructive: hitlUiSessionState.sessionAutoApproveDestructive,
  });
}

/**
 * Handles one inbound webview message and forwards to the AgentLoop.
 */
async function handleWebviewMessage(
  raw: unknown,
  agentLoop: AgentLoop,
  webview: vscode.Webview,
  tools: AgentTool[],
  mcpManager: McpManager,
  options: WebviewBridgeOptions | undefined,
  workspaceRoot: string | undefined,
  hitlUiSessionState: { sessionAutoApproveDestructive: boolean },
): Promise<void> {
  if (!isWebviewToHostMessage(raw)) {
    await postToWebview(webview, { type: "error", message: "Mensagem invalida recebida do webview." });
    return;
  }

  if (raw.type === "chat:send") {
    try {
      const mode = parseChatUiMode(raw.mode);
      const toolsForRun = selectToolsForChatMode(mode, tools);
      const mcpList = mcpManager.listTools();
      logInfo(`chat:send received | mode=${mode} msgs=${raw.messages.length} tools=${toolsForRun.length} mcp=${mcpList.length}`);
      await agentLoop.run(raw.messages, toolsForRun, {
        mcpTools: mcpToolsForChatMode(mode, mcpList),
        chatMode: mode,
      });
    } catch (err) {
      logError(`Agent loop error in bridge: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  if (raw.type === "chat:stop") {
    logInfo("chat:stop received, aborting agent loop");
    agentLoop.abort();
    return;
  }

  if (raw.type === "session:new") {
    logInfo("session:new received");
    agentLoop.abort();
    const webviewRef = webview;
    const onNewSession = options?.onNewSession;
    /**
     * Adia o reload para depois do retorno do handler — evita reentrância com
     * `executeCommand` / substituição do webview no meio do processamento da mensagem.
     */
    void setTimeout(() => {
      void (async () => {
        try {
          if (onNewSession) {
            await onNewSession();
          } else {
            await vscode.commands.executeCommand("cappy.clearChat");
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logError(`session:new failed: ${message}`);
          void postToWebview(webviewRef, {
            type: "error",
            message: `Nova sessao: ${message}`,
          });
        }
      })();
    }, 0);
    return;
  }

  if (raw.type === "tool:approve") {
    if (!agentLoop.approve(raw.toolCallId)) {
      await postToWebview(webview, {
        type: "error",
        message: `Confirmacao pendente nao encontrada: ${raw.toolCallId}`,
      });
    }
    return;
  }

  if (raw.type === "hitl:approveSession") {
    if (!agentLoop.approveSessionAutoDestructive(raw.toolCallId)) {
      await postToWebview(webview, {
        type: "error",
        message: `Confirmacao pendente nao encontrada: ${raw.toolCallId}`,
      });
      return;
    }
    hitlUiSessionState.sessionAutoApproveDestructive = true;
    await pushHitlPolicyToWebview(webview, workspaceRoot, hitlUiSessionState);
    return;
  }

  if (raw.type === "hitl:approvePersist") {
    if (!workspaceRoot) {
      await postToWebview(webview, {
        type: "error",
        message: "Abra uma pasta de workspace para guardar preferencias em .cappy/agent-preferences.json.",
      });
      return;
    }
    try {
      const ok = await agentLoop.persistAllowAllDestructive(raw.toolCallId);
      if (!ok) {
        await postToWebview(webview, {
          type: "error",
          message: `Confirmacao pendente nao encontrada: ${raw.toolCallId}`,
        });
        return;
      }
      hitlUiSessionState.sessionAutoApproveDestructive = true;
      await pushHitlPolicyToWebview(webview, workspaceRoot, hitlUiSessionState);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await postToWebview(webview, { type: "error", message: `Falha ao gravar preferencias: ${message}` });
    }
    return;
  }

  if (raw.type === "config:load") {
    try {
      const config = await loadConfig();
      await mcpManager.connect(config.mcp.servers);
      await postToWebview(webview, { type: "config:loaded", config });
      await pushHitlPolicyToWebview(webview, workspaceRoot, hitlUiSessionState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar configuracao.";
      await postToWebview(webview, { type: "error", message });
    }
    return;
  }

  if (raw.type === "config:save") {
    try {
      await saveConfig(raw.config);
      resetLoggerCache();
      await mcpManager.connect(raw.config.mcp.servers);
      await postToWebview(webview, { type: "config:saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar configuracao.";
      await postToWebview(webview, { type: "error", message });
    }
    return;
  }

  if (raw.type === "mcp:list") {
    await postToWebview(webview, {
      type: "mcp:tools",
      tools: mcpManager.listTools(),
    });
    return;
  }

  if (raw.type === "file:open") {
    await openWorkspaceRelativeFile(webview, raw.path);
    return;
  }

  if (raw.type === "tool:reject") {
    if (!agentLoop.reject(raw.toolCallId)) {
      await postToWebview(webview, {
        type: "error",
        message: `Confirmacao pendente nao encontrada: ${raw.toolCallId}`,
      });
    }
    return;
  }
}

/**
 * Narrows unknown inbound values to the bridge incoming message union.
 */
function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "chat:send") {
    if (!Array.isArray(value.messages)) {
      return false;
    }
    if (
      value.mode !== undefined &&
      value.mode !== "plain" &&
      value.mode !== "agent" &&
      value.mode !== "ask"
    ) {
      return false;
    }
    return true;
  }

  if (value.type === "tool:approve" || value.type === "tool:reject") {
    return typeof value.toolCallId === "string" && value.toolCallId.length > 0;
  }

  if (value.type === "hitl:approveSession" || value.type === "hitl:approvePersist") {
    return typeof value.toolCallId === "string" && value.toolCallId.length > 0;
  }

  if (value.type === "chat:stop") {
    return true;
  }

  if (value.type === "session:new") {
    return true;
  }

  if (value.type === "config:load") {
    return true;
  }

  if (value.type === "config:save") {
    return isCappyConfig(value.config);
  }

  if (value.type === "mcp:list") {
    return true;
  }

  if (value.type === "file:open") {
    return typeof value.path === "string" && value.path.trim().length > 0;
  }

  return false;
}

/**
 * Narrows unknown values to key/value object records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates runtime payloads as CappyConfig.
 */
function isCappyConfig(value: unknown): value is CappyConfig {
  if (!isRecord(value) || !isRecord(value.openrouter) || !isRecord(value.agent) || !isRecord(value.mcp)) {
    return false;
  }
  return (
    typeof value.openrouter.apiKey === "string" &&
    typeof value.openrouter.model === "string" &&
    typeof value.agent.systemPrompt === "string" &&
    typeof value.agent.maxIterations === "number" &&
    Array.isArray(value.mcp.servers) &&
    value.mcp.servers.every(
      (server) => isRecord(server) && typeof server.name === "string" && typeof server.url === "string",
    )
  );
}

/**
 * Posts a typed message from extension to webview.
 */
export async function postToWebview(
  webview: vscode.Webview,
  message: HostToWebviewMessage,
): Promise<boolean> {
  return webview.postMessage(message);
}
