import * as vscode from 'vscode';
import { writeOutput } from '../utils/outputWriter';

/**
 * Returns the extension version as declared in package.json.
 * Falls back to empty string if extension cannot be resolved.
 * Writes the result to .cappy/output.txt
 */
export function getVersion(): string {
  const extension = vscode.extensions.getExtension('eduardocecon.cappy');
  if (!extension) {
    writeOutput('');
    return '';
  }
  const version: string | undefined = extension.packageJSON?.version;
  const result = version || '';
  
  if (version) {
    vscode.window.setStatusBarMessage(`Cappy v${version}`, 3000);
  }
  
  // Write result to .cappy/output.txt
  writeOutput(result);
  
  return result;
}

export default { getVersion };
