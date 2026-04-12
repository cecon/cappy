/** Minimal VS Code API mock for unit tests. */

export const window = {
  createOutputChannel: () => ({
    appendLine: () => {},
    append: () => {},
    show: () => {},
    dispose: () => {},
  }),
  showInformationMessage: () => Promise.resolve(undefined),
  showErrorMessage: () => Promise.resolve(undefined),
  showWarningMessage: () => Promise.resolve(undefined),
  createTerminal: () => ({ show: () => {}, sendText: () => {}, dispose: () => {} }),
  activeTextEditor: undefined,
};

export const workspace = {
  getConfiguration: () => ({
    get: (_key: string, defaultValue?: unknown) => defaultValue,
  }),
  workspaceFolders: undefined,
  fs: {
    readFile: () => Promise.resolve(new Uint8Array()),
    writeFile: () => Promise.resolve(),
    stat: () => Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 0 }),
  },
};

export const commands = {
  registerCommand: () => ({ dispose: () => {} }),
  executeCommand: () => Promise.resolve(undefined),
};

export const Uri = {
  file: (path: string) => ({ fsPath: path, toString: () => `file://${path}` }),
  joinPath: (base: { fsPath: string }, ...parts: string[]) => ({
    fsPath: [base.fsPath, ...parts].join("/"),
    toString: () => `file://${[base.fsPath, ...parts].join("/")}`,
  }),
};

export const EventEmitter = class {
  event = () => ({ dispose: () => {} });
  fire = () => {};
  dispose = () => {};
};

export const ExtensionContext = {};

export const ViewColumn = { One: 1, Two: 2, Three: 3 };

export const env = {
  openExternal: () => Promise.resolve(true),
};

export const FileType = { File: 1, Directory: 2, SymbolicLink: 64, Unknown: 0 };

export default {
  window,
  workspace,
  commands,
  Uri,
  EventEmitter,
  ViewColumn,
  env,
  FileType,
};
