import * as vscode from "vscode";
import {
  ensureTelemetryConsent,
  showConsentWebview,
} from "./commands/telemetryConsent";
import getNewTaskInstruction from "./commands/getNewTaskInstruction";
import getActiveTask from "./commands/getActiveTask";
import createTaskFile from "./commands/createTaskFile";
import { changeTaskStatusCommand } from "./commands/changeTaskStatus";
import completeTask from "./commands/completeTask";
import workOnCurrentTask from "./commands/workOnCurrentTask";
import { AddPreventionRuleCommand } from "./commands/addPreventionRule";
import { RemovePreventionRuleCommand } from "./commands/removePreventionRule";
// import { ReindexCommand } from "./commands/reindexCommand";
import { registerCappyRAGCommands } from "./commands/cappyragCommands";
import { openDocumentUploadUI } from "./commands/cappyrag";
import * as miniRAGCommands from "./commands/miniRAG";
import { MiniRAGStorage } from "./commands/miniRAG/storage";
import { FileManager } from "./utils/fileManager";
import { EnvironmentDetector } from "./utils/environmentDetector";
import { registerLanguageModelTools } from "./utils/languageModelTools";
import { CappyRAGMCPServer } from "./tools/mcpServer";
import * as path from 'path';
import * as fs from 'fs';

export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log('🦫 Cappy: Starting activation...');
    
    // Show immediate activation message with environment detection
    const welcomeMessage = EnvironmentDetector.getWelcomeMessage();
    vscode.window.showInformationMessage(welcomeMessage);
    console.log(`Cappy: Running in ${EnvironmentDetector.getEnvironmentName()}`);

  // Shared output channel for surfaced internal scripts / diagnostics
  const cappyOutput = vscode.window.createOutputChannel('Cappy');
  context.subscriptions.push(cappyOutput);

    console.log('🦫 Cappy: Output channel created...');

  await ensureLanguageModelToolsSetting();

    // Initialize Mini-LightRAG storage
    const miniRAGStorage = new MiniRAGStorage(context);
    miniRAGStorage.initialize().catch(error => {
      console.error('Failed to initialize Mini-LightRAG storage:', error);
    });
async function ensureLanguageModelToolsSetting() {
  try {
    const config = vscode.workspace.getConfiguration();
    const isEnabled = config.get<boolean>('languageModel.experimental.tools');

    if (isEnabled !== true) {
      await config.update(
        'languageModel.experimental.tools',
        true,
        vscode.ConfigurationTarget.Global
      );
      console.log('Cappy: Enabled languageModel.experimental.tools setting for Copilot tools');
      vscode.window.showInformationMessage(
        'Cappy ativou o suporte a ferramentas do modelo de linguagem para que os comandos do CappyRAG apareçam no Copilot.'
      );
    }
  } catch (error) {
    console.warn('Cappy: Could not ensure languageModel.experimental.tools setting', error);
  }
}

    // Make extension context available globally for Mini-LightRAG
    (global as any).cappyExtensionContext = context;

    // Register Language Model Tools for Copilot
    registerLanguageModelTools(context);

    // Register CappyRAG MCP Server for document processing (embedded)
    const mcpServer = new CappyRAGMCPServer(context);
    mcpServer.registerTools();
    console.log('🛠️ Cappy: CappyRAG MCP tools registered (embedded mode)');

    // Telemetry consent gating (one-time and on updates)
    ensureTelemetryConsent(context)
      .then((accepted) => {
        if (!accepted) {
          console.log(
            "Telemetry consent declined. Telemetry will remain disabled."
          );
        }
      })
      .catch((err) => {
        console.warn("Failed to ensure telemetry consent:", err);
      });

    // Register init command (always run init; KnowStack must not block it)
    const initCommand = vscode.commands.registerCommand(
      "cappy.init",
      async () => {
        try {
              async function ensureLanguageModelToolsSetting() {
                try {
                  const config = vscode.workspace.getConfiguration();
                  const isEnabled = config.get<boolean>('languageModel.experimental.tools');

                  if (isEnabled !== true) {
                    await config.update(
                      'languageModel.experimental.tools',
                      true,
                      vscode.ConfigurationTarget.Global
                    );
                    console.log('Cappy: Enabled languageModel.experimental.tools setting for Copilot tools');
                    vscode.window.showInformationMessage(
                      'Cappy ativou o suporte a ferramentas do modelo de linguagem para que os comandos do CappyRAG apareçam no Copilot.'
                    );
                  }
                } catch (error) {
                  console.warn('Cappy: Could not ensure languageModel.experimental.tools setting', error);
                }
              }
          try {
            const initModule = await import("./commands/initCappy");
            const initCommand = new initModule.InitCappyCommand(context);
            const success = await initCommand.execute();
            if (!success) {
              vscode.window.showWarningMessage(
                "🦫 Cappy Memory: Initialization was cancelled or failed."
              );
            }
          } catch (importError) {
            vscode.window.showErrorMessage(
              `Cappy Memory: Init feature failed to load: ${importError}`
            );
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Cappy Memory Init failed: ${error}`);
        }
      }
    );

    // Register knowstack command
    const knowStackCommand = vscode.commands.registerCommand(
      "cappy.knowstack",
      async (): Promise<string> => {
        try {
          const mod = await import("./commands/knowStack");
          const script: string = await mod.runKnowStack(context);
          if (script) {
            cappyOutput.appendLine(`[knowstack] Loaded script (${script.length} chars)`);
            // Avoid dumping entire XML repeatedly; show first line as confirmation
            const firstLine = script.split(/\r?\n/, 1)[0];
            cappyOutput.appendLine(`[knowstack] First line: ${firstLine}`);
            cappyOutput.show(true);
            vscode.window.setStatusBarMessage('Cappy KnowStack script ready (verifique Output: Cappy)', 4000);
          } else {
            vscode.window.showWarningMessage('Cappy KnowStack: script vazio (não encontrado ou erro de leitura).');
          }
          return script; // return instructions for LLM to start the flow
        } catch (error) {
          vscode.window.showErrorMessage(`Cappy KnowStack failed: ${error}`);
          return "";
        }
      }
    );

    // Register knowstack alias for compatibility with agents that use the alias
    const knowStackAliasCommand = vscode.commands.registerCommand(
      "cappy.runknowstack",
      async () => {
        try {
          const mod = await import("./commands/knowStack");
          const script: string = await mod.runKnowStack(context);
          if (script) {
            cappyOutput.appendLine(`[runknowstack] Loaded script (${script.length} chars)`);
          }
          return script;
        } catch (error) {
          vscode.window.showErrorMessage(`Cappy KnowStack (alias) failed: ${error}`);
          return "";
        }
      }
    );

    // Register typo alias: cappy.knowtask (requested by agents)
    const knowTaskTypoAliasCommand = vscode.commands.registerCommand(
      "cappy.knowtask",
      async () => {
        try {
          const mod = await import("./commands/knowStack");
          const script: string = await mod.runKnowStack(context);
          if (script) {
            cappyOutput.appendLine(`[knowtask-alias] Loaded script (${script.length} chars)`);
          }
          return script;
        } catch (error) {
          vscode.window.showErrorMessage(`Cappy KnowStack (typo alias) failed: ${error}`);
          return "";
        }
      }
    );

    // Register manual consent view command
    const consentCommand = vscode.commands.registerCommand(
      "cappy.viewTelemetryTerms",
      async () => {
        try {
          await showConsentWebview(context);
        } catch (err) {
          vscode.window.showErrorMessage(`Falha ao abrir termos: ${err}`);
        }
      }
    );

    // Register: new task (returns processed template content)
    const newTaskCommand = vscode.commands.registerCommand(
      "cappy.new",
      async (args?: Record<string, string>) => {
        try {
          const content = await getNewTaskInstruction(context, args);
          return content; // important: return string so LLM can consume it via executeCommand
        } catch (error) {
          console.error("Cappy new task error:", error);
          vscode.window.showErrorMessage(
            `Cappy new task failed: ${error}`
          );
          return "";
        }
      }
    );

    // Register: get active task (returns XML content or fallback string)
    const getActiveTaskCommand = vscode.commands.registerCommand(
      "cappy.getActiveTask",
      async () => {
        try {
          const xml = await getActiveTask();
          return xml; // return string for programmatic consumption
        } catch (error) {
          console.error("Cappy getActiveTask error:", error);
          vscode.window.showErrorMessage(
            `Cappy getActiveTask failed: ${error}`
          );
          return "No activit task found";
        }
      }
    );

    // Register: version command (returns extension semantic version)
    const versionCommand = vscode.commands.registerCommand(
      "cappy.version",
      async () => {
        try {
          const mod = await import("./commands/getVersion");
          const version = mod.getVersion();
          return version;
        } catch (error) {
          vscode.window.showErrorMessage(`Cappy version command failed: ${error}`);
          return "";
        }
      }
    );

    // Register: create task file command (creates new task XML file)
    const createTaskFileCommand = vscode.commands.registerCommand(
      "cappy.createTaskFile",
      async (args?: Record<string, string>) => {
        try {
          const result = await createTaskFile(context, args);
          return result;
        } catch (error) {
          console.error("Cappy createTaskFile error:", error);
          vscode.window.showErrorMessage(`Cappy createTaskFile failed: ${error}`);
          return "";
        }
      }
    );

    // Register: change task status command (changes task status between active/paused)
    const changeTaskStatusCmd = vscode.commands.registerCommand(
      "cappy.changeTaskStatus",
      async () => {
        try {
          await changeTaskStatusCommand();
        } catch (error) {
          console.error("Cappy changeTaskStatus error:", error);
          vscode.window.showErrorMessage(`Cappy changeTaskStatus failed: ${error}`);
        }
      }
    );

    // Register: complete task command (moves active task to history)
    const completeTaskCommand = vscode.commands.registerCommand(
      "cappy.completeTask",
      async () => {
        try {
          const result = await completeTask();
          return result;
        } catch (error) {
          console.error("Cappy completeTask error:", error);
          vscode.window.showErrorMessage(`Cappy completeTask failed: ${error}`);
          return "";
        }
      }
    );

    // Register: add prevention rule command
    const addPreventionRuleCommand = vscode.commands.registerCommand(
      "cappy.addPreventionRule",
      async () => {
        try {
          const cmd = new AddPreventionRuleCommand();
          await cmd.execute();
        } catch (error) {
          console.error("Cappy addPreventionRule error:", error);
          vscode.window.showErrorMessage(`Cappy addPreventionRule failed: ${error}`);
        }
      }
    );

    // Register: remove prevention rule command
    const removePreventionRuleCommand = vscode.commands.registerCommand(
      "cappy.removePreventionRule",
      async () => {
        try {
          const cmd = new RemovePreventionRuleCommand();
          await cmd.execute();
        } catch (error) {
          console.error("Cappy removePreventionRule error:", error);
          vscode.window.showErrorMessage(`Cappy removePreventionRule failed: ${error}`);
        }
      }
    );

    // Register: work on current task command (executes active task following its script)
    const workOnCurrentTaskCommand = vscode.commands.registerCommand(
      "cappy.workOnCurrentTask",
      async () => {
        try {
          const result = await workOnCurrentTask();
          return result;
        } catch (error) {
          console.error("Cappy workOnCurrentTask error:", error);
          vscode.window.showErrorMessage(`Cappy workOnCurrentTask failed: ${error}`);
          return "";
        }
      }
    );

    // Register: reindex command (rebuilds semantic indexes for docs, tasks and rules)
    // Temporarily disabled - requires LanceDB
    // const reindexCommand = vscode.commands.registerCommand(
    //   "cappy.reindex",
    //   async () => {
    //     try {
    //       const cmd = new ReindexCommand(context);
    //       const result = await cmd.execute();
    //       return result;
    //     } catch (error) {
    //       console.error("Cappy reindex error:", error);
    //       vscode.window.showErrorMessage(`Cappy reindex failed: ${error}`);
    //       return "";
    //     }
    //   }
    // );

    // Register CappyRAG commands
    const miniRAGIndexWorkspaceCommand = vscode.commands.registerCommand(
      "cappyrag.indexWorkspace",
      async () => {
        try {
          await miniRAGCommands.indexWorkspace();
        } catch (error) {
          console.error("CappyRAG indexWorkspace error:", error);
          vscode.window.showErrorMessage(`CappyRAG indexWorkspace failed: ${error}`);
        }
      }
    );

    const miniRAGSearchCommand = vscode.commands.registerCommand(
      "cappyrag.search",
      async () => {
        try {
          await miniRAGCommands.search();
        } catch (error) {
          console.error("CappyRAG search error:", error);
          vscode.window.showErrorMessage(`CappyRAG search failed: ${error}`);
        }
      }
    );

    const miniRAGOpenGraphCommand = vscode.commands.registerCommand(
      "cappyrag.openGraph",
      async () => {
        try {
          // Open CappyRAG Dashboard on Graph tab
          await openDocumentUploadUI(context, 'graph');
        } catch (error) {
          console.error("CappyRAG openGraph error:", error);
          vscode.window.showErrorMessage(`CappyRAG openGraph failed: ${error}`);
        }
      }
    );

    const miniRAGIndexFileCommand = vscode.commands.registerCommand(
      "cappyrag.indexFile",
      async () => {
        try {
          await miniRAGCommands.indexFile();
        } catch (error) {
          console.error("CappyRAG indexFile error:", error);
          vscode.window.showErrorMessage(`CappyRAG indexFile failed: ${error}`);
        }
      }
    );

    const miniRAGPopulateSampleCommand = vscode.commands.registerCommand(
      "cappyrag.populateSampleData",
      async () => {
        try {
          const { populateSampleData } = await import('./commands/miniRAG/populateSampleData');
          await populateSampleData(context);
        } catch (error) {
          console.error("CappyRAG populateSampleData error:", error);
          vscode.window.showErrorMessage(`CappyRAG populateSampleData failed: ${error}`);
        }
      }
    );

    const miniRAGPauseWatcherCommand = vscode.commands.registerCommand(
      "cappyrag.pauseWatcher",
      async () => {
        try {
          await miniRAGCommands.pauseWatcher();
        } catch (error) {
          console.error("CappyRAG pauseWatcher error:", error);
          vscode.window.showErrorMessage(`CappyRAG pauseWatcher failed: ${error}`);
        }
      }
    );

    // Document Upload UI Command
    const documentUploadCommand = vscode.commands.registerCommand(
      "cappyrag.uploadUI",
      async () => {
        try {
          await openDocumentUploadUI(context);
        } catch (error) {
          console.error("Document upload UI error:", error);
          vscode.window.showErrorMessage(`Document upload failed: ${error}`);
        }
      }
    );

    // Register MCP Commands for standalone server communication
    const mcpAddDocumentCommand = vscode.commands.registerCommand(
      "cappy.mcp.addDocument",
      async (args: any) => {
        try {
          const addDocumentTool = new (await import('./tools/addDocumentTool')).AddDocumentTool(context);
          const result = await addDocumentTool.addDocument(
            args.filePath,
            args.title,
            args.author,
            args.tags,
            args.language,
            args.processingOptions
          );
          
          // Write result to temp file if specified
          if (args.resultFile) {
            const fs = await import('fs/promises');
            await fs.writeFile(args.resultFile, JSON.stringify(result, null, 2));
          }
          
          return result;
        } catch (error) {
          const errorResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          
          if (args.resultFile) {
            const fs = await import('fs/promises');
            await fs.writeFile(args.resultFile, JSON.stringify(errorResult, null, 2));
          }
          
          return errorResult;
        }
      }
    );

    const mcpQueryCommand = vscode.commands.registerCommand(
      "cappy.mcp.query",
      async (args: any) => {
        try {
          const queryTool = new (await import('./tools/queryTool')).QueryTool(context);
          const result = await queryTool.query(
            args.query,
            args.maxResults || 5,
            args.searchType || 'hybrid'
          );
          
          // Write result to temp file if specified
          if (args.resultFile) {
            const fs = await import('fs/promises');
            await fs.writeFile(args.resultFile, JSON.stringify(result, null, 2));
          }
          
          return result;
        } catch (error) {
          const errorResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          
          if (args.resultFile) {
            const fs = await import('fs/promises');
            await fs.writeFile(args.resultFile, JSON.stringify(errorResult, null, 2));
          }
          
          return errorResult;
        }
      }
    );

    const mcpGetStatsCommand = vscode.commands.registerCommand(
      "cappy.mcp.getStats",
      async (args: any) => {
        try {
          const getStatsTool = new (await import('./tools/getStatsTool')).GetStatsTool(context);
          const result = await getStatsTool.getStats();
          
          // Write result to temp file if specified
          if (args.resultFile) {
            const fs = await import('fs/promises');
            await fs.writeFile(args.resultFile, JSON.stringify(result, null, 2));
          }
          
          return result;
        } catch (error) {
          const errorResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          
          if (args.resultFile) {
            const fs = await import('fs/promises');
            await fs.writeFile(args.resultFile, JSON.stringify(errorResult, null, 2));
          }
          
          return errorResult;
        }
      }
    );

    // Register all commands
    context.subscriptions.push(
      initCommand,
      knowStackCommand,
      knowStackAliasCommand,
      knowTaskTypoAliasCommand,
      consentCommand,
      newTaskCommand,      
      getActiveTaskCommand,
      versionCommand,
      createTaskFileCommand,
      changeTaskStatusCmd,
      completeTaskCommand,
      addPreventionRuleCommand,
      removePreventionRuleCommand,
      workOnCurrentTaskCommand,
      // reindexCommand, // Temporarily disabled
      miniRAGIndexWorkspaceCommand,
      miniRAGSearchCommand,
      miniRAGOpenGraphCommand,
      miniRAGIndexFileCommand,
      miniRAGPopulateSampleCommand,
      miniRAGPauseWatcherCommand,
      documentUploadCommand,
      // MCP Commands
      mcpAddDocumentCommand,
      mcpQueryCommand,
      mcpGetStatsCommand
    );

    // Register LightRAG commands
    registerCappyRAGCommands(context);

    // Auto-copy XSD schemas when extension loads (if .cappy exists)
    checkAndCopyXsdSchemasAndCleanup();

  } catch (error) {
    vscode.window.showErrorMessage(
      `🦫 Cappy Memory activation failed: ${error}`
    );
  }
}

/**
 * Check if .cappy directory exists, copy XSD files and clean up legacy folders
 */
async function checkAndCopyXsdSchemasAndCleanup(): Promise<void> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return; // No workspace, nothing to do
    }

    const cappyPath = path.join(workspaceFolder.uri.fsPath, '.cappy');
    
    // Check if .cappy directory exists (project is initialized)
    try {
      await fs.promises.access(cappyPath, fs.constants.F_OK);
      
      // Project is initialized, copy XSD schemas
      const fileManager = new FileManager();
      await fileManager.copyXsdSchemas();
      
      // Clean up legacy instructions folder
      await cleanupLegacyInstructionsFolder(cappyPath);
      
      // Also update copilot-instructions.md automatically
      await updateCopilotInstructions(workspaceFolder.uri.fsPath);
      
      console.log('Cappy: XSD schemas copied, legacy folders cleaned and copilot-instructions.md updated automatically on startup');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // .cappy doesn't exist, project not initialized yet
        return;
      }
      // Other errors should be logged but not interrupt extension
      console.warn('Cappy: Failed to auto-copy XSD schemas, cleanup legacy folders or update copilot instructions:', error);
    }
  } catch (error) {
    console.warn('Cappy: Auto-copy XSD schemas check failed:', error);
  }
}

/**
 * Clean up legacy instructions folder that is no longer needed
 */
async function cleanupLegacyInstructionsFolder(cappyPath: string): Promise<void> {
  try {
    // Remove .cappy/instructions folder if it exists (no longer needed)
    const instructionsPath = path.join(cappyPath, 'instructions');
    try {
      await fs.promises.access(instructionsPath, fs.constants.F_OK);
      await fs.promises.rmdir(instructionsPath, { recursive: true });
      console.log('Cappy: Removed legacy instructions folder');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn('Cappy: Failed to remove instructions folder:', error);
      }
    }
  } catch (error) {
    console.warn('Cappy: Failed to cleanup legacy instructions folder:', error);
  }
}

/**
 * Update .github/copilot-instructions.md with latest template content
 */
async function updateCopilotInstructions(workspaceRoot: string): Promise<void> {
  try {
    const githubDir = path.join(workspaceRoot, '.github');
    const targetPath = path.join(githubDir, 'copilot-instructions.md');
    
    // Find extension root to get template
    // Try to get extension regardless of environment (Cursor or VS Code)
    const extension = vscode.extensions.getExtension('eduardocecon.cappy');
    if (!extension) {
      console.warn(`Cappy: Extension not found in ${EnvironmentDetector.getEnvironmentName()}, cannot update copilot instructions`);
      return;
    }
    
    const templatePath = path.join(extension.extensionPath, 'resources', 'templates', 'cappy-copilot-instructions.md');

    await fs.promises.mkdir(githubDir, { recursive: true });

    try {
      const tpl = await fs.promises.readFile(templatePath, 'utf8');
      const start = '<!-- CAPPY INI -->';
      const end = '<!-- CAPPY END -->';

      // If target doesn't exist, create with template
      let existing = '';
      try {
        existing = await fs.promises.readFile(targetPath, 'utf8');
      } catch (e: any) {
        if (e?.code === 'ENOENT') {
          await fs.promises.writeFile(targetPath, tpl, 'utf8');
          return;
        }
        throw e;
      }

      const hasStart = existing.includes(start);
      const hasEnd = existing.includes(end);
      
      if (!hasStart || !hasEnd) {
        // No markers; overwrite entire file to align with template once
        await fs.promises.writeFile(targetPath, tpl, 'utf8');
        return;
      }

      // Replace only the marked block
      const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
      
      // Extract content between markers from template
      const templatePattern = new RegExp(`${start}([\\s\\S]*?)${end}`);
      const templateMatch = templatePattern.exec(tpl);
      const templateContent = templateMatch ? templateMatch[1].trim() : tpl.trim();
      
      // Replace with markers preserved
      const replacement = `${start}\n${templateContent}\n${end}`;
      const updated = existing.replace(pattern, replacement);
      await fs.promises.writeFile(targetPath, updated, 'utf8');
      
      console.log('Cappy: copilot-instructions.md updated successfully');
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        // If template is missing, keep existing file or create a minimal header
        try {
          await fs.promises.access(targetPath, fs.constants.F_OK);
        } catch {
          await fs.promises.writeFile(targetPath, '# Cappy Copilot Instructions\n', 'utf8');
        }
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.warn('Cappy: Failed to update copilot-instructions.md:', error);
  }
}

export async function deactivate() {
  console.log('🦫 Cappy: Deactivating...');
  vscode.window.showInformationMessage(`🦫 Cappy Memory: Deactivated`);
}
