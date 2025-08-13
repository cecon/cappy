import * as vscode from 'vscode';

/**
 * Returns the raw XML string of the active task file, if it exists.
 * Falls back to the exact string "No activit task found" when not available.
 */
export async function getActiveTask(): Promise<string> {
    try {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            return 'No activit task found';
        }

        const uriExists = async (uri: vscode.Uri): Promise<boolean> => {
            try {
                await vscode.workspace.fs.stat(uri);
                return true;
            } catch {
                return false;
            }
        };

        const stateUri = vscode.Uri.joinPath(ws.uri, '.cappy', 'state', 'current-task.json');
        if (!(await uriExists(stateUri))) {
            return 'No activit task found';
        }

        const stateBytes = await vscode.workspace.fs.readFile(stateUri);
        const stateText = Buffer.from(stateBytes).toString('utf8');
        let currentTaskFile: string | undefined;
        try {
            const state = JSON.parse(stateText) as { currentTaskFile?: string };
            currentTaskFile = state.currentTaskFile;
        } catch {
            return 'No activit task found';
        }

        if (!currentTaskFile || typeof currentTaskFile !== 'string') {
            return 'No activit task found';
        }

        const normalized = currentTaskFile.replace(/^[.][\\/]/, '');
        const taskUri = currentTaskFile.startsWith('.')
            ? vscode.Uri.joinPath(ws.uri, normalized)
            : vscode.Uri.file(currentTaskFile);

        if (!(await uriExists(taskUri))) {
            return 'No activit task found';
        }

        const xmlBytes = await vscode.workspace.fs.readFile(taskUri);
        const xml = Buffer.from(xmlBytes).toString('utf8');
        return xml || 'No activit task found';
    } catch {
        return 'No activit task found';
    }
}

export default getActiveTask;
