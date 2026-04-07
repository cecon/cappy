/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IVSCodeExtensionContext } from '../../../platform/extContext/common/extensionContext';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { IExtensionContribution } from '../../common/contributions';
import { CappyLlmSelector } from './cappyLlmSelector';
import { CappyProviderGateway } from './cappyProviderGateway';

/**
 * Registers Cappy LLM commands and provider compatibility flow.
 */
export class CappyLlmContribution extends Disposable implements IExtensionContribution {
	/**
	 * Contribution identifier.
	 */
	id = 'cappyLlmContribution';

	constructor(
		@IVSCodeExtensionContext private readonly _extensionContext: IVSCodeExtensionContext,
	) {
		super();

		this._register(vscode.commands.registerCommand('cappy.provider.testConnection', async () => {
			const gateway = new CappyProviderGateway(this._extensionContext.secrets);
			const result = await gateway.testConnection();
			if (result.ok) {
				await vscode.window.showInformationMessage(result.message);
			} else {
				await vscode.window.showErrorMessage(result.message);
			}
		}));

		this._register(vscode.commands.registerCommand('cappy.llm.selectBestModel', async () => {
			const model = await CappyLlmSelector.selectBestModel();
			if (!model) {
				await vscode.window.showWarningMessage('Nenhum modelo LLM disponível para o perfil atual.');
				return;
			}
			await vscode.window.showInformationMessage(`Modelo selecionado: ${model.name}`);
		}));

		this._register(vscode.commands.registerCommand('cappy.provider.listModels', async () => {
			const gateway = new CappyProviderGateway(this._extensionContext.secrets);
			const models = await gateway.listModels();
			const picked = await vscode.window.showQuickPick(models, {
				placeHolder: 'Modelos disponíveis no provider configurado'
			});
			if (picked) {
				await vscode.workspace.getConfiguration('cappy.provider').update('model', picked, vscode.ConfigurationTarget.Global);
				await vscode.window.showInformationMessage(`Modelo selecionado: ${picked}`);
			}
		}));
	}
}
