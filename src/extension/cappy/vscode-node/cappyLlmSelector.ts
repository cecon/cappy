/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Selects the best available VS Code language model following Cappy strategy.
 */
export class CappyLlmSelector {
	/**
	 * Resolves the best model using preferred model with fallback chain.
	 */
	static async selectBestModel(): Promise<vscode.LanguageModelChat | null> {
		try {
			const config = vscode.workspace.getConfiguration('cappy.llm');
			const preferredModel = config.get<string>('preferredModel', 'auto');

			if (preferredModel !== 'auto') {
				const selected = await this.selectModel(preferredModel);
				if (selected) {
					return selected;
				}
			}

			let models = await vscode.lm.selectChatModels({
				vendor: 'copilot',
				family: 'claude-sonnet'
			});
			if (models.length > 0) {
				return models[0];
			}

			models = await vscode.lm.selectChatModels({
				vendor: 'copilot',
				family: 'gpt-4o'
			});
			if (models.length > 0) {
				return models[0];
			}

			models = await vscode.lm.selectChatModels({
				vendor: 'copilot',
				family: 'gpt-4'
			});
			if (models.length > 0) {
				return models[0];
			}

			models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
			return models.length > 0 ? models[0] : null;
		} catch {
			return null;
		}
	}

	/**
	 * Selects a specific model family from Copilot vendor.
	 */
	static async selectModel(family: string): Promise<vscode.LanguageModelChat | null> {
		try {
			const models = await vscode.lm.selectChatModels({
				vendor: 'copilot',
				family
			});
			return models.length > 0 ? models[0] : null;
		} catch {
			return null;
		}
	}
}
