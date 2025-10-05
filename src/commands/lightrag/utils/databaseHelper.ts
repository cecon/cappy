import * as vscode from 'vscode';
import { getLightRAGLanceDatabase, LightRAGLanceDatabase } from '../../../store/lightragLanceDb';

/**
 * Helper to get database instance with workspace path
 */
export function getDatabase(): LightRAGLanceDatabase {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder open');
    }
    return getLightRAGLanceDatabase(workspaceFolders[0].uri.fsPath);
}
