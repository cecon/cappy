import * as vscode from 'vscode';

export async function runKnowStack(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('Cappy: open a workspace folder to run KnowStack.');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🧠 Capy: KnowStack',
        cancellable: false,
    }, async (progress) => {
        const cappyDir = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy');
        await vscode.workspace.fs.createDirectory(cappyDir);

        const stackFile = vscode.Uri.joinPath(cappyDir, 'stack.md');
        try {
            await vscode.workspace.fs.stat(stackFile);
        } catch {
            await vscode.workspace.fs.writeFile(stackFile, Buffer.from(''));
        }

        await vscode.window.showTextDocument(stackFile, { preview: false });
    vscode.window.showInformationMessage('🧠 Capy: KnowStack started. Answer one-by-one to build .cappy/stack.md and then mark it validated in .cappy/config.yaml.');
    });
}
