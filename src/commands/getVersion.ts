import * as vscode from 'vscode';

/**
 * Returns the extension version as declared in package.json.
 * Falls back to empty string if extension cannot be resolved.
 */
export function getVersion(): string {
  const extension = vscode.extensions.getExtension('eduardocecon.cappy');
  if (!extension) {
    return '';
  }
  const version: string | undefined = extension.packageJSON?.version;
  const result = version || '';
  
  if (version) {
    vscode.window.setStatusBarMessage(`Cappy v${version}`, 3000);
  }
  
  return result;
}

export default { getVersion };
