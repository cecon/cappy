import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Writes content to .cappy/output.txt, clearing previous content
 */
export function writeOutput(content: string): void {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }
    
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cappyDir = path.join(workspaceRoot, '.cappy');
    const outputFile = path.join(cappyDir, 'output.txt');
    
    // Ensure .cappy directory exists
    if (!fs.existsSync(cappyDir)) {
      fs.mkdirSync(cappyDir, { recursive: true });
    }
    
    // Write content (overwrites previous content)
    fs.writeFileSync(outputFile, content, 'utf8');
  } catch (error) {
    console.error('Error writing to .cappy/output.txt:', error);
  }
}
