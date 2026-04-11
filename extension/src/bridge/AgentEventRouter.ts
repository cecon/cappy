/**
 * Translates AgentRunEvents into webview postMessage payloads.
 * Extracted from CappyCompositionRoot to keep each file under 300 lines.
 */

import * as vscode from "vscode";

import type { AgentRunEvent } from "../application/dto/AgentDtos";
import type { ILogger } from "../domain/ports/ILogger";
import {
  isAgentShellTool,
  parseShellToolResultString,
  shellToolMeta,
  truncateShellText,
} from "./agentShellMirror";

/**
 * Routes one AgentRunEvent to the webview via postMessage.
 * Shell tool events (Bash/runTerminal) get an extra mirror message.
 */
export function routeAgentEvent(
  event: AgentRunEvent,
  webview: vscode.Webview,
  logger: ILogger,
): void {
  switch (event.type) {
    case "stream:token":
      post(webview, { type: "stream:token", token: event.token });
      break;

    case "stream:done":
      post(webview, { type: "stream:done" });
      break;

    case "stream:system":
      post(webview, { type: "stream:system", message: event.message });
      break;

    case "context:usage":
      post(webview, { type: "context:usage", ...event.payload });
      break;

    case "tool:confirm":
      post(webview, { type: "tool:confirm", toolCall: event.toolCall });
      break;

    case "tool:rejected":
      post(webview, { type: "tool:rejected", toolCall: event.toolCall });
      break;

    case "error":
      logger.error("Agent error", event.error);
      post(webview, { type: "error", message: event.error.message });
      break;

    case "tool:executing":
      post(webview, { type: "tool:executing", toolCall: event.toolCall });
      if (isAgentShellTool(event.toolCall.name)) {
        const { command, cwd } = shellToolMeta(event.toolCall);
        post(webview, {
          type: "agent:shell:start",
          command,
          ...(cwd !== undefined ? { cwd } : {}),
        });
      }
      break;

    case "tool:result": {
      const { toolCall, result, fileDiff } = event;
      post(webview, {
        type: "tool:result",
        toolCall,
        result,
        ...(fileDiff ? { fileDiff } : {}),
      });
      if (isAgentShellTool(toolCall.name)) {
        const { command } = shellToolMeta(toolCall);
        const parsed = parseShellToolResultString(result);
        post(webview, {
          type: "agent:shell:complete",
          command,
          stdout: parsed ? truncateShellText(parsed.stdout) : "",
          stderr: parsed ? truncateShellText(parsed.stderr) : "",
          ...(parsed ? {} : { errorText: truncateShellText(result) }),
        });
      }
      break;
    }
  }
}

function post(webview: vscode.Webview, message: Record<string, unknown>): void {
  void webview.postMessage(message);
}
