/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	CAPPY_PROVIDER_API_KEY_SECRET,
	DEFAULT_CAPPY_PROVIDER_BACKEND,
	DEFAULT_CAPPY_PROVIDER_BASE_URL,
	DEFAULT_CAPPY_PROVIDER_MODEL
} from '../common/cappyLlmConfig';

/**
 * Shape of provider settings used by Cappy compatibility layer.
 */
export interface CappyProviderSettings {
	baseUrl: string;
	model: string;
	backend: 'openai' | 'openclaude';
	apiKey?: string;
}

/**
 * Request payload for provider chat operation.
 */
export interface CappyProviderChatRequest {
	systemPrompt?: string;
	prompt: string;
	model?: string;
}

/**
 * Response payload returned by provider chat operation.
 */
export interface CappyProviderChatResponse {
	text: string;
	model: string;
}

/**
 * OpenAI-compatible provider gateway with VS Code SecretStorage support.
 */
export class CappyProviderGateway {
	constructor(private readonly secretStorage: vscode.SecretStorage) { }

	/**
	 * Loads effective provider settings from extension configuration and secrets.
	 */
	async getSettings(): Promise<CappyProviderSettings> {
		const config = vscode.workspace.getConfiguration('cappy.provider');
		const apiKey = await this.secretStorage.get(CAPPY_PROVIDER_API_KEY_SECRET);
		return {
			baseUrl: config.get<string>('baseUrl', DEFAULT_CAPPY_PROVIDER_BASE_URL),
			model: config.get<string>('model', DEFAULT_CAPPY_PROVIDER_MODEL),
			backend: config.get<'openai' | 'openclaude'>('backend', DEFAULT_CAPPY_PROVIDER_BACKEND),
			apiKey: apiKey ?? undefined
		};
	}

	/**
	 * Persists provider API key in VS Code SecretStorage.
	 */
	async setApiKey(apiKey: string): Promise<void> {
		await this.secretStorage.store(CAPPY_PROVIDER_API_KEY_SECRET, apiKey);
	}

	/**
	 * Executes one chat completion request to an OpenAI-compatible endpoint.
	 */
	async chat(request: CappyProviderChatRequest): Promise<CappyProviderChatResponse> {
		const settings = await this.getSettings();
		if (!settings.baseUrl) {
			throw new Error('cappy.provider.baseUrl não configurado.');
		}
		if (settings.backend !== 'openai') {
			throw new Error('CappyProviderGateway.chat suporta apenas backend openai diretamente.');
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
				stream: false
			})
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`Provider HTTP ${response.status}: ${body}`);
		}

		const payload = await response.json() as {
			choices?: Array<{ message?: { content?: string } }>;
			model?: string;
		};
		const text = payload.choices?.[0]?.message?.content?.trim();
		if (!text) {
			throw new Error('Provider retornou resposta vazia.');
		}
		return {
			text,
			model: payload.model ?? request.model ?? settings.model
		};
	}

	/**
	 * Runs a minimal non-streaming connectivity check.
	 */
	async testConnection(): Promise<{ ok: boolean; message: string }> {
		try {
			await this.chat({
				systemPrompt: 'You are a connectivity check endpoint. Reply with "ok".',
				prompt: 'ok'
			});
			return { ok: true, message: 'Conexão com provider validada.' };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { ok: false, message: `Falha de conexão: ${message}` };
		}
	}

	/**
	 * Lists available model slugs from OpenAI-compatible /models endpoint.
	 */
	async listModels(): Promise<string[]> {
		const settings = await this.getSettings();
		if (settings.backend !== 'openai') {
			return [settings.model];
		}
		if (!settings.baseUrl) {
			return [settings.model];
		}
		try {
			const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/models`;
			const response = await fetch(endpoint, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {})
				}
			});
			if (!response.ok) {
				return [settings.model];
			}
			const payload = await response.json() as {
				data?: Array<{
					id?: string;
					name?: string;
					canonical_slug?: string;
				}>;
			};
			const models = (payload.data ?? [])
				.map(item => item.id ?? item.canonical_slug ?? item.name ?? '')
				.map(item => item.trim())
				.filter(item => item.length > 0);
			const unique = Array.from(new Set([settings.model, ...models]));
			return unique;
		} catch {
			return [settings.model];
		}
	}
}
