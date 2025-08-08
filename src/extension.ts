import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('🦫 Capybara Memory: Starting activation...');
    
    try {
        // Show immediate activation message
        vscode.window.showInformationMessage('🦫 Capybara Memory: Activating...');

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
                    const stackPath = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'instructions', 'copilot.stack.md');
                    const copilotInstructionsPath = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'copilot-instructions.md');
                    // Check files exist
                    const stackExists = await uriExists(stackPath);
                    const instructionsExists = await uriExists(copilotInstructionsPath);
                    if (!stackExists || !instructionsExists) {
                        return false;
                    }
                    // Read and look for CAPY:CONFIG markers and minimal yaml flags
                    const contentBytes = await vscode.workspace.fs.readFile(copilotInstructionsPath);
                    const content = Buffer.from(contentBytes).toString('utf8');
                    const hasMarkers = /<!--\s*CAPY:CONFIG:BEGIN\s*-->[\s\S]*?<!--\s*CAPY:CONFIG:END\s*-->/m.test(content);
                    if (!hasMarkers) {
                        return false;
                    }
                    const hasStackRef = /capy-config:[\s\S]*?stack:[\s\S]*?source:\s*"?\.github\/instructions\/copilot\.stack\.md"?/m.test(content);
                    const hasValidatedAt = /last-validated-at:\s*"?[0-9T:\-.Z]+"?/m.test(content);
                    return hasStackRef && hasValidatedAt;
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

        // Register all commands
        context.subscriptions.push(
            initCommand,
            knowStackCommand
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
