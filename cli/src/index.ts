/**
 * Cappy CLI — entry point
 *
 * Uso:
 *   cappy "explica o arquivo src/index.ts"
 *   cappy --mode ask "quais funções existem em loop.ts?"
 *   cappy --allow-all "refatora o arquivo utils.ts"
 *   cappy --workspace /caminho/do/projeto "analisa o projeto"
 *
 * Lê de stdin quando não há prompt nos args:
 *   echo "explica o projeto" | cappy
 *   cappy  (modo interativo: REPL básico)
 */

import * as readline from "node:readline";
import * as path from "node:path";
import * as fs from "node:fs";

// Re-exporta os módulos do pacote extension diretamente por caminho relativo.
// O esbuild faz bundle de tudo, eliminando a necessidade de instalar o pacote.
import { AgentLoop } from "../../extension/src/agent/loop.js";
import { toolsRegistry } from "../../extension/src/tools/index.js";
import { loadConfig } from "../../extension/src/config/index.js";
import { resetSessionContext } from "../../extension/src/agent/sessionContext.js";

import { CliRenderer } from "./CliRenderer.js";
import { CliHitl, type HitlPolicy } from "./CliHitl.js";
import { c, BOLD, CYAN, GRAY, GREEN, RED, YELLOW } from "./cliColors.js";
import { runInit } from "./cliInit.js";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type ChatMode = "agent" | "ask" | "plain";

interface CliOptions {
  prompt: string | null; // null = modo REPL / stdin
  mode: ChatMode;
  hitlPolicy: HitlPolicy;
  workspaceRoot: string;
  maxIterations: number | undefined;
  showVersion: boolean;
  showHelp: boolean;
  noColor: boolean;
}

// ─── Parse de argumentos ───────────────────────────────────────────────────────

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2); // remove 'node' e caminho do script
  const opts: CliOptions = {
    prompt: null,
    mode: "agent",
    hitlPolicy: "confirm_each",
    workspaceRoot: process.cwd(),
    maxIterations: undefined,
    showVersion: false,
    showHelp: false,
    noColor: Boolean(process.env.NO_COLOR) || !process.stdout.isTTY,
  };

  const promptParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "-v" || arg === "--version") {
      opts.showVersion = true;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      opts.showHelp = true;
      continue;
    }
    if (arg === "--allow-all" || arg === "--yes") {
      opts.hitlPolicy = "allow_all";
      continue;
    }
    if (arg === "--deny-all" || arg === "--no") {
      opts.hitlPolicy = "deny_all";
      continue;
    }
    if (arg === "--no-color") {
      opts.noColor = true;
      continue;
    }
    if (arg === "--mode" || arg === "-m") {
      const val = args[++i];
      if (val === "agent" || val === "ask" || val === "plain") {
        opts.mode = val;
      } else {
        process.stderr.write(`Modo inválido: ${val ?? ""}. Use: agent | ask | plain\n`);
        process.exit(1);
      }
      continue;
    }
    if (arg === "--workspace" || arg === "-w") {
      const val = args[++i];
      if (!val) {
        process.stderr.write("--workspace requer um caminho.\n");
        process.exit(1);
      }
      opts.workspaceRoot = path.resolve(val);
      continue;
    }
    if (arg === "--max-iterations" || arg === "--max") {
      const val = parseInt(args[++i] ?? "", 10);
      if (isNaN(val) || val < 1) {
        process.stderr.write("--max-iterations requer um número positivo.\n");
        process.exit(1);
      }
      opts.maxIterations = val;
      continue;
    }
    // Argumento posicional = parte do prompt
    promptParts.push(arg);
  }

  if (promptParts.length > 0) {
    opts.prompt = promptParts.join(" ");
  }

  return opts;
}

// ─── Helpers de I/O ────────────────────────────────────────────────────────────

function printBanner(version: string): void {
  process.stderr.write(
    `\n${c(BOLD + CYAN, "🤖 Cappy CLI")} ${c(GRAY, `v${version}`)}\n` +
      `${c(GRAY, "Agente de IA autônomo para o terminal")}\n` +
      `${c(GRAY, "Workspace:")} ${c(BOLD, process.cwd())}\n\n`,
  );
}

function printHelp(): void {
  process.stderr.write(`
${c(BOLD + CYAN, "Cappy CLI")} — agente de IA autônomo no terminal

${c(BOLD, "USO")}
  cappy init             # configuração inicial interativa
  cappy [opções] [prompt]
  echo "prompt" | cappy [opções]
  cappy [opções]         # modo REPL interativo

${c(BOLD, "COMANDOS")}
  ${c(CYAN, "init")}                    Guia de setup: API Key, modelo, detecção de stack

${c(BOLD, "OPÇÕES")}
  ${c(CYAN, "-m, --mode <modo>")}       Modo do agente: ${c(GREEN, "agent")} (padrão) | ${c(YELLOW, "ask")} | plain
  ${c(CYAN, "-w, --workspace <dir>")}   Diretório raiz do workspace (padrão: cwd)
  ${c(CYAN, "--allow-all")}             Aprova automaticamente todas as tools destrutivas
  ${c(CYAN, "--deny-all")}              Nega automaticamente todas as tools destrutivas
  ${c(CYAN, "--max-iterations <n>")}    Limite de rodadas do agente por mensagem
  ${c(CYAN, "--no-color")}              Desativa cores ANSI
  ${c(CYAN, "-v, --version")}           Exibe a versão
  ${c(CYAN, "-h, --help")}              Exibe esta ajuda

${c(BOLD, "EXEMPLOS")}
  cappy init
  cappy "explica o arquivo src/index.ts"
  cappy --mode ask "quais funções existem?"
  cappy --allow-all "refatora utils.ts removendo duplicatas"
  cappy --workspace ~/projetos/meu-app "analisa o projeto"
  echo "lista os arquivos TypeScript" | cappy
  cappy   # abre o REPL interativo

${c(BOLD, "CONFIGURAÇÃO")}
  O Cappy lê ${c(CYAN, "~/.cappy/config.json")} (criado automaticamente).
  Execute ${c(CYAN, "cappy init")} para configurar de forma guiada.

`);
}

function printVersion(): void {
  const pkgPath = new URL("../../cli/package.json", import.meta.url);
  try {
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version: string };
    process.stdout.write(`${pkg.version}\n`);
  } catch {
    process.stdout.write("0.1.0\n");
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk as string;
    });
    process.stdin.on("end", () => resolve(data.trim()));
    // timeout de segurança: se stdin não fechar em 100ms e não tiver dados, continua
    setTimeout(() => {
      if (data.length === 0) resolve("");
    }, 100);
  });
}

// ─── Runner de uma mensagem ────────────────────────────────────────────────────

type Message = { role: "user" | "assistant" | "tool"; content: string };

interface RunOnceOptions {
  loop: AgentLoop;
  renderer: CliRenderer;
  hitl: CliHitl;
  history: Message[];
  userPrompt: string;
  mode: ChatMode;
  maxIterations: number | undefined;
}

async function runOnce(opts: RunOnceOptions): Promise<void> {
  const { loop, renderer, hitl, history, userPrompt, mode, maxIterations } = opts;

  history.push({ role: "user", content: userPrompt });

  // Escuta eventos
  loop.on("stream:token", (token) => renderer.onToken(token));
  loop.on("stream:done", () => renderer.onDone());
  loop.on("stream:system", (msg) => renderer.onSystemMessage(msg));
  loop.on("context:usage", (payload) =>
    renderer.onContextUsage(payload.usedTokens, payload.limitTokens, payload.didTrimForApi),
  );
  loop.on("tool:executing", (tc) => renderer.onToolExecuting(tc.name, tc.arguments));
  loop.on("tool:result", (tc, result) => renderer.onToolResult(tc.name, result));
  loop.on("tool:rejected", (tc) => renderer.onToolRejected(tc.name));
  loop.on("error", (err) => renderer.onError(err));

  // HITL: intercepta confirmação de tools destrutivas
  loop.on("tool:confirm", async (tc) => {
    const approved = await hitl.confirm(tc.name, tc.arguments);
    if (approved) {
      loop.approve(tc.id);
    } else {
      loop.reject(tc.id);
    }
  });

  renderer.startThinking();

  // Filtra tools por modo
  const tools = filterToolsByMode(toolsRegistry, mode);

  try {
    const updatedHistory = await loop.run(history as Parameters<typeof loop.run>[0], tools, {
      chatMode: mode,
      maxLlmRounds: maxIterations,
    });

    // Atualiza o histórico da sessão com as novas mensagens
    history.length = 0;
    history.push(...(updatedHistory as Message[]));
  } catch (err) {
    renderer.onError(err instanceof Error ? err : new Error(String(err)));
  }

  // Remove listeners para evitar acúmulo no REPL
  loop.removeAllListeners();
}

// ─── Filtragem de tools por modo ──────────────────────────────────────────────

const DESTRUCTIVE_TOOL_NAMES = new Set([
  "writeFile", "Write", "runTerminal", "Bash", "Edit",
  "MemoryWrite", "MemoryDelete",
  "TodoWrite", "EnterPlanMode", "ExitPlanMode",
]);

function filterToolsByMode(
  tools: typeof toolsRegistry,
  mode: ChatMode,
): typeof toolsRegistry {
  if (mode === "plain") return []; // sem ferramentas
  if (mode === "ask") {
    return tools.filter((t) => !DESTRUCTIVE_TOOL_NAMES.has(t.name));
  }
  return tools; // agent: todas as ferramentas
}

// ─── REPL interativo ───────────────────────────────────────────────────────────

async function startRepl(
  opts: Omit<RunOnceOptions, "history" | "userPrompt" | "loop">,
  workspaceRoot: string,
): Promise<void> {
  const history: Message[] = [];

  process.stderr.write(
    `${c(GRAY, "Modo REPL interativo. Digite sua mensagem e pressione Enter.")}\n` +
      `${c(GRAY, "Comandos: /sair | /limpar | /modo <agent|ask|plain> | /ajuda")}\n\n`,
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: true,
    prompt: `${c(BOLD + GREEN, "você")}${c(GRAY, " › ")}`,
  });

  let currentMode = opts.mode;

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      continue;
    }

    // Comandos internos
    if (input === "/sair" || input === "/exit" || input === "/q") {
      process.stderr.write(c(GRAY, "\nAté mais! 👋\n"));
      break;
    }

    if (input === "/limpar" || input === "/clear") {
      history.length = 0;
      resetSessionContext();
      process.stderr.write(c(GRAY, "Histórico limpo.\n\n"));
      rl.prompt();
      continue;
    }

    if (input === "/ajuda" || input === "/help") {
      process.stderr.write(
        `\n${c(BOLD, "Comandos disponíveis:")}\n` +
          `  ${c(CYAN, "/sair")}          encerra o REPL\n` +
          `  ${c(CYAN, "/limpar")}        limpa o histórico\n` +
          `  ${c(CYAN, "/modo <modo>")}   muda o modo (agent | ask | plain)\n` +
          `  ${c(CYAN, "/ajuda")}         exibe esta ajuda\n\n`,
      );
      rl.prompt();
      continue;
    }

    const modeMatch = input.match(/^\/modo\s+(agent|ask|plain)$/);
    if (modeMatch) {
      currentMode = modeMatch[1] as ChatMode;
      process.stderr.write(c(GREEN, `Modo alterado para: ${currentMode}\n\n`));
      rl.prompt();
      continue;
    }

    const loop = new AgentLoop({ workspaceRoot });

    // Ctrl+C durante uma rodada aborta o agente em vez de matar o processo
    let aborted = false;
    const sigintHandler = () => {
      if (!aborted) {
        aborted = true;
        process.stderr.write(c(YELLOW, "\n⚠  Abortando...") + "\n");
        loop.abort();
      }
    };
    process.on("SIGINT", sigintHandler);
    try {
      await runOnce({ ...opts, loop, history, userPrompt: input, mode: currentMode });
    } finally {
      process.off("SIGINT", sigintHandler);
    }

    rl.prompt();
  }

  rl.close();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (process.argv[2] === "init") {
    await runInit();
    return;
  }

  const opts = parseArgs(process.argv);

  if (opts.showVersion) {
    printVersion();
    return;
  }

  if (opts.showHelp) {
    printHelp();
    return;
  }

  // Valida workspace
  if (!fs.existsSync(opts.workspaceRoot)) {
    process.stderr.write(
      `${c(RED, "✗")} Workspace não encontrado: ${opts.workspaceRoot}\n`,
    );
    process.exit(1);
  }

  // Define CAPPY_WORKSPACE_ROOT para que getWorkspaceRoot() funcione nas tools
  process.env.CAPPY_WORKSPACE_ROOT = opts.workspaceRoot;

  // Valida configuração (API key)
  let config;
  try {
    config = await loadConfig();
  } catch (err) {
    process.stderr.write(
      `${c(RED, "✗ Erro ao carregar config:")} ${(err as Error).message}\n`,
    );
    process.exit(1);
  }

  if (!config.openrouter.apiKey || config.openrouter.apiKey.trim().length === 0) {
    process.stderr.write(
      `${c(RED + BOLD, "✗ API Key não configurada!")}\n\n` +
        `Edite ${c(CYAN, "~/.cappy/config.json")} e defina:\n` +
        `  ${c(GRAY, '"openrouter": { "apiKey": "sk-or-..." }')}\n\n` +
        `Obtenha sua chave em: ${c(CYAN, "https://openrouter.ai/keys")}\n`,
    );
    process.exit(1);
  }

  printBanner("0.1.0");

  const renderer = new CliRenderer();
  const hitl = new CliHitl(opts.hitlPolicy);

  const runnerOpts = {
    renderer,
    hitl,
    mode: opts.mode,
    maxIterations: opts.maxIterations,
  };

  // ── Modo single-shot: prompt passado via args ──────────────────────────────
  if (opts.prompt) {
    const loop = new AgentLoop({ workspaceRoot: opts.workspaceRoot });
    await runOnce({
      ...runnerOpts,
      loop,
      history: [],
      userPrompt: opts.prompt,
    });
    return;
  }

  // ── Modo stdin: prompt via pipe ─────────────────────────────────────────────
  if (!process.stdin.isTTY) {
    const stdinPrompt = await readStdin();
    if (stdinPrompt.length === 0) {
      process.stderr.write(c(YELLOW, "⚠  Nenhum prompt recebido via stdin.\n"));
      process.exit(0);
    }
    const loop = new AgentLoop({ workspaceRoot: opts.workspaceRoot });
    await runOnce({
      ...runnerOpts,
      loop,
      history: [],
      userPrompt: stdinPrompt,
    });
    return;
  }

  // ── Modo REPL: terminal interativo ─────────────────────────────────────────
  await startRepl(runnerOpts, opts.workspaceRoot);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `\x1b[31m✗ Erro inesperado:\x1b[0m ${(err as Error).message ?? String(err)}\n`,
  );
  process.exit(1);
});
