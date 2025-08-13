import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function getExtensionRoot(context?: vscode.ExtensionContext): string {
    const candidates = [
        context?.extensionPath,
        path.resolve(__dirname, '../..'),
        path.resolve(__dirname, '../../..')
    ].filter(Boolean) as string[];
    for (const base of candidates) {
        const probe = path.join(base, 'resources', 'instructions', 'script-knowstack.xml');
        if (fs.existsSync(probe)) {
            return base;
        }
    }
    return (candidates[0] as string) || process.cwd();
}

async function readKnowStackScript(context?: vscode.ExtensionContext): Promise<string> {
    try {
        const extRoot = getExtensionRoot(context);
        const filePath = path.join(extRoot, 'resources', 'instructions', 'script-knowstack.xml');
        const content = await fs.promises.readFile(filePath, 'utf8');
        return content;
    } catch {
        return '';
    }
}

export async function runKnowStack(context?: vscode.ExtensionContext): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('Cappy: open a workspace folder to run KnowStack.');
        return await readKnowStackScript(context);
    }

    let script = '';
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🧠 Cappy: KnowStack',
        cancellable: false,
    }, async (_) => {
        const cappyDir = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy');
        await vscode.workspace.fs.createDirectory(cappyDir);

        const stackFile = vscode.Uri.joinPath(cappyDir, 'stack.md');
        try {
            await vscode.workspace.fs.stat(stackFile);
        } catch {
            await vscode.workspace.fs.writeFile(stackFile, Buffer.from(''));
        }

        await vscode.window.showTextDocument(stackFile, { preview: false });

        script = await readKnowStackScript(context);
    });

    return script;
}
