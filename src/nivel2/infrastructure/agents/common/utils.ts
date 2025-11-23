import * as vscode from 'vscode';

/**
 * Gets basic project context (name and stack)
 */
export async function getProjectContext(): Promise<string> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return 'No active workspace';

  const name = workspaceFolder.name;
  let stack = 'Unknown';

  try {
    const files = await vscode.workspace.fs.readDirectory(workspaceFolder.uri);
    const fileNames = new Set(files.map(([name]) => name));

    if (fileNames.has('package.json')) stack = 'Node.js/TypeScript/JavaScript';
    else if (fileNames.has('requirements.txt') || fileNames.has('pyproject.toml')) stack = 'Python';
    else if (fileNames.has('pom.xml') || fileNames.has('build.gradle')) stack = 'Java';
    else if (fileNames.has('go.mod')) stack = 'Go';
    else if (fileNames.has('Cargo.toml')) stack = 'Rust';
    else if (fileNames.has('composer.json')) stack = 'PHP';
    else if (fileNames.has('Gemfile')) stack = 'Ruby';
  } catch (e) {
    console.warn('Failed to detect stack', e);
  }

  return `Project: ${name}\nDetected Stack: ${stack}`;
}
