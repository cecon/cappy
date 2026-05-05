/**
 * Source for the generic hook runner script that the HookRunner spawns via `node`.
 * Compiled to a stable CJS file at first use. The script:
 *   1. Receives `<compiledHookPath>` as argv[2].
 *   2. Reads JSON from stdin.
 *   3. `require()`s the compiled hook, awaits its default export with the input.
 *   4. Prints the result as the last JSON line on stdout.
 *
 * Authors of hooks export a `default` async function `(input) => HookOutput`. Script-style
 * hooks that print their own JSON to stdout are also accepted (no default export → input
 * is left available on `process.env.__CAPPY_HOOK_INPUT__` and stdout is read as-is).
 */
export const HOOK_RUNNER_SCRIPT = `"use strict";
(async () => {
  try {
    const compiledHookPath = process.argv[2];
    if (!compiledHookPath) { process.stderr.write("missing hook path\\n"); process.exit(2); }
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    await new Promise((resolve) => process.stdin.on("end", resolve));
    const raw = Buffer.concat(chunks).toString("utf-8");
    let input = {};
    try { input = raw.length > 0 ? JSON.parse(raw) : {}; } catch (e) {
      process.stderr.write("invalid JSON on stdin: " + (e && e.message ? e.message : e) + "\\n");
      process.exit(2);
    }
    process.env.__CAPPY_HOOK_INPUT__ = raw;
    const mod = require(compiledHookPath);
    const fn = mod && typeof mod === "object" && typeof mod.default === "function"
      ? mod.default
      : (typeof mod === "function" ? mod : null);
    if (!fn) {
      // Script-style hook printed its own JSON. Nothing else to do.
      return;
    }
    const result = await fn(input);
    if (result === undefined || result === null) {
      process.stdout.write(JSON.stringify({ v: 1, decision: "allow" }) + "\\n");
      return;
    }
    process.stdout.write(JSON.stringify(result) + "\\n");
  } catch (err) {
    process.stderr.write((err && err.message ? err.message : String(err)) + "\\n");
    process.exit(1);
  }
})();
`;
