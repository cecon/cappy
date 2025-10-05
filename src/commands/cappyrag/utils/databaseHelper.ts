import * as vscode from 'vscode';
import { getCappyRAGLanceDatabase, CappyRAGLanceDatabase } from '../../../store/cappyragLanceDb';

/**
 * Helper to get database instance with workspace path
 */
export function getDatabase(): CappyRAGLanceDatabase {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder open');
    }
    return getCappyRAGLanceDatabase(workspaceFolders[0].uri.fsPath);
}
