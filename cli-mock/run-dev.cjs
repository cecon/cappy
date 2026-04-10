/**
 * Arranca o tsx watch com `NODE_PATH` a apontar para `cli-mock/node_modules`,
 * para que `require("vscode")` / imports resolvam o stub mesmo no worker do tsx.
 */

"use strict";

const path = require("node:path");
const { spawn } = require("node:child_process");

const root = __dirname;
const localModules = path.join(root, "node_modules");
process.env.NODE_PATH = [localModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);

const child = spawn("pnpm", ["exec", "tsx", "watch", "src/server.ts"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: true,
  detached: false,
});

function forwardSignalToChild(signal) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
}

process.once("SIGINT", () => forwardSignalToChild("SIGINT"));
process.once("SIGTERM", () => forwardSignalToChild("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});
