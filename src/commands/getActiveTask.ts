import * as vscode from 'vscode';
import * as path from 'path';
import { writeOutput } from '../utils/outputWriter';

/**
 * Returns a standardized XML with task status information.
 * Searches for .active.xml files in .cappy/tasks/ directory.
 */
export async function getActiveTask(): Promise<string> {
    try {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            const result = await generateTaskStatusXml(false, null, null, 0);
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

        const tasksUri = vscode.Uri.joinPath(ws.uri, '.cappy', 'tasks');
        
        if (!(await uriExists(tasksUri))) {
            const result = await generateTaskStatusXml(false, null, null, 0);
            writeOutput(result);
            return result;
        }

        // Read directory contents
        const entries = await vscode.workspace.fs.readDirectory(tasksUri);
        
        // Find .active.xml files
        const activeFiles = entries
            .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.active.xml'))
            .map(([name]) => name);

        if (activeFiles.length === 0) {
            const result = await generateTaskStatusXml(false, null, null, 0);
            writeOutput(result);
            return result;
        }

        // Get the first active file (or implement logic to choose the most recent)
        const activeFileName = activeFiles[0];
        const activeFileUri = vscode.Uri.joinPath(tasksUri, activeFileName);
        
        // Get file stats for last modified date
        const stats = await vscode.workspace.fs.stat(activeFileUri);
        const lastModified = new Date(stats.mtime).toISOString();
        
        // Get line count
        const fileBytes = await vscode.workspace.fs.readFile(activeFileUri);
        const fileContent = Buffer.from(fileBytes).toString('utf8');
        const lineCount = fileContent.split('\n').length;
        
        const filePath = path.join('.cappy', 'tasks', activeFileName);
        const result = await generateTaskStatusXml(true, filePath, lastModified, lineCount);
        
        writeOutput(result);
        return result;
        
    } catch (error) {
        const result = await generateTaskStatusXml(false, null, null, 0);
        writeOutput(result);
        return result;
    }
}

/**
 * Generates the standardized task status XML using the template
 */
async function generateTaskStatusXml(
    active: boolean, 
    filePath: string | null, 
    lastModified: string | null, 
    lineCount: number
): Promise<string> {
    try {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            return createFallbackXml(active, filePath, lastModified, lineCount);
        }

        const templateUri = vscode.Uri.joinPath(ws.uri, 'resources', 'templates', 'task-status.xml');
        
        try {
            const templateBytes = await vscode.workspace.fs.readFile(templateUri);
            const template = Buffer.from(templateBytes).toString('utf8');
            
            return template
                .replace('{{ACTIVE}}', active.toString())
                .replace('{{FILE_PATH}}', filePath || 'null')
                .replace('{{LAST_MODIFIED}}', lastModified || 'null')
                .replace('{{LINE_COUNT}}', lineCount.toString());
        } catch {
            return createFallbackXml(active, filePath, lastModified, lineCount);
        }
    } catch {
        return createFallbackXml(active, filePath, lastModified, lineCount);
    }
}

/**
 * Creates a fallback XML structure when template is not available
 */
function createFallbackXml(
    active: boolean, 
    filePath: string | null, 
    lastModified: string | null, 
    lineCount: number
): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<task-status>
    <active>${active}</active>
    <file-path>${filePath || 'null'}</file-path>
    <last-modified>${lastModified || 'null'}</last-modified>
    <line-count>${lineCount}</line-count>
</task-status>`;
}

export default getActiveTask;
