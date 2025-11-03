/**
 * Debug command to test if commands are registered
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';

export function registerDebugCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('cappy.debug', async () => {
    console.log('🐛 Debug command executed');
    
    // Test if processSingleFileInternal is registered
    try {
      const commands = await vscode.commands.getCommands(true);
      const cappyCommands = commands.filter(cmd => cmd.startsWith('cappy.'));
      
      console.log('📋 All Cappy commands registered:', cappyCommands);
      
      vscode.window.showInformationMessage(
        `Found ${cappyCommands.length} Cappy commands:\n${cappyCommands.join('\n')}`,
        { modal: true }
      );
    } catch (error) {
      console.error('❌ Error getting commands:', error);
      vscode.window.showErrorMessage(`Error: ${error}`);
    }
  });
  
  context.subscriptions.push(command);
  console.log('✅ Debug command registered: cappy.debug');
}

/**
 * Debug command to inspect SQLite database
 */
export function registerDebugDatabaseCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('cappy.debugDatabase', async () => {
    console.log('🐛 Debug Database command executed');
    
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
      }
      const dbPath = path.join(workspaceRoot, '.cappy', 'data', 'file-metadata.db');
      console.log('📂 Database path:', dbPath);
      
      // Check if database file exists
      const dbExists = fs.existsSync(dbPath);
      console.log('💾 Database exists:', dbExists);
      
      if (!dbExists) {
        vscode.window.showWarningMessage(
          `❌ Database not found at: ${dbPath}\n\nThe database will be created when the file processing system initializes.`,
          { modal: true }
        );
        return;
      }
      
      // Open database and read data
      const db = new FileMetadataDatabase(dbPath);
      await db.initialize();
      
      const stats = await db.getStats();
      const allFiles = await db.getAllFiles();
      
      console.log('📊 Database stats:', stats);
      console.log('📄 All files:', allFiles);
      
      let message = `📊 Database Statistics:\n\n`;
      message += `Total files: ${stats.total}\n`;
      message += `Pending: ${stats.pending}\n`;
      message += `Processing: ${stats.processing}\n`;
      message += `Completed: ${stats.completed}\n`;
      message += `Failed: ${stats.failed}\n`;
      message += `Cancelled: ${stats.cancelled}\n\n`;
      
      if (allFiles.length > 0) {
        message += `\n📋 Recent Files:\n`;
        for (const file of allFiles.slice(0, 5)) {
          message += `\n• ${file.fileName}\n`;
          message += `  Status: ${file.status}\n`;
          message += `  Progress: ${file.progress}%\n`;
          message += `  Chunks: ${file.chunksCount || 0}\n`;
        }
      } else {
        message += `\n⚠️ No files found in database`;
      }
      
      db.close();
      
      vscode.window.showInformationMessage(message, { modal: true });
    } catch (error) {
      console.error('❌ Error reading database:', error);
      vscode.window.showErrorMessage(`Error reading database: ${error}`);
    }
  });
  
  context.subscriptions.push(command);
  console.log('✅ Debug Database command registered: cappy.debugDatabase');
}

/**
 * Debug command to add test data to database
 */
export function registerDebugAddTestDataCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('cappy.debugAddTestData', async () => {
    console.log('🐛 Debug Add Test Data command executed');
    
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showWarningMessage('No workspace folder found');
        return;
      }
      const dbPath = path.join(workspaceRoot, '.cappy', 'data', 'file-metadata.db');
      
      // Ensure database exists
      const dbExists = fs.existsSync(dbPath);
      if (!dbExists) {
        vscode.window.showWarningMessage(
          'Database not found. Please wait for the file processing system to initialize.',
          { modal: true }
        );
        return;
      }
      
      // Open database
      const db = new FileMetadataDatabase(dbPath);
      await db.initialize();
      
      const now = new Date().toISOString();
      const workspaceRootPath = workspaceRoot || '/tmp';
      
      // Add 3 test files with different statuses
      const testFiles = [
        {
          id: `test-completed-${Date.now()}`,
          filePath: path.join(workspaceRootPath, 'test-completed.txt'),
          fileName: 'test-completed.txt',
          fileSize: 1024,
          fileHash: 'hash-completed-123',
          status: 'completed' as const,
          progress: 100,
          chunksCount: 5,
          nodesCount: 10,
          relationshipsCount: 8,
          retryCount: 0,
          maxRetries: 3,
          processingStartedAt: now,
          processingCompletedAt: now
        },
        {
          id: `test-processing-${Date.now() + 1}`,
          filePath: path.join(workspaceRootPath, 'test-processing.txt'),
          fileName: 'test-processing.txt',
          fileSize: 2048,
          fileHash: 'hash-processing-456',
          status: 'processing' as const,
          progress: 50,
          currentStep: 'Extracting chunks...',
          retryCount: 0,
          maxRetries: 3,
          processingStartedAt: now
        },
        {
          id: `test-pending-${Date.now() + 2}`,
          filePath: path.join(workspaceRootPath, 'test-pending.txt'),
          fileName: 'test-pending.txt',
          fileSize: 512,
          fileHash: 'hash-pending-789',
          status: 'pending' as const,
          progress: 0,
          retryCount: 0,
          maxRetries: 3
        }
      ];
      
      let addedCount = 0;
      for (const file of testFiles) {
        try {
          db.insertFile(file);
          addedCount++;
          console.log(`✅ Added test file: ${file.fileName} (${file.status})`);
        } catch (error) {
          console.warn(`⚠️ Could not add ${file.fileName}:`, error);
        }
      }
      
      const stats = await db.getStats();
      db.close();
      
      vscode.window.showInformationMessage(
        `✅ Added ${addedCount} test files to database!\n\n` +
        `Total files now: ${stats.total}\n` +
        `Completed: ${stats.completed}\n` +
        `Processing: ${stats.processing}\n` +
        `Pending: ${stats.pending}`,
        { modal: true }
      );
    } catch (error) {
      console.error('❌ Error adding test data:', error);
      vscode.window.showErrorMessage(`Error adding test data: ${error}`);
    }
  });
  
  context.subscriptions.push(command);
  console.log('✅ Debug Add Test Data command registered: cappy.debugAddTestData');
}
