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
import { ReindexCommand } from "./commands/reindexCommand";
import { FileManager } from "./utils/fileManager";
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  try {
    // Show immediate activation message
    vscode.window.showInformationMessage("🦫 Cappy Memory: Activating...");

  // Shared output channel for surfaced internal scripts / diagnostics
  const cappyOutput = vscode.window.createOutputChannel('Cappy');
  context.subscriptions.push(cappyOutput);

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
          const version = await mod.getVersion();
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
    const reindexCommand = vscode.commands.registerCommand(
      "cappy.reindex",
      async () => {
        try {
          const cmd = new ReindexCommand(context);
          const result = await cmd.execute();
          return result;
        } catch (error) {
          console.error("Cappy reindex error:", error);
          vscode.window.showErrorMessage(`Cappy reindex failed: ${error}`);
          return "";
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
      reindexCommand
    );

    // Auto-copy XSD schemas when extension loads (if .cappy exists)
    checkAndCopyXsdSchemas();

  } catch (error) {
    vscode.window.showErrorMessage(
      `🦫 Cappy Memory activation failed: ${error}`
    );
  }
}

/**
 * Check if .cappy directory exists and copy XSD files automatically
 */
async function checkAndCopyXsdSchemas(): Promise<void> {
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
      
      console.log('Cappy: XSD schemas copied automatically on startup');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // .cappy doesn't exist, project not initialized yet
        return;
      }
      // Other errors should be logged but not interrupt extension
      console.warn('Cappy: Failed to auto-copy XSD schemas:', error);
    }
  } catch (error) {
    console.warn('Cappy: Auto-copy XSD schemas check failed:', error);
  }
}

export function deactivate() {
  vscode.window.showErrorMessage(`🦫 Cappy Memory: Deactivation`);
}
