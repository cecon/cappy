import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Task file loader - Detects and loads active task XML files
 */
export class TaskFileLoader {
  /**
   * Finds the active task file in .cappy/tasks/
   * Active tasks are marked with .ACTIVE.xml suffix
   */
  static async findActiveTaskFile(): Promise<string | null> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return null;
      }

      const tasksDir = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'tasks');
      
      // Check if tasks directory exists
      try {
        await vscode.workspace.fs.stat(tasksDir);
      } catch {
        // Directory doesn't exist
        return null;
      }

      // Read directory contents
      const entries = await vscode.workspace.fs.readDirectory(tasksDir);
      
      // Find .ACTIVE.xml files
      const activeFiles = entries
        .filter(([name, type]) => 
          type === vscode.FileType.File && 
          name.endsWith('.ACTIVE.xml')
        )
        .map(([name]) => name);

      if (activeFiles.length === 0) {
        return null;
      }

      // If multiple active files, use the most recent one
      if (activeFiles.length > 1) {
        console.warn(`[TaskFileLoader] Multiple active task files found: ${activeFiles.join(', ')}`);
        console.warn('[TaskFileLoader] Using first one. Consider deactivating others.');
      }

      const activeFile = activeFiles[0];
      const activeFilePath = path.join('.cappy', 'tasks', activeFile);
      
      console.log(`[TaskFileLoader] ✅ Active task file found: ${activeFilePath}`);
      return activeFilePath;

    } catch (error) {
      console.error('[TaskFileLoader] Error finding active task file:', error);
      return null;
    }
  }

  /**
   * Loads the content of the active task file
   */
  static async loadActiveTaskContent(): Promise<string | null> {
    const activeFilePath = await this.findActiveTaskFile();
    if (!activeFilePath) {
      return null;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return null;
      }

      const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, activeFilePath);
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const content = new TextDecoder().decode(fileContent);
      
      console.log(`[TaskFileLoader] ✅ Loaded active task content (${content.length} chars)`);
      return content;

    } catch (error) {
      console.error('[TaskFileLoader] Error loading active task content:', error);
      return null;
    }
  }

  /**
   * Extracts the checklist progress from task XML
   * Returns a summary of which phases are completed
   */
  static parseTaskProgress(xmlContent: string): {
    currentPhase: string;
    completedItems: number;
    totalItems: number;
    progress: string[];
  } {
    const progress: string[] = [];
    let completedItems = 0;
    let totalItems = 0;
    let currentPhase = 'Phase 1: Basic Information';

    // Extract checklist from XML comments
    const checklistMatch = xmlContent.match(/📋 TASK CREATION PROGRESS:([\s\S]*?)💡 TIPS:/);
    if (!checklistMatch) {
      return { currentPhase, completedItems, totalItems, progress };
    }

    const checklistContent = checklistMatch[1];
    
    // Count total checkboxes
    const allCheckboxes = checklistContent.match(/\[.\]/g) || [];
    totalItems = allCheckboxes.length;

    // Count completed checkboxes [✓] or [x]
    const completedCheckboxes = checklistContent.match(/\[[✓x]\]/gi) || [];
    completedItems = completedCheckboxes.length;

    // Find current phase (marked with ⏳)
    const currentPhaseMatch = checklistContent.match(/\[⏳\]\s*(Phase \d+:[^\n]*)/);
    if (currentPhaseMatch) {
      currentPhase = currentPhaseMatch[1].trim();
    }

    // Extract all items for detailed view
    const itemMatches = checklistContent.matchAll(/\[\s*(.)\s*\]\s*(\d+\.\d+\s*-\s*[^\n]+)/g);
    for (const match of itemMatches) {
      const status = match[1];
      const item = match[2].trim();
      const isDone = status === '✓' || status === 'x' || status === 'X';
      progress.push(`${isDone ? '✅' : '⬜'} ${item}`);
    }

    return {
      currentPhase,
      completedItems,
      totalItems,
      progress
    };
  }

  /**
   * Generates a summary message about the active task
   */
  static async getActiveTaskSummary(): Promise<string | null> {
    const content = await this.loadActiveTaskContent();
    if (!content) {
      return null;
    }

    const { currentPhase, completedItems, totalItems, progress } = this.parseTaskProgress(content);

    // Extract task title from XML
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : 'Unknown Task';

    // Extract category
    const categoryMatch = content.match(/<category>(.*?)<\/category>/);
    const category = categoryMatch ? categoryMatch[1] : 'unknown';

    const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return `📋 **Active Task Detected**

**Title:** ${title}
**Category:** ${category}
**Progress:** ${completedItems}/${totalItems} items completed (${progressPercentage}%)
**Current Phase:** ${currentPhase}

**Checklist:**
${progress.slice(0, 5).join('\n')}${progress.length > 5 ? `\n... and ${progress.length - 5} more items` : ''}

💡 I can help you continue working on this task. What would you like to do next?`;
  }
}
