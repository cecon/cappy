import * as vscode from "vscode";
import { AgentLoop } from "../agent/loop";
import type { AgentTool, Message, ToolCall } from "../agent/types";
import { type CappyConfig, loadConfig, saveConfig } from "../config";
import { McpManager, type McpTool } from "../mcp/client";
import { toolsRegistry } from "../tools";

/**
 * Message sent from extension host to webview.
 */
export type HostToWebviewMessage =
  | { type: "stream:token"; token: string }
  | { type: "stream:done" }
  | { type: "tool:confirm"; toolCall: ToolCall }
  | { type: "tool:executing"; toolCall: ToolCall }
  | { type: "tool:result"; toolCall: ToolCall; result: string }
  | { type: "tool:rejected"; toolCall: ToolCall }
  | { type: "config:loaded"; config: CappyConfig }
  | { type: "config:saved" }
  | { type: "mcp:tools"; tools: McpTool[] }
  | { type: "error"; message: string };

/**
 * Message sent from webview to extension host.
 */
export type WebviewToHostMessage =
  | { type: "chat:send"; messages: Message[] }
  | { type: "tool:approve"; toolCallId: string }
  | { type: "tool:reject"; toolCallId: string }
  | { type: "config:load" }
  | { type: "config:save"; config: CappyConfig }
  | { type: "mcp:list" };

/**
 * Creates a message bridge for a VS Code webview with AgentLoop integration.
 */
export function createWebviewBridge(panel: vscode.WebviewPanel): vscode.Disposable {
  const mcpManager = new McpManager();
  const agentLoop = new AgentLoop({
    onMcpCall: async (serverName, toolName, args) => mcpManager.callTool(serverName, toolName, args),
  });
  const tools = toolsRegistry as unknown as AgentTool[];
  const bridgeDisposables: vscode.Disposable[] = [];

  const streamTokenListener = (token: string) => {
    void postToWebview(panel, { type: "stream:token", token });
  };
  const streamDoneListener = () => {
    void postToWebview(panel, { type: "stream:done" });
  };
  const toolConfirmListener = (toolCall: ToolCall) => {
    void postToWebview(panel, { type: "tool:confirm", toolCall });
  };
  const toolExecutingListener = (toolCall: ToolCall) => {
    void postToWebview(panel, { type: "tool:executing", toolCall });
  };
  const toolResultListener = (toolCall: ToolCall, result: string) => {
    void postToWebview(panel, { type: "tool:result", toolCall, result });
  };
  const toolRejectedListener = (toolCall: ToolCall) => {
    void postToWebview(panel, { type: "tool:rejected", toolCall });
  };
  const errorListener = (error: Error) => {
    void postToWebview(panel, { type: "error", message: error.message });
  };

  agentLoop.on("stream:token", streamTokenListener);
  agentLoop.on("stream:done", streamDoneListener);
  agentLoop.on("tool:confirm", toolConfirmListener);
  agentLoop.on("tool:executing", toolExecutingListener);
  agentLoop.on("tool:result", toolResultListener);
  agentLoop.on("tool:rejected", toolRejectedListener);
  agentLoop.on("error", errorListener);

  bridgeDisposables.push(
    panel.webview.onDidReceiveMessage((raw: unknown) => {
      void handleWebviewMessage(raw, agentLoop, panel, tools, mcpManager);
    }),
  );

  bridgeDisposables.push(
    panel.onDidDispose(() => {
      agentLoop.off("stream:token", streamTokenListener);
      agentLoop.off("stream:done", streamDoneListener);
      agentLoop.off("tool:confirm", toolConfirmListener);
      agentLoop.off("tool:executing", toolExecutingListener);
      agentLoop.off("tool:result", toolResultListener);
      agentLoop.off("tool:rejected", toolRejectedListener);
      agentLoop.off("error", errorListener);
      void mcpManager.disconnect();
    }),
  );

  return vscode.Disposable.from(...bridgeDisposables);
}

/**
 * Handles one inbound webview message and forwards to the AgentLoop.
 */
async function handleWebviewMessage(
  raw: unknown,
  agentLoop: AgentLoop,
  panel: vscode.WebviewPanel,
  tools: AgentTool[],
  mcpManager: McpManager,
): Promise<void> {
  if (!isWebviewToHostMessage(raw)) {
    await postToWebview(panel, { type: "error", message: "Mensagem invalida recebida do webview." });
    return;
  }

  if (raw.type === "chat:send") {
    try {
      await agentLoop.run(raw.messages, tools, { mcpTools: mcpManager.listTools() });
    } catch {
      // The loop already emits a typed "error" event.
    }
    return;
  }

  if (raw.type === "tool:approve") {
    if (!agentLoop.approve(raw.toolCallId)) {
      await postToWebview(panel, {
        type: "error",
        message: `Confirmacao pendente nao encontrada: ${raw.toolCallId}`,
      });
    }
    return;
  }

  if (raw.type === "config:load") {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      await postToWebview(panel, { type: "error", message: "Nenhum workspace aberto para carregar configuracao." });
      return;
    }

    try {
      const config = await loadConfig(workspaceRoot);
      await mcpManager.connect(config.mcp.servers);
      await postToWebview(panel, { type: "config:loaded", config });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar configuracao.";
      await postToWebview(panel, { type: "error", message });
    }
    return;
  }

  if (raw.type === "config:save") {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      await postToWebview(panel, { type: "error", message: "Nenhum workspace aberto para salvar configuracao." });
      return;
    }

    try {
      await saveConfig(workspaceRoot, raw.config);
      await mcpManager.connect(raw.config.mcp.servers);
      await postToWebview(panel, { type: "config:saved" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar configuracao.";
      await postToWebview(panel, { type: "error", message });
    }
    return;
  }

  if (raw.type === "mcp:list") {
    await postToWebview(panel, {
      type: "mcp:tools",
      tools: mcpManager.listTools(),
    });
    return;
  }

  if (!agentLoop.reject(raw.toolCallId)) {
    await postToWebview(panel, {
      type: "error",
      message: `Confirmacao pendente nao encontrada: ${raw.toolCallId}`,
    });
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
    return Array.isArray(value.messages);
  }

  if (value.type === "tool:approve" || value.type === "tool:reject") {
    return typeof value.toolCallId === "string" && value.toolCallId.length > 0;
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
    typeof value.openrouter.maxTokens === "number" &&
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
  panel: vscode.WebviewPanel,
  message: HostToWebviewMessage,
): Promise<boolean> {
  return panel.webview.postMessage(message);
}
