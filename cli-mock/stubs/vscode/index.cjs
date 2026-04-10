/**
 * Stub do módulo `vscode` para o cli-mock (incl. worker ESM do tsx).
 * O VS Code real injeta o módulo no host; este pacote só existe em `cli-mock/node_modules`.
 */

"use strict";

const windowApi = {
  /**
   * @param {string} name
   */
  createOutputChannel(name) {
    return {
      /**
       * @param {string} line
       */
      appendLine(line) {
        // eslint-disable-next-line no-console
        console.log(`[cappy stub ${name}] ${line}`);
      },
      show() {},
      dispose() {},
    };
  },
};

const env = {
  appRoot: process.cwd(),
  ripgrepPath: undefined,
};

module.exports = {
  window: windowApi,
  env,
};
