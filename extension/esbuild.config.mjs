import { build, context } from "esbuild";
import { rmSync } from "node:fs";

const watch = process.argv.includes("--watch");
const production = process.argv.includes("--production");

rmSync("out", { recursive: true, force: true });

const shared = {
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: "info",
};

const extensionConfig = {
  ...shared,
  entryPoints: ["src/extension.ts"],
  outfile: "out/extension.js",
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"],
};

const webviewConfig = {
  ...shared,
  entryPoints: {
    main: "webview-src/main.tsx",
    styles: "webview-src/styles.css",
  },
  outdir: "out/webview",
  platform: "browser",
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  loader: {
    ".css": "css",
    ".svg": "dataurl",
    ".png": "dataurl",
  },
  define: {
    "process.env.NODE_ENV": production ? '"production"' : '"development"',
  },
};

async function run() {
  if (watch) {
    const [extCtx, webCtx] = await Promise.all([
      context(extensionConfig),
      context(webviewConfig),
    ]);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log("[cappy] watching extension + webview…");
  } else {
    await Promise.all([build(extensionConfig), build(webviewConfig)]);
    console.log("[cappy] build complete");
  }
}

run().catch((err) => {
  console.error("[cappy] build failed:", err);
  process.exit(1);
});
