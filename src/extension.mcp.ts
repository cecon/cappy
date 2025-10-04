import * as vscode from "vscode";
import {
  ensureTelemetryConsent,
  showConsentWebview,
} from "./commands/telemetryConsent";
import { openDocumentUploadUI } from "./commands/documentUpload";
import { LightRAGMCPServer } from "./tools/mcpServer";
import { EnvironmentDetector } from "./utils/environmentDetector";

export function activate(context: vscode.ExtensionContext) {
  try {
    console.log('🦫 Cappy MCP: Starting activation...');
    
    // Show immediate activation message
    const welcomeMessage = EnvironmentDetector.getWelcomeMessage();
    vscode.window.showInformationMessage(welcomeMessage);
    console.log(`Cappy: Running in ${EnvironmentDetector.getEnvironmentName()}`);

    // Shared output channel
    const cappyOutput = vscode.window.createOutputChannel('Cappy');
    context.subscriptions.push(cappyOutput);

    console.log('🦫 Cappy MCP: Output channel created...');

    // Register LightRAG MCP Server for document processing
    const mcpServer = new LightRAGMCPServer(context);
    mcpServer.registerTools();
    console.log('🛠️ Cappy MCP: LightRAG MCP tools registered');

    // Telemetry consent
    ensureTelemetryConsent(context)
      .then((accepted) => {
        if (!accepted) {
          console.log("Telemetry consent declined. Telemetry will remain disabled.");
        }
      })
      .catch((err) => {
        console.warn("Failed to ensure telemetry consent:", err);
      });

    // Version command
    const versionCommand = vscode.commands.registerCommand(
      "cappy.version",
      async () => {
        try {
          const packageJson = require("../package.json");
          const version = packageJson.version;
          vscode.window.showInformationMessage(`🦫 Cappy version: ${version}`);
          cappyOutput.appendLine(`[version] Cappy version: ${version}`);
          cappyOutput.show(true);
          return version;
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to get Cappy version: ${error}`);
          return "";
        }
      }
    );

    // Consent command
    const consentCommand = vscode.commands.registerCommand(
      "cappy.viewTelemetryTerms",
      async () => {
        try {
          await showConsentWebview(context);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to show consent: ${error}`);
        }
      }
    );

    // Document Upload UI Command
    const documentUploadCommand = vscode.commands.registerCommand(
      "cappy.lightrag.uploadUI",
      async () => {
        try {
          await openDocumentUploadUI(context);
        } catch (error) {
          console.error("Document upload UI error:", error);
          vscode.window.showErrorMessage(`Document upload failed: ${error}`);
        }
      }
    );

    // Register commands
    context.subscriptions.push(
      versionCommand,
      consentCommand,
      documentUploadCommand
    );

    console.log('🎉 Cappy MCP: Activation completed successfully');

  } catch (error) {
    vscode.window.showErrorMessage(`🦫 Cappy MCP activation failed: ${error}`);
  }
}

export function deactivate() {
  console.log('🦫 Cappy MCP: Deactivated');
}