/**
 * Debug command to test if commands are registered
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileMetadataDatabase } from '../nivel2/infrastructure/services/file-metadata-database';
import { parse } from '@typescript-eslint/parser';
import { EntityFilterPipeline, type RawEntity } from '../nivel2/infrastructure/services/entity-filtering/entity-filter-pipeline';

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
      
      const stats = db.getStats();
      const allFiles = db.getAllFileMetadata();
      
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
        allFiles.slice(0, 5).forEach(file => {
          message += `\n• ${file.fileName}\n`;
          message += `  Status: ${file.status}\n`;
          message += `  Progress: ${file.progress}%\n`;
          message += `  Chunks: ${file.chunksCount || 0}\n`;
        });
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
      
      const stats = db.getStats();
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

/**
 * Handler for debug analysis from webview
 */
export function handleDebugAnalysis(
  message: { fileName: string; fileSize: number; mimeType: string; content: string },
  webview: vscode.Webview
): void {
  console.log('🔍 Analyzing file:', message.fileName);
  
  try {
    // Parse AST
    const ast = parse(message.content, {
      loc: true,
      range: true,
      comment: true,
      tokens: false,
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    });
    
    // Extract raw entities from AST
    const rawEntities: RawEntity[] = [];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractEntities = (node: any, parent?: any) => {
      if (!node || typeof node !== 'object') return;
      
      // Import declarations
      if (node.type === 'ImportDeclaration' && node.source) {
        const source = node.source.value;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const specifiers = (node.specifiers || []).map((s: any) => 
          s.imported?.name || s.local?.name || 'default'
        );
        
        rawEntities.push({
          type: 'import',
          name: specifiers[0] || source,
          source,
          specifiers,
          line: node.loc?.start.line,
          scope: 'module'
        });
      }
      
      // Export declarations
      if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
        if (node.declaration) {
          const name = node.declaration.id?.name || 
                      node.declaration.name ||
                      'default';
          rawEntities.push({
            type: 'export',
            name,
            line: node.loc?.start.line,
            scope: 'module'
          });
        }
        
        if (node.specifiers) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          node.specifiers.forEach((spec: any) => {
            rawEntities.push({
              type: 'export',
              name: spec.exported?.name || spec.local?.name,
              line: spec.loc?.start.line,
              scope: 'module'
            });
          });
        }
      }
      
      // Class declarations
      if (node.type === 'ClassDeclaration' && node.id) {
        rawEntities.push({
          type: 'class',
          name: node.id.name,
          line: node.loc?.start.line,
          scope: 'module'
        });
        
        // Class members
        if (node.body?.body) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          node.body.body.forEach((member: any) => {
            if (member.type === 'MethodDefinition' && member.key) {
              rawEntities.push({
                type: 'function',
                name: member.key.name,
                line: member.loc?.start.line,
                scope: 'module',
                isPrivate: member.key.name?.startsWith('_') || member.key.name?.startsWith('#')
              });
            }
            
            if (member.type === 'PropertyDefinition' && member.key) {
              rawEntities.push({
                type: 'variable',
                name: member.key.name,
                line: member.loc?.start.line,
                scope: 'module',
                isPrivate: member.key.name?.startsWith('_') || member.key.name?.startsWith('#')
              });
            }
          });
        }
      }
      
      // Function declarations
      if (node.type === 'FunctionDeclaration' && node.id) {
        rawEntities.push({
          type: 'function',
          name: node.id.name,
          line: node.loc?.start.line,
          scope: parent?.type === 'Program' ? 'module' : 'local'
        });
      }
      
      // Variable declarations
      if (node.type === 'VariableDeclaration') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node.declarations?.forEach((decl: any) => {
          if (decl.id?.name) {
            rawEntities.push({
              type: 'variable',
              name: decl.id.name,
              line: decl.loc?.start.line,
              scope: parent?.type === 'Program' ? 'module' : 'local'
            });
          }
        });
      }
      
      // Call expressions
      if (node.type === 'CallExpression' && node.callee) {
        const name = node.callee.property?.name || 
                    node.callee.name || 
                    'anonymous';
        if (name !== 'anonymous') {
          rawEntities.push({
            type: 'call',
            name,
            line: node.loc?.start.line,
            scope: 'local'
          });
        }
      }
      
      // Type references
      if (node.type === 'TSTypeReference' && node.typeName) {
        const name = node.typeName.name || 
                    (node.typeName.right?.name);
        if (name) {
          rawEntities.push({
            type: 'typeRef',
            name,
            line: node.loc?.start.line,
            scope: 'global'
          });
        }
      }
      
      // Recursively visit children
      for (const key in node) {
        if (key === 'loc' || key === 'range' || key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(c => extractEntities(c, node));
        } else if (child && typeof child === 'object') {
          extractEntities(child, node);
        }
      }
    };
    
    extractEntities(ast.body);
    
    // Run through filter pipeline
    const pipeline = new EntityFilterPipeline({
      skipLocalVariables: true,
      skipPrimitiveTypes: true,
      skipAssetImports: true,
      skipPrivateMembers: false, // Keep but reduce score
      mergeIdenticalEntities: true,
      resolvePackageInfo: true,
      inferRelationships: true,
      calculateConfidence: true
    });
    
    void pipeline.process(
      rawEntities,
      `/debug/${message.fileName}`
    ).then(filterResult => {
      // Send back to webview
      webview.postMessage({
        type: 'debug/analyze-result',
        payload: {
          fileName: message.fileName,
          fileSize: message.fileSize,
          mimeType: message.mimeType,
          ast: ast.body,
          rawEntities: filterResult.original,
          filtered: filterResult.filtered,
          deduplicated: filterResult.deduplicated,
          normalized: filterResult.normalized,
          enriched: filterResult.enriched,
          stats: filterResult.stats,
          metadata: {
            totalLines: message.content.split('\n').length,
            processingTime: filterResult.stats.processingTimeMs,
            compressionRate: `${((1 - filterResult.stats.finalCount / filterResult.stats.totalRaw) * 100).toFixed(1)}%`
          }
        }
      });
      
      console.log('✅ Analysis complete:', filterResult.stats);
    }).catch(error => {
      webview.postMessage({
        type: 'debug/analyze-error',
        payload: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Error analyzing file:', error);
    webview.postMessage({
      type: 'debug/analyze-error',
      payload: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
  }
}
