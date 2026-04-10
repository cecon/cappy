/**
 * Arranca `node dist/server.js` com o mesmo `NODE_PATH` que o modo dev.
 */

"use strict";

const path = require("node:path");
const { spawn } = require("node:child_process");

const root = __dirname;
const localModules = path.join(root, "node_modules");
process.env.NODE_PATH = [localModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);

const child = spawn(process.execPath, ["dist/server.js"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});
