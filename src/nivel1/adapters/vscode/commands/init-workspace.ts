import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Initializes Cappy workspace structure
 * Creates .cappy folder and adds .cappy/data to .gitignore
 */
export function registerInitWorkspaceCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('cappy.init', async () => {
    console.log('🚀 [INIT] cappy.init command started');
    
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('❌ No workspace folder open. Please open a folder first.');
        return;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      const cappyDir = path.join(workspaceRoot, '.cappy');
      const cappyDataDir = path.join(cappyDir, 'data');
      const gitignorePath = path.join(workspaceRoot, '.gitignore');

      // Check if already initialized
      if (fs.existsSync(cappyDir)) {
        const reinit = await vscode.window.showWarningMessage(
          '⚠️ Cappy is already initialized in this workspace. Do you want to reinitialize?',
          'Yes', 'No'
        );
        if (reinit !== 'Yes') {
          console.log('🛑 [INIT] User canceled reinitialization');
          return;
        }
      }

      // Create .cappy directory structure
      console.log('📁 [INIT] Creating .cappy directory structure...');
      if (!fs.existsSync(cappyDir)) {
        fs.mkdirSync(cappyDir, { recursive: true });
        console.log('✅ [INIT] Created .cappy folder');
      }
      
      if (!fs.existsSync(cappyDataDir)) {
        fs.mkdirSync(cappyDataDir, { recursive: true });
        console.log('✅ [INIT] Created .cappy/data folder');
      }

      // Add .cappy/data to .gitignore
      console.log('📝 [INIT] Updating .gitignore...');
      let gitignoreContent = '';
      const gitignoreExists = fs.existsSync(gitignorePath);
      
      if (gitignoreExists) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      }

      // Check if .cappy/data is already in .gitignore
      const cappyDataPattern = '.cappy/data';
      const cappyDataPatternAlt = '.cappy/data/';
      
      if (!gitignoreContent.includes(cappyDataPattern) && !gitignoreContent.includes(cappyDataPatternAlt)) {
        // Add entry to .gitignore
        const newEntry = gitignoreExists && !gitignoreContent.endsWith('\n') 
          ? `\n\n# Cappy data files (databases, indexes)\n${cappyDataPattern}/\n`
          : `# Cappy data files (databases, indexes)\n${cappyDataPattern}/\n`;
        
        gitignoreContent += newEntry;
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
        console.log('✅ [INIT] Added .cappy/data/ to .gitignore');
      } else {
        console.log('ℹ️  [INIT] .cappy/data already in .gitignore');
      }

      // Show success message
      vscode.window.showInformationMessage(
        '✅ Cappy initialized successfully! You can now use "Cappy: Start File Processing" to begin indexing.',
        'Start Processing'
      ).then(selection => {
        if (selection === 'Start Processing') {
          vscode.commands.executeCommand('cappy.startProcessing');
        }
      });

      console.log('✅ [INIT] Cappy workspace initialized successfully');

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ [INIT] Failed to initialize Cappy:', error);
      vscode.window.showErrorMessage(`Failed to initialize Cappy: ${errMsg}`);
    }
  });

  context.subscriptions.push(command);
}
