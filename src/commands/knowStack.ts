import * as vscode from 'vscode';

export async function runKnowStack(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('Capybara: open a workspace folder to run KnowStack.');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🧠 Capy: KnowStack',
        cancellable: false,
    }, async (progress) => {
        const instructionsDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'instructions');
        await vscode.workspace.fs.createDirectory(instructionsDir);

        const stackFile = vscode.Uri.joinPath(instructionsDir, 'copilot.stack.md');
        try {
            await vscode.workspace.fs.stat(stackFile);
        } catch {
            await vscode.workspace.fs.writeFile(stackFile, Buffer.from(''));
        }

        await vscode.window.showTextDocument(stackFile, { preview: false });
        vscode.window.showInformationMessage('🧠 Capy: KnowStack started. Please answer questions one by one so we can build the stack file.');
    });
}
