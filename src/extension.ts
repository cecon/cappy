import * as vscode from 'vscode';
import { ensureTelemetryConsent, showConsentWebview } from './commands/telemetryConsent';

export function activate(context: vscode.ExtensionContext) {
    console.log('🦫 Capybara Memory: Starting activation...');
    
    try {
        // Show immediate activation message
        vscode.window.showInformationMessage('🦫 Capybara Memory: Activating...');

        // Telemetry consent gating (one-time and on updates)
        ensureTelemetryConsent(context).then((accepted) => {
            if (!accepted) {
                console.log('Telemetry consent declined. Telemetry will remain disabled.');
            }
        }).catch(err => {
            console.warn('Failed to ensure telemetry consent:', err);
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

            const ensureStackKnown = async (): Promise<boolean> => {
                try {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (!workspaceFolder) {
                        return false;
                    }

                    const cfgPath = vscode.Uri.joinPath(workspaceFolder.uri, '.capy', 'config.yaml');
                    if (!(await uriExists(cfgPath))) {
                        return false;
                    }

                    const cfgBytes = await vscode.workspace.fs.readFile(cfgPath);
                    const cfg = Buffer.from(cfgBytes).toString('utf8');

                    // Find the LAST stack block occurrence for source/validated
                    const stackBlocks = Array.from(cfg.matchAll(/stack:\s*([\s\S]*?)(?=\n[^\s]|$)/g));
                    const lastBlock = stackBlocks.length ? stackBlocks[stackBlocks.length - 1][1] : '';
                    const sourceMatch = /source:\s*"?(.+?)"?/m.exec(lastBlock);
                    const validatedMatch = /validated:\s*true/m.exec(lastBlock);
                    const source = sourceMatch ? sourceMatch[1] : '.capy/stack.md';

                    // Resolve source path
                    const stackUri = source.startsWith('.') 
                        ? vscode.Uri.joinPath(workspaceFolder.uri, source.replace(/^\.[/\\]/, ''))
                        : vscode.Uri.file(source);

                    const stackExists = await uriExists(stackUri);
                    return !!validatedMatch && stackExists;
                } catch {
                    return false;
                }
            };

        // Register init command (always run init; KnowStack must not block it)
        const initCommand = vscode.commands.registerCommand('capybara.init', async () => {
            try {
                vscode.window.showInformationMessage('🦫 Capybara Memory: Init command called!');

                // Load the full init implementation
                try {
                    const initModule = await import('./commands/initCapybara');

                    const initCommand = new initModule.InitCapybaraCommand(context);

                    const success = await initCommand.execute();
                    if (success) {
                        vscode.window.showInformationMessage('🦫 Capybara Memory: Initialization completed successfully!');
                    } else {
                        vscode.window.showWarningMessage('🦫 Capybara Memory: Initialization was cancelled or failed.');
                    }
                } catch (importError) {
                    console.error('Error loading InitCapybaraCommand:', importError);
                    vscode.window.showErrorMessage(`Capybara Memory: Init feature failed to load: ${importError}`);
                }
            } catch (error) {
                console.error('Capybara Memory Init error:', error);
                vscode.window.showErrorMessage(`Capybara Memory Init failed: ${error}`);
            }
        });

        // Register knowstack command
        const knowStackCommand = vscode.commands.registerCommand('capybara.knowstack', async () => {
            try {
                const mod = await import('./commands/knowStack');
                await mod.runKnowStack();
            } catch (error) {
                console.error('Capybara KnowStack error:', error);
                vscode.window.showErrorMessage(`Capybara KnowStack failed: ${error}`);
            }
        });

        // Register manual consent view command
        const consentCommand = vscode.commands.registerCommand('capybara.viewTelemetryTerms', async () => {
            try {
                await showConsentWebview(context);
            } catch (err) {
                vscode.window.showErrorMessage(`Falha ao abrir termos: ${err}`);
            }
        });

        // Register all commands
        context.subscriptions.push(
            initCommand,
            knowStackCommand,
            consentCommand
        );
        
        console.log('🦫 Capybara Memory: All commands registered successfully');
        vscode.window.showInformationMessage('🦫 Capybara Memory: Ready! Use "Capybara: Initialize" to set up your project.');
        
    } catch (error) {
        console.error('🦫 Capybara Memory: Activation failed:', error);
        vscode.window.showErrorMessage(`🦫 Capybara Memory activation failed: ${error}`);
    }
}

export function deactivate() {
    console.log('🦫 Capybara Memory: Deactivation');
}
