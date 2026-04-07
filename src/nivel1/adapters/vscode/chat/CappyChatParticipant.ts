/**
 * @fileoverview Native VS Code chat participant adapter for @cappy.
 * @module adapters/vscode/chat/CappyChatParticipant
 */

import * as vscode from 'vscode';

/**
 * Normalized native chat request payload.
 */
export interface CappyChatParticipantRequest {
  /**
   * Prompt text sent by user.
   */
  prompt: string;
  /**
   * Optional command selected in participant UI.
   */
  command?: string;
}

/**
 * Native chat response payload.
 */
export interface CappyChatParticipantResponse {
  /**
   * Final markdown text.
   */
  text: string;
  /**
   * Optional active session id.
   */
  sessionId?: string;
  /**
   * Tool timeline for progress rendering.
   */
  toolCalls?: Array<{
    tool: string;
    status: 'running' | 'done' | 'error';
    input?: string;
    output?: string;
  }>;
}

/**
 * External callbacks required by participant adapter.
 */
export interface CappyChatParticipantCallbacks {
  /**
   * Handles one native chat request.
   */
  onRequest: (request: CappyChatParticipantRequest) => Promise<CappyChatParticipantResponse>;
}

/**
 * Registers @cappy participant using best-effort runtime API detection.
 */
export class CappyChatParticipant {
  constructor(private readonly callbacks: CappyChatParticipantCallbacks) {}

  /**
   * Registers native participant when host API is available.
   */
  register(context: vscode.ExtensionContext): void {
    const chatApi = (vscode as unknown as {
      chat?: {
        createChatParticipant?: (
          id: string,
          handler: (
            request: unknown,
            chatContext: unknown,
            stream: unknown,
            token: vscode.CancellationToken,
          ) => Promise<unknown>,
        ) => vscode.Disposable;
      };
    }).chat;

    if (!chatApi?.createChatParticipant) {
      console.log('  ⚠️ Native chat participant API indisponível neste host.');
      return;
    }

    const participant = chatApi.createChatParticipant(
      'cappy.chat',
      async (request, _chatContext, stream, _token) => {
        const normalized = this.normalizeRequest(request);
        const response = await this.callbacks.onRequest(normalized);
        this.writeToolProgress(stream, response.toolCalls ?? []);
        await this.streamMarkdown(stream, response.text);
        return {
          metadata: {
            sessionId: response.sessionId,
          },
        };
      },
    );

    context.subscriptions.push(participant);
    console.log('  ✅ Registered native @cappy chat participant');
  }

  /**
   * Converts host request object into normalized payload.
   */
  private normalizeRequest(request: unknown): CappyChatParticipantRequest {
    const payload = request as {
      prompt?: string;
      command?: string;
    };
    const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : '';
    const command = typeof payload?.command === 'string' ? payload.command : undefined;
    return {
      prompt,
      command,
    };
  }

  /**
   * Streams markdown in small chunks for visible progress.
   */
  private async streamMarkdown(stream: unknown, text: string): Promise<void> {
    const runtime = stream as {
      markdown?: (value: string) => void;
      progress?: (value: string) => void;
    };
    const chunks = text.match(/.{1,200}/gs) ?? [text];
    for (const chunk of chunks) {
      if (runtime.markdown) {
        runtime.markdown(chunk);
      } else if (runtime.progress) {
        runtime.progress(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  }

  /**
   * Emits tool-call progress in native chat stream.
   */
  private writeToolProgress(
    stream: unknown,
    toolCalls: Array<{ tool: string; status: 'running' | 'done' | 'error'; output?: string }>,
  ): void {
    if (!toolCalls.length) {
      return;
    }
    const runtime = stream as {
      progress?: (value: string) => void;
      markdown?: (value: string) => void;
    };
    for (const call of toolCalls) {
      const line = `Tool ${call.tool}: ${call.status}${call.output ? ` - ${call.output}` : ''}`;
      if (runtime.progress) {
        runtime.progress(line);
      } else if (runtime.markdown) {
        runtime.markdown(`${line}\n`);
      }
    }
  }
}

