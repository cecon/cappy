/**
 * @fileoverview OpenAI-compatible provider gateway with SecretStorage.
 * @module infrastructure/providers/ProviderGateway
 */

import * as vscode from 'vscode';
import type {
  IProviderGateway,
  ProviderChatRequest,
  ProviderChatResponse,
  ProviderSettings,
} from '../../../shared/types/agent';

const API_KEY_SECRET = 'cappy.provider.apiKey';

/**
 * Provides chat completions through OpenAI-compatible HTTP APIs.
 */
export class ProviderGateway implements IProviderGateway {
  constructor(private readonly secretStorage: vscode.SecretStorage) {}

  /**
   * Loads effective provider settings from extension configuration + secrets.
   */
  async getSettings(): Promise<ProviderSettings> {
    const config = vscode.workspace.getConfiguration('cappy.provider');
    const apiKey = await this.secretStorage.get(API_KEY_SECRET);
    return {
      baseUrl: config.get<string>('baseUrl', 'https://api.openai.com/v1'),
      model: config.get<string>('model', 'gpt-4o-mini'),
      backend: config.get<'openai' | 'openclaude'>('backend', 'openai'),
      apiKey: apiKey ?? undefined,
    };
  }

  /**
   * Persists provider API key in VS Code SecretStorage.
   */
  async setApiKey(apiKey: string): Promise<void> {
    await this.secretStorage.store(API_KEY_SECRET, apiKey);
  }

  /**
   * Executes a minimal non-streaming health check against provider endpoint.
   */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.chat({
        systemPrompt: 'You are a connectivity check endpoint. Reply with "ok".',
        prompt: 'ok',
      });
      return { ok: true, message: 'Conexão com provider validada.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Falha de conexão: ${message}` };
    }
  }

  /**
   * Sends one chat completion request to OpenAI-compatible endpoint.
   */
  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    const settings = await this.getSettings();
    if (settings.backend !== 'openai') {
      throw new Error('ProviderGateway.chat só suporta backend openai diretamente.');
    }
    if (!settings.baseUrl) {
      throw new Error('cappy.provider.baseUrl não configurado.');
    }

    const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const messages = [
      request.systemPrompt ? { role: 'system', content: request.systemPrompt } : null,
      { role: 'user', content: request.prompt },
    ].filter(Boolean);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: request.model ?? settings.model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Provider HTTP ${response.status}: ${body}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('Provider retornou resposta vazia.');
    }
    return {
      text,
      model: payload.model ?? request.model ?? settings.model,
    };
  }
}

