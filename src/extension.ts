import * as vscode from "vscode";
import {
  ensureTelemetryConsent,
  showConsentWebview,
} from "./commands/telemetryConsent";
import getNewTaskInstruction from "./commands/getNewTaskInstruction";
import getActiveTask from "./commands/getActiveTask";

export function activate(context: vscode.ExtensionContext) {
  try {
    // Show immediate activation message
    vscode.window.showInformationMessage("🦫 Cappy Memory: Activating...");

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
      async () => {
        try {
          const mod = await import("./commands/knowStack");
          const script: string = await mod.runKnowStack(context);
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

    // Register: get new task instruction (returns processed template content)
    const getNewTaskInstructionCommand = vscode.commands.registerCommand(
      "cappy.getNewTaskInstruction",
      async (args?: Record<string, string>) => {
        try {
          const content = await getNewTaskInstruction(context, args);
          return content; // important: return string so LLM can consume it via executeCommand
        } catch (error) {
          console.error("Cappy getNewTaskInstruction error:", error);
          vscode.window.showErrorMessage(
            `Cappy getNewTaskInstruction failed: ${error}`
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

    // Register all commands
    context.subscriptions.push(
      initCommand,
      knowStackCommand,
      knowStackAliasCommand,
  knowTaskTypoAliasCommand,
      consentCommand,
      getNewTaskInstructionCommand,      
      getActiveTaskCommand
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `🦫 Cappy Memory activation failed: ${error}`
    );
  }
}

export function deactivate() {
  vscode.window.showErrorMessage(`🦫 Cappy Memory: Deactivation`);
}
