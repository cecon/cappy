import * as vscode from 'vscode';

const MAX_DOC_CHARS = 1600;
const DEFAULT_EXCLUDE = new Set(['node_modules', '.git', '.cappy', 'dist', 'build', 'out', 'coverage', '.turbo']);

async function readSnippet(
  workspaceFolder: vscode.WorkspaceFolder,
  relativePath: string,
  maxChars: number = MAX_DOC_CHARS
): Promise<string | null> {
  try {
    const uri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
    const buffer = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(buffer).toString('utf8');
    const trimmed = text.slice(0, maxChars).trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

async function getPackageSummary(workspaceFolder: vscode.WorkspaceFolder): Promise<string | null> {
  try {
    const uri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
    const buffer = await vscode.workspace.fs.readFile(uri);
    const pkg = JSON.parse(Buffer.from(buffer).toString('utf8')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const scripts = Object.keys(pkg.scripts || {}).slice(0, 5);
    const deps = Object.keys(pkg.dependencies || {}).slice(0, 8);
    const devDeps = Object.keys(pkg.devDependencies || {}).slice(0, 5);

    const parts = [
      scripts.length ? `Scripts: ${scripts.join(', ')}` : null,
      deps.length ? `Deps: ${deps.join(', ')}` : null,
      devDeps.length ? `DevDeps: ${devDeps.join(', ')}` : null
    ].filter(Boolean);

    return parts.length ? parts.join('\n') : null;
  } catch {
    return null;
  }
}

/**
 * Builds a small project context snapshot (stack, structure, key docs, package summary).
 * Heavy data should still be fetched by agents using tools (cappy_read_file, etc.).
 */
export async function getProjectContext(): Promise<string> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return 'No active workspace';

  const name = workspaceFolder.name;
  let stack = 'Unknown';

  // Top-level structure snapshot
  let topLevel = '';
  try {
    const entries = await vscode.workspace.fs.readDirectory(workspaceFolder.uri);
    const dirs = entries
      .filter(([, type]) => type === vscode.FileType.Directory)
      .map(([dir]) => dir)
      .filter(dir => !DEFAULT_EXCLUDE.has(dir))
      .slice(0, 10);
    topLevel = dirs.length ? dirs.map(d => `/${d}`).join(', ') : '';
  } catch {
    topLevel = '';
  }

  try {
    const files = await vscode.workspace.fs.readDirectory(workspaceFolder.uri);
    const fileNames = new Set(files.map(([name]) => name));

    // Detect stack
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

  // Quick doc/context snippets
  const readme = await readSnippet(workspaceFolder, 'README.md');
  const architecture = await readSnippet(workspaceFolder, 'SIMPLIFIED_ARCHITECTURE.md');
  const docsIndex = await readSnippet(workspaceFolder, 'docs/INDEX.md');
  const packageSummary = await getPackageSummary(workspaceFolder);

  const parts = [
    `Project: ${name}`,
    `Detected Stack: ${stack}`,
    topLevel ? `Top-level: ${topLevel}` : null,
    packageSummary ? `Package.json:\n${packageSummary}` : null,
    readme ? `README.md (preview):\n${readme}` : null,
    docsIndex ? `docs/INDEX.md (preview):\n${docsIndex}` : null,
    architecture ? `SIMPLIFIED_ARCHITECTURE.md (preview):\n${architecture}` : null,
    'Tip: Use cappy_read_file for deeper context.'
  ].filter(Boolean);

  return parts.join('\n\n');
}
