import * as vscode from "vscode";
import {
  ensureTelemetryConsent,
  showConsentWebview,
} from "./commands/telemetryConsent";
import getNewTaskInstruction from "./commands/getNewTaskInstruction";
import getActiveTask from "./commands/getActiveTask";

export function activate(context: vscode.ExtensionContext) {
  console.log("🦫 Cappy Memory: Starting activation...");

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

    // (removed) test command

    // Helper: gating check - ensure stack is known/validated
    const uriExists = async (uri: vscode.Uri): Promise<boolean> => {
      try {
        await vscode.workspace.fs.stat(uri);
        return true;
      } catch {
        return false;
      }
    };

    // Register init command (always run init; KnowStack must not block it)
    const initCommand = vscode.commands.registerCommand(
      "cappy.init",
      async () => {
        try {                    
          try {
            const initModule = await import("./commands/initCappy");

            const initCommand = new initModule.InitCappyCommand(context);

            const success = await initCommand.execute();
            if (success) {
              vscode.window.showInformationMessage(
                "🦫 Cappy Memory: Initialization completed successfully!"
              );
            } else {
              vscode.window.showWarningMessage(
                "🦫 Cappy Memory: Initialization was cancelled or failed."
              );
            }
          } catch (importError) {
            console.error("Error loading InitCappyCommand:", importError);
            vscode.window.showErrorMessage(
              `Cappy Memory: Init feature failed to load: ${importError}`
            );
          }
        } catch (error) {
          console.error("Cappy Memory Init error:", error);
          vscode.window.showErrorMessage(
            `Cappy Memory Init failed: ${error}`
          );
        }
      }
    );

    // Register knowstack command
    const knowStackCommand = vscode.commands.registerCommand(
      "cappy.knowstack",
      async () => {
        try {
          const mod = await import("./commands/knowStack");
          await mod.runKnowStack();
        } catch (error) {
          console.error("Cappy KnowStack error:", error);
          vscode.window.showErrorMessage(`Cappy KnowStack failed: ${error}`);
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

    // Aliases to the same implementation
    const getNewTaskInstructionCommandAlias1 = vscode.commands.registerCommand(
      "cappy.getNewTaskInstruction",
      async (args?: Record<string, string>) => {
        return vscode.commands.executeCommand(
          "cappy.getNewTaskInstruction",
          args
        );
      }
    );
    const getNewTaskInstructionCommandAlias2 = vscode.commands.registerCommand(
      "cappy-get-new-task-istruction",
      async (args?: Record<string, string>) => {
        return vscode.commands.executeCommand(
          "cappy.getNewTaskInstruction",
          args
        );
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
      consentCommand,
      getNewTaskInstructionCommand,
      getNewTaskInstructionCommandAlias1,
      getNewTaskInstructionCommandAlias2,
      getActiveTaskCommand
    );

    console.log("🦫 Cappy Memory: All commands registered successfully");
    vscode.window.showInformationMessage(
      '🦫 Cappy Memory: Ready! Use "Cappy: Initialize" to set up your project.'
    );
  } catch (error) {
    console.error("🦫 Cappy Memory: Activation failed:", error);
    vscode.window.showErrorMessage(
      `🦫 Cappy Memory activation failed: ${error}`
    );
  }
}

export function deactivate() {
  console.log("🦫 Cappy Memory: Deactivation");
}
