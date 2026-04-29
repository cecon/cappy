import * as vscode from "vscode";
import type { ContextUsagePayload } from "../agent/contextBudget";
import { AgentLoop } from "../agent/loop";
import { BUILT_IN_PIPELINES, PipelineRunner } from "../agent/PipelineRunner";
import type { AgentTool, Message, PipelineDefinition, PlanStatePayload, ToolCall } from "../agent/types";
import {
  clearActivePlan,
  createActivePlan,
  getActivePlan,
  type Plan,
  replaceActivePlanSpec,
  resetSessionContext,
  updateActivePlanStatus,
} from "../agent/sessionContext";
import { generatePlanSpec, regeneratePlanSpec } from "../agent/plannerAgent";
import { loadAgentPreferences } from "../agent/agentPreferences";
import { type CappyConfig, loadConfig, saveConfig } from "../config";
import { McpManager, type McpTool } from "../mcp/client";
import { toolsRegistry } from "../tools";
import { type ChatUiMode, mcpToolsForChatMode, parseChatUiMode, selectToolsForChatMode } from "./chatMode";
import type { FileDiffPayload } from "../utils/fileDiffPayload";
import { logDebug, logError, logInfo, resetLoggerCache } from "../utils/logger";
import { debounce } from "../utils/debounce";
import { RagIndexer } from "../rag/RagIndexer";
import { setRagIndexer } from "../tools/ragSearchTool";
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
  | { type: "error"; message: string }
  /** Plan mode lifecycle: entered, content updated, or exited. */
  | { type: "plan:state"; active: boolean; filePath: string | null; content: string | null }
  /** Pipeline orchestration lifecycle events. */
  | { type: "pipeline:start"; pipeline: { id: string; name: string; stages: Array<{ id: string; name: string; requiresApproval?: boolean }> } }
  | { type: "pipeline:stage:start"; stageId: string; stageName: string; stageIndex: number; totalStages: number }
  | { type: "pipeline:stage:done"; stageId: string; stageIndex: number; totalStages: number }
  | { type: "pipeline:stage:approve"; stageId: string; stageName: string; stageIndex: number }
  | { type: "pipeline:done" }
  /** Send the list of built-in pipeline templates to the webview. */
  | { type: "pipeline:templates"; templates: Array<{ id: string; name: string; stageCount: number }> }
  /** Syncs the active plan state to the webview (null = no plan). */
  | { type: "plan:sync"; plan: Plan | null }
  /** Notifies the webview that plan generation is in progress. */
  | { type: "plan:generating" };

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
  | { type: "mcp:list" }
  /** Start a pipeline run with a named template and initial messages. */
  | { type: "pipeline:run"; pipelineId: string; messages: Message[]; mode?: ChatUiMode }
  /** Advance past a requiresApproval gate to the next pipeline stage. */
  | { type: "pipeline:advance" }
  /** Abort the running pipeline. */
  | { type: "pipeline:abort" }
  /** Request the list of available pipeline templates. */
  | { type: "pipeline:list" }
  /** Export the current conversation as a Markdown file. */
  | { type: "conversation:export"; markdown: string }
  /** Generate a new spec.md plan from a user intent. Fails if a plan already exists. */
  | { type: "plan:generate"; intent: string }
  /** Approve the active plan (status → approved). */
  | { type: "plan:approve" }
  /** Send the active plan back for review with a reason (status → failed). */
  | { type: "plan:review"; reason: string }
  /** Regenerate the spec after review, incorporating the review reason. */
  | { type: "plan:regen"; reason: string };

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
  const mcpCallHandler = async (serverName: string, toolName: string, args: Record<string, unknown>) =>
    mcpManager.callTool(serverName, toolName, args);
  const agentLoop = new AgentLoop({
    ...(workspaceRoot ? { workspaceRoot } : {}),
    onMcpCall: mcpCallHandler,
  });
  const pipelineRunner = new PipelineRunner();
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
  const planStateListener = (payload: PlanStatePayload) => {
    void postToWebview(webview, { type: "plan:state", ...payload });
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
  agentLoop.on("plan:state", planStateListener);
  agentLoop.on("error", errorListener);
  agentLoop.on("context:usage", contextUsageListener);

  // ── PipelineRunner listeners ──────────────────────────────────────────────
  pipelineRunner.on("pipeline:start", (pipeline) => {
    void postToWebview(webview, {
      type: "pipeline:start",
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        stages: pipeline.stages.map((s) => {
          const stageInfo: { id: string; name: string; requiresApproval?: boolean } = { id: s.id, name: s.name };
          if (s.requiresApproval !== undefined) stageInfo.requiresApproval = s.requiresApproval;
          return stageInfo;
        }),
      },
    });
  });
  pipelineRunner.on("pipeline:stage:start", (stage, index, total) => {
    void postToWebview(webview, {
      type: "pipeline:stage:start",
      stageId: stage.id,
      stageName: stage.name,
      stageIndex: index,
      totalStages: total,
    });
  });
  pipelineRunner.on("pipeline:stage:done", (stage, index, total) => {
    void postToWebview(webview, {
      type: "pipeline:stage:done",
      stageId: stage.id,
      stageIndex: index,
      totalStages: total,
    });
  });
  pipelineRunner.on("pipeline:stage:approve", (stage, index) => {
    void postToWebview(webview, {
      type: "pipeline:stage:approve",
      stageId: stage.id,
      stageName: stage.name,
      stageIndex: index,
    });
  });
  pipelineRunner.on("pipeline:done", () => {
    void postToWebview(webview, { type: "pipeline:done" });
    void postToWebview(webview, { type: "stream:done" });
  });
  // Pipeline forwards the same AgentLoop events to the webview
  pipelineRunner.on("stream:token", streamTokenListener);
  pipelineRunner.on("stream:done", streamDoneListener);
  pipelineRunner.on("stream:system", streamSystemListener);
  pipelineRunner.on("tool:confirm", toolConfirmListener);
  pipelineRunner.on("tool:executing", toolExecutingListener);
  pipelineRunner.on("tool:result", toolResultListener);
  pipelineRunner.on("tool:rejected", toolRejectedListener);
  pipelineRunner.on("plan:state", planStateListener);
  pipelineRunner.on("error", errorListener);
  pipelineRunner.on("context:usage", contextUsageListener);

  void pushHitlPolicyToWebview(webview, workspaceRoot, hitlUiSessionState);

  // ── RAG indexer (background, only when enabled) ───────────────────────────
  if (workspaceRoot) {
    void loadConfig().then((config) => {
      const ragCfg = config.rag;
      if (!ragCfg?.enabled) return;

      const ragIndexer = new RagIndexer(workspaceRoot, ragCfg, config.openrouter.apiKey);
      setRagIndexer(ragIndexer);

      process.env.CAPPY_RAG_MODEL = ragCfg.embeddingModel;
      process.env.CAPPY_RAG_DIMS = String(ragCfg.dimensions);

      void ragIndexer.indexAll();

      const exts = ragCfg.includeExtensions.map((e) => e.replace(/^\./u, "")).join(",");
      const fileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, `**/*.{${exts}}`),
      );
      fileWatcher.onDidChange((uri) => { void ragIndexer.indexFile(uri.fsPath); });
      fileWatcher.onDidCreate((uri) => { void ragIndexer.indexFile(uri.fsPath); });
      fileWatcher.onDidDelete((uri) => { void ragIndexer.removeFile(uri.fsPath); });

      const gitWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, ".git/{HEAD,index}"),
      );
      const onGitChange = debounce(() => { void ragIndexer.indexAll(); }, 2000);
      gitWatcher.onDidChange(onGitChange);
      gitWatcher.onDidCreate(onGitChange);

      bridgeDisposables.push(fileWatcher, gitWatcher, new vscode.Disposable(() => ragIndexer.dispose()));
    });
  }

  bridgeDisposables.push(
    webview.onDidReceiveMessage((raw: unknown) => {
      void handleWebviewMessage(raw, agentLoop, pipelineRunner, webview, tools, mcpManager, options, workspaceRoot, hitlUiSessionState);
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
      agentLoop.off("plan:state", planStateListener);
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
 * Handles one inbound webview message and forwards to the AgentLoop or PipelineRunner.
 */
async function handleWebviewMessage(
  raw: unknown,
  agentLoop: AgentLoop,
  pipelineRunner: PipelineRunner,
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

  if (raw.type === "pipeline:run") {
    const pipeline = BUILT_IN_PIPELINES.find((p) => p.id === raw.pipelineId);
    if (!pipeline) {
      await postToWebview(webview, { type: "error", message: `Pipeline desconhecido: ${raw.pipelineId}` });
      return;
    }
    try {
      const toolsForRun = selectToolsForChatMode("agent", tools);
      const mcpList = mcpManager.listTools();
      logInfo(`pipeline:run received | pipelineId=${raw.pipelineId} msgs=${raw.messages.length}`);
      const pipelineRunOpts: import("../agent/PipelineRunner").PipelineRunOptions = { tools: toolsForRun, mcpTools: mcpToolsForChatMode("agent", mcpList) };
      if (workspaceRoot !== undefined) pipelineRunOpts.workspaceRoot = workspaceRoot;
      pipelineRunOpts.onMcpCall = async (serverName, toolName, args) => mcpManager.callTool(serverName, toolName, args);
      await pipelineRunner.run(pipeline, raw.messages, pipelineRunOpts);
    } catch (err) {
      logError(`Pipeline error in bridge: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  if (raw.type === "pipeline:advance") {
    pipelineRunner.advance();
    return;
  }

  if (raw.type === "pipeline:abort") {
    pipelineRunner.abort();
    return;
  }

  if (raw.type === "pipeline:list") {
    await postToWebview(webview, {
      type: "pipeline:templates",
      templates: BUILT_IN_PIPELINES.map((p) => ({ id: p.id, name: p.name, stageCount: p.stages.length })),
    });
    return;
  }

  if (raw.type === "chat:stop") {
    logInfo("chat:stop received, aborting agent loop and pipeline");
    agentLoop.abort();
    pipelineRunner.abort();
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
    const ok = agentLoop.approve(raw.toolCallId) || pipelineRunner.approve(raw.toolCallId);
    if (!ok) {
      await postToWebview(webview, {
        type: "error",
        message: `Confirmacao pendente nao encontrada: ${raw.toolCallId}`,
      });
    }
    return;
  }

  if (raw.type === "hitl:approveSession") {
    const ok = agentLoop.approveSessionAutoDestructive(raw.toolCallId) ||
      pipelineRunner.approveSessionAutoDestructive(raw.toolCallId);
    if (!ok) {
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
      const ok = await agentLoop.persistAllowAllDestructive(raw.toolCallId) ||
        await pipelineRunner.persistAllowAllDestructive(raw.toolCallId);
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

  if (raw.type === "plan:generate") {
    const existingPlan = getActivePlan();
    if (existingPlan !== null) {
      await postToWebview(webview, {
        type: "error",
        message: "Já existe um plano ativo nesta sessão. Aprove ou revise o plano atual antes de gerar um novo.",
      });
      return;
    }
    await postToWebview(webview, { type: "plan:generating" });
    try {
      const config = await loadConfig();
      const specMd = await generatePlanSpec(raw.intent, config);
      const plan = createActivePlan(specMd);
      await postToWebview(webview, { type: "plan:sync", plan });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gerar o plano.";
      await postToWebview(webview, { type: "error", message });
    }
    return;
  }

  if (raw.type === "plan:approve") {
    try {
      const plan = updateActivePlanStatus("approved");
      await postToWebview(webview, { type: "plan:sync", plan });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao aprovar o plano.";
      await postToWebview(webview, { type: "error", message });
    }
    return;
  }

  if (raw.type === "plan:review") {
    try {
      const plan = updateActivePlanStatus("failed");
      await postToWebview(webview, { type: "plan:sync", plan });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar revisão do plano.";
      await postToWebview(webview, { type: "error", message });
    }
    return;
  }

  if (raw.type === "plan:regen") {
    const currentPlan = getActivePlan();
    if (currentPlan === null) {
      await postToWebview(webview, { type: "error", message: "Nenhum plano ativo para regenerar." });
      return;
    }
    await postToWebview(webview, { type: "plan:generating" });
    try {
      const config = await loadConfig();
      const newSpecMd = await regeneratePlanSpec(currentPlan.specMd, raw.reason, config);
      clearActivePlan();
      const plan = createActivePlan(newSpecMd);
      await postToWebview(webview, { type: "plan:sync", plan });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao regenerar o plano.";
      await postToWebview(webview, { type: "error", message });
    }
    return;
  }

  if (raw.type === "conversation:export") {
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/gu, "-");
    const defaultName = `cappy-${ts}.md`;
    const folder = vscode.workspace.workspaceFolders?.[0];
    const saveOptions: vscode.SaveDialogOptions = { filters: { Markdown: ["md"] }, title: "Exportar conversa como Markdown" };
    if (folder) saveOptions.defaultUri = vscode.Uri.joinPath(folder.uri, defaultName);
    const uri = await vscode.window.showSaveDialog(saveOptions);
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(raw.markdown, "utf-8"));
      void vscode.window.showInformationMessage(`Conversa exportada: ${uri.fsPath}`);
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

  if (value.type === "pipeline:run") {
    return typeof value.pipelineId === "string" && Array.isArray(value.messages);
  }

  if (value.type === "pipeline:advance" || value.type === "pipeline:abort" || value.type === "pipeline:list") {
    return true;
  }

  if (value.type === "conversation:export") {
    return typeof value.markdown === "string";
  }

  if (value.type === "plan:generate") {
    return typeof value.intent === "string" && value.intent.trim().length > 0;
  }

  if (value.type === "plan:approve") {
    return true;
  }

  if (value.type === "plan:review") {
    return typeof value.reason === "string" && value.reason.trim().length > 0;
  }

  if (value.type === "plan:regen") {
    return typeof value.reason === "string" && value.reason.trim().length > 0;
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
