/**
 * Composition Root — wires all adapters, services and use cases together.
 * This is the ONLY file that instantiates concrete implementations.
 * extension.ts calls createCappyBridge(); everything else uses interfaces.
 */

import * as vscode from "vscode";

import { RunAgentUseCase, type AgentTool } from "./application/usecases/RunAgentUseCase";
import { OpenRouterAdapter } from "./adapters/llm/OpenRouterAdapter";
import { JsonConfigAdapter } from "./adapters/config/JsonConfigAdapter";
import { SessionContext } from "./domain/entities/SessionContext";
import type { CappyConfig, ChatUiMode } from "./domain/entities/AgentConfig";
import type { ILogger } from "./domain/ports/ILogger";
import { toolsRegistry } from "./tools/index";
import { McpManager } from "./mcp/client";
import { loadWorkspaceSkillsPrompt } from "./agent/workspaceSkills";
import { routeAgentEvent } from "./bridge/AgentEventRouter";
import { logError, logInfo, resetLoggerCache } from "./utils/logger";
import { debounce } from "./utils/debounce";
import { RagIndexer } from "./rag/RagIndexer";
import { setRagIndexer } from "./tools/ragSearchTool";
import { MemoryStore, setMemoryStore } from "./memory/MemoryStore";
import { GsdStateStore, setGsdStateStore } from "./gsd/GsdStateStore";
import { GsdDispatchBuilder, setGsdDispatchBuilder } from "./gsd/GsdDispatchBuilder";

// ── VS Code logger adapter ─────────────────────────────────────────────────

class VsCodeLogger implements ILogger {
  info(msg: string): void { logInfo(msg); }
  warn(msg: string): void { logInfo(`[WARN] ${msg}`); }
  error(msg: string, cause?: unknown): void { logError(`${msg}${cause ? ` — ${String(cause)}` : ""}`); }
  debug(msg: string): void { logInfo(`[DEBUG] ${msg}`); }
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface CappyBridgeOptions {
  onNewSession?: () => Promise<void>;
}

/**
 * Creates and wires a complete Cappy session for one webview instance.
 * Returns VS Code Disposables that clean up all resources on dispose.
 */
export function createCappyBridge(
  webview: vscode.Webview,
  options?: CappyBridgeOptions,
): vscode.Disposable[] {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) process.env.CAPPY_WORKSPACE_ROOT = workspaceRoot;

  const logger = new VsCodeLogger();
  const configRepo = new JsonConfigAdapter();
  const llm = new OpenRouterAdapter(""); // API key refreshed on each run
  const session = new SessionContext();
  const mcpManager = new McpManager();

  const agent = new RunAgentUseCase({ llm, configRepo, session, logger, ...(workspaceRoot !== undefined ? { workspaceRoot } : {}) });
  const tools = toolsRegistry as unknown as AgentTool[];
  const hitlState = { sessionAutoApprove: false };
  const disposables: vscode.Disposable[] = [];

  // ── Memory Store (always initialised when workspace is open) ────────────
  if (workspaceRoot) {
    const memoryStore = new MemoryStore();
    setMemoryStore(memoryStore);
    void memoryStore.ensureDefaults(workspaceRoot);

    const gsdStore = new GsdStateStore();
    setGsdStateStore(gsdStore);
    const gsdDispatch = new GsdDispatchBuilder(gsdStore);
    setGsdDispatchBuilder(gsdDispatch);
  }

  // ── RAG indexer (background, only when enabled) ──────────────────────────
  void configRepo.loadConfig().then((config) => {
    const ragCfg = config.rag;
    if (workspaceRoot && ragCfg?.enabled) {
      const apiKey = config.openrouter.apiKey;
      const ragIndexer = new RagIndexer(workspaceRoot, ragCfg, apiKey);
      setRagIndexer(ragIndexer);

      // Expose model/dims to the tool via env (avoids circular imports).
      process.env.CAPPY_RAG_MODEL = ragCfg.embeddingModel;
      process.env.CAPPY_RAG_DIMS = String(ragCfg.dimensions);

      // Full scan in background — does not block UI.
      void ragIndexer.indexAll();

      // Incremental updates on file save/create/delete.
      const exts = ragCfg.includeExtensions.map((e) => e.replace(/^\./u, "")).join(",");
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, `**/*.{${exts}}`),
      );
      watcher.onDidChange((uri) => { void ragIndexer.indexFile(uri.fsPath); });
      watcher.onDidCreate((uri) => { void ragIndexer.indexFile(uri.fsPath); });
      watcher.onDidDelete((uri) => { void ragIndexer.removeFile(uri.fsPath); });

      // Re-index after git operations (merge, checkout, rebase, pull).
      // .git/index changes on every commit/merge/checkout; HEAD changes on branch switch.
      // Both together cover all cases that bulk-modify workspace files.
      const gitWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, ".git/{HEAD,index}"),
      );
      const onGitChange = debounce(() => { void ragIndexer.indexAll(); }, 2000);
      gitWatcher.onDidChange(onGitChange);
      gitWatcher.onDidCreate(onGitChange);

      disposables.push(watcher, gitWatcher, new vscode.Disposable(() => ragIndexer.dispose()));
    }
  });

  void loadAndPushHitlPolicy(webview, configRepo, workspaceRoot, hitlState);

  disposables.push(
    webview.onDidReceiveMessage((raw: unknown) => {
      void handleMessage(raw, webview, agent, llm, configRepo, mcpManager, session, logger, tools, workspaceRoot, hitlState, options);
    }),
  );

  disposables.push(new vscode.Disposable(() => {
    void mcpManager.disconnect();
    session.reset();
  }));

  return disposables;
}

// ── Inbound message handler ────────────────────────────────────────────────

async function handleMessage(
  raw: unknown,
  webview: vscode.Webview,
  agent: RunAgentUseCase,
  llm: OpenRouterAdapter,
  configRepo: JsonConfigAdapter,
  mcpManager: McpManager,
  session: SessionContext,
  logger: ILogger,
  tools: AgentTool[],
  workspaceRoot: string | undefined,
  hitlState: { sessionAutoApprove: boolean },
  options: CappyBridgeOptions | undefined,
): Promise<void> {
  if (!isRecord(raw) || typeof raw.type !== "string") {
    post(webview, { type: "error", message: "Mensagem inválida recebida do webview." });
    return;
  }

  const msg = raw;

  switch (msg.type) {
    case "chat:send":
      await handleChatSend(msg, webview, agent, llm, configRepo, mcpManager, tools);
      break;
    case "chat:stop":
      agent.abortRun();
      break;
    case "session:new":
      agent.abortRun();
      setTimeout(() => void (options?.onNewSession?.() ?? vscode.commands.executeCommand("cappy.clearChat")), 0);
      break;
    case "tool:approve":
      if (typeof msg.toolCallId === "string" && !agent.approve(msg.toolCallId))
        post(webview, { type: "error", message: `Confirmação não encontrada: ${String(msg.toolCallId)}` });
      break;
    case "hitl:approveSession":
      if (typeof msg.toolCallId === "string") {
        agent.approve(msg.toolCallId);
        hitlState.sessionAutoApprove = true;
        await loadAndPushHitlPolicy(webview, configRepo, workspaceRoot, hitlState);
      }
      break;
    case "hitl:approvePersist":
      if (typeof msg.toolCallId === "string") {
        if (!workspaceRoot) { post(webview, { type: "error", message: "Nenhum workspace aberto." }); return; }
        agent.approve(msg.toolCallId);
        hitlState.sessionAutoApprove = true;
        await configRepo.savePreferences(workspaceRoot, { version: 1, hitl: { destructiveTools: "allow_all" } });
        await loadAndPushHitlPolicy(webview, configRepo, workspaceRoot, hitlState);
      }
      break;
    case "tool:reject":
      if (typeof msg.toolCallId === "string") agent.reject(msg.toolCallId);
      break;
    case "config:load": {
      const config = await configRepo.loadConfig();
      llm.updateApiKey(config.openrouter.apiKey);
      await mcpManager.connect(config.mcp.servers);
      post(webview, { type: "config:loaded", config });
      await loadAndPushHitlPolicy(webview, configRepo, workspaceRoot, hitlState);
      break;
    }
    case "config:save":
      if (isRecord(msg.config)) {
        const config = msg.config as unknown as CappyConfig;
        await configRepo.saveConfig(config);
        resetLoggerCache();
        llm.updateApiKey(config.openrouter.apiKey);
        await mcpManager.connect(config.mcp.servers);
        post(webview, { type: "config:saved" });
      }
      break;
    case "mcp:list":
      post(webview, { type: "mcp:tools", tools: mcpManager.listTools() });
      break;
    case "file:open":
      if (typeof msg.path === "string") await openFile(webview, msg.path);
      break;
  }
}

// ── chat:send handler ──────────────────────────────────────────────────────

async function handleChatSend(
  msg: Record<string, unknown>,
  webview: vscode.Webview,
  agent: RunAgentUseCase,
  llm: OpenRouterAdapter,
  configRepo: JsonConfigAdapter,
  mcpManager: McpManager,
  tools: AgentTool[],
): Promise<void> {
  try {
    const mode = parseChatMode(msg.mode);
    const messages = Array.isArray(msg.messages)
      ? (msg.messages as import("./domain/entities/Message").Message[])
      : [];
    const config = await configRepo.loadConfig();
    llm.updateApiKey(config.openrouter.apiKey);
    const skillsPrompt = await loadWorkspaceSkillsPrompt(process.env.CAPPY_WORKSPACE_ROOT ?? process.cwd());
    const mcpTools = mode === "agent" ? mcpManager.listTools() : [];
    const filteredTools = filterByMode(mode, tools);
    const mergedTools: AgentTool[] = [
      ...filteredTools,
      ...mcpTools.map((m) => ({
        name: `${m.serverName}/${m.name}`,
        description: m.description,
        parameters: m.inputSchema,
        execute: async (p: Record<string, unknown>) => mcpManager.callTool(m.serverName, m.name, p),
      })),
    ];
    // Inject the active agent's system prompt so role-specific behaviour
    // (including the Strategist chain-of-thought) is enforced on every run.
    const agentSystemPrompt = config.agent.systemPrompt?.trim() || undefined;
    logInfo(`chat:send | mode=${mode} msgs=${messages.length} tools=${mergedTools.length} agent=${config.agent.activeAgent}`);
    await agent.run(
      messages, mergedTools,
      {
        messages,
        chatMode: mode,
        workspaceSkillsPrompt: skillsPrompt,
        ...(agentSystemPrompt !== undefined ? { systemPromptPrefix: agentSystemPrompt } : {}),
      },
      (event) => routeAgentEvent(event, webview, new VsCodeLogger()),
    );
  } catch (err) {
    logError(`chat:send error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Pure helpers ───────────────────────────────────────────────────────────

async function loadAndPushHitlPolicy(
  webview: vscode.Webview,
  configRepo: JsonConfigAdapter,
  workspaceRoot: string | undefined,
  hitlState: { sessionAutoApprove: boolean },
): Promise<void> {
  const prefs = workspaceRoot ? await configRepo.loadPreferences(workspaceRoot) : null;
  post(webview, {
    type: "hitl:policy",
    destructiveTools: prefs?.hitl.destructiveTools ?? "confirm_each",
    sessionAutoApproveDestructive: hitlState.sessionAutoApprove,
  });
}

async function openFile(webview: vscode.Webview, relativePath: string): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) { post(webview, { type: "error", message: "Abra um workspace primeiro." }); return; }
  const segs = relativePath.replace(/\\/gu, "/").trim().split("/").filter((s) => s && !s.includes(".."));
  let uri = folder.uri;
  for (const s of segs) uri = vscode.Uri.joinPath(uri, s);
  try { await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri), { preview: false }); }
  catch (e) { post(webview, { type: "error", message: e instanceof Error ? e.message : "Erro ao abrir ficheiro." }); }
}

const ASK_ALLOWED = new Set(["ExploreAgent","Read","readFile","Grep","Glob","globFiles","listDir","searchCode","ragSearch","webFetch","WebSearch","TodoWrite","ListSkills","ReadSkill","MemoryList","MemoryRead","EnterPlanMode","ExitPlanMode"]);

function filterByMode(mode: ChatUiMode, tools: AgentTool[]): AgentTool[] {
  if (mode === "plain") return [];
  if (mode === "agent") return tools;
  return tools.filter((t) => ASK_ALLOWED.has(t.name));
}

function parseChatMode(v: unknown): ChatUiMode {
  return v === "plain" || v === "agent" || v === "ask" ? v : "agent";
}

function post(webview: vscode.Webview, m: Record<string, unknown>): void { void webview.postMessage(m); }
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }

