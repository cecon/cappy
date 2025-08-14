import * as vscode from 'vscode';
import { writeOutput } from '../utils/outputWriter';

/**
 * Returns the raw XML string of the active task file, if it exists.
 * Falls back to the exact string "No activit task found" when not available.
 */
export async function getActiveTask(): Promise<string> {
    try {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            const result = 'No activit task found';
            writeOutput(result);
            return result;
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
            const result = 'No activit task found';
            writeOutput(result);
            return result;
        }

        const stateBytes = await vscode.workspace.fs.readFile(stateUri);
        const stateText = Buffer.from(stateBytes).toString('utf8');
        let currentTaskFile: string | undefined;
        try {
            const state = JSON.parse(stateText) as { currentTaskFile?: string };
            currentTaskFile = state.currentTaskFile;
        } catch {
            const result = 'No activit task found';
            writeOutput(result);
            return result;
        }

        if (!currentTaskFile || typeof currentTaskFile !== 'string') {
            const result = 'No activit task found';
            writeOutput(result);
            return result;
        }

        const normalized = currentTaskFile.replace(/^[.][\\/]/, '');
        const taskUri = currentTaskFile.startsWith('.')
            ? vscode.Uri.joinPath(ws.uri, normalized)
            : vscode.Uri.file(currentTaskFile);

        if (!(await uriExists(taskUri))) {
            const result = 'No activit task found';
            writeOutput(result);
            return result;
        }

        const xmlBytes = await vscode.workspace.fs.readFile(taskUri);
        const xml = Buffer.from(xmlBytes).toString('utf8');
        const result = xml || 'No activit task found';
        
        // Write result to .cappy/output.txt
        writeOutput(result);
        
        return result;
    } catch {
        const result = 'No activit task found';
        writeOutput(result);
        return result;
    }
}

export default getActiveTask;
