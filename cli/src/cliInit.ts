import * as readline from "node:readline";
import * as path from "node:path";
import * as fs from "node:fs";
import { defaultConfig, loadConfig, saveConfig } from "../../extension/src/config/index.js";
import { c, BOLD, CYAN, GRAY, GREEN, RED, YELLOW } from "./cliColors.js";

function detectStack(dir: string): string | null {
  if (fs.existsSync(path.join(dir, "package.json"))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["react"]) return "Node.js / React";
      if (deps["next"]) return "Node.js / Next.js";
      if (deps["vue"]) return "Node.js / Vue";
      return "Node.js";
    } catch {
      return "Node.js";
    }
  }
  if (fs.existsSync(path.join(dir, "pyproject.toml")) || fs.existsSync(path.join(dir, "requirements.txt"))) return "Python";
  if (fs.existsSync(path.join(dir, "Cargo.toml"))) return "Rust";
  if (fs.existsSync(path.join(dir, "go.mod"))) return "Go";
  if (fs.existsSync(path.join(dir, "pom.xml"))) return "Java / Maven";
  if (fs.existsSync(path.join(dir, "build.gradle")) || fs.existsSync(path.join(dir, "build.gradle.kts"))) return "Java / Gradle";
  return null;
}

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runInit(): Promise<void> {
  process.stderr.write(`\n${c(BOLD + CYAN, "🚀 Cappy — Setup Inicial")}\n\n`);

  let config;
  try {
    config = await loadConfig();
  } catch {
    config = defaultConfig();
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

  // API Key
  const currentKey = config.openrouter.apiKey ? `...${config.openrouter.apiKey.slice(-6)}` : "não definida";
  process.stderr.write(`${c(CYAN, "OpenRouter API Key")} ${c(GRAY, `(atual: ${currentKey})`)}:\n`);
  const apiKeyInput = await askQuestion(rl, `  > `);
  if (apiKeyInput.trim()) config.openrouter.apiKey = apiKeyInput.trim();

  // Modelo
  process.stderr.write(`\n${c(CYAN, "Modelo")} ${c(GRAY, `(atual: ${config.openrouter.model}, Enter para manter`)}:\n`);
  const modelInput = await askQuestion(rl, `  > `);
  if (modelInput.trim()) config.openrouter.model = modelInput.trim();

  rl.close();

  const stack = detectStack(process.cwd());
  if (stack) process.stderr.write(`\n${c(GREEN, "✓")} Stack detectado: ${c(BOLD, stack)}\n`);

  try {
    await saveConfig(config);
    process.stderr.write(`${c(GREEN, "✓")} Configuração salva em ${c(CYAN, "~/.cappy/config.json")}\n`);
  } catch (err) {
    process.stderr.write(`${c(RED, "✗")} Erro ao salvar: ${(err as Error).message}\n`);
    process.exit(1);
  }

  if (!config.openrouter.apiKey) {
    process.stderr.write(`\n${c(YELLOW, "⚠")}  API Key não definida — obtenha em ${c(CYAN, "https://openrouter.ai/keys")}\n`);
  } else {
    process.stderr.write(`\n${c(GREEN, "Tudo pronto!")} Execute ${c(CYAN, "cappy")} para iniciar.\n`);
  }
  process.stderr.write("\n");
}
