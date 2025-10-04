import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple output writer for VS Code
 */
export class OutputWriter {
  private readonly outputChannel: vscode.OutputChannel;

  constructor(channelName: string = 'Cappy LightRAG') {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
  }

  writeLine(message: string): void {
    this.outputChannel.appendLine(message);
  }

  show(): void {
    this.outputChannel.show();
  }

  clear(): void {
    this.outputChannel.clear();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * Writes content to .cappy/output.txt, clearing previous content
 * Only writes if .cappy directory already exists (project is initialized)
 */
export function writeOutput(content: string): void {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }
    
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cappyDir = path.join(workspaceRoot, '.cappy');
    
    // Only write if .cappy directory already exists (project is initialized)
    if (!fs.existsSync(cappyDir)) {
      console.log('Skipping output.txt creation - Cappy not initialized in this workspace');
      return;
    }
    
    const outputFile = path.join(cappyDir, 'output.txt');
    
    // Write content (overwrites previous content)
    fs.writeFileSync(outputFile, content, 'utf8');
  } catch (error) {
    console.error('Error writing to .cappy/output.txt:', error);
  }
}

/**
 * Writes content to .cappy/output.txt, creating directory if needed
 * This version should only be used by commands that initialize Cappy
 */
export function writeOutputForced(content: string): void {
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

/**
 * Appends content to .cappy/output.txt with timestamp
 * Only writes if .cappy directory already exists (project is initialized)
 */
export function appendOutput(content: string): void {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }
    
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cappyDir = path.join(workspaceRoot, '.cappy');
    
    // Only write if .cappy directory already exists (project is initialized)
    if (!fs.existsSync(cappyDir)) {
      console.log('Skipping output.txt append - Cappy not initialized in this workspace');
      return;
    }
    
    const outputFile = path.join(cappyDir, 'output.txt');
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const line = `[${timestamp}] ${content}\n`;
    
    // Append content
    fs.appendFileSync(outputFile, line, 'utf8');
  } catch (error) {
    console.error('Error appending to .cappy/output.txt:', error);
  }
}
