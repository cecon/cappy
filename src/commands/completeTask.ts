import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Moves an active task to history by:
 * 1. Finding the active task file (.ACTIVE.xml)
 * 2. Renaming it to .done.xml
 * 3. Moving it to .cappy/history/ directory
 * 4. Updating internal file references within the XML
 * 5. Returning the new file path
 */
export async function completeTask(): Promise<string> {
    try {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            const message = "❌ Nenhum workspace aberto";
            return message;
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
        const historyUri = vscode.Uri.joinPath(ws.uri, '.cappy', 'history');

        // Ensure directories exist
        if (!(await uriExists(tasksUri))) {
            const message = "❌ Diretório .cappy/tasks não encontrado";
            return message;
        }

        // Create history directory if it doesn't exist
        if (!(await uriExists(historyUri))) {
            await vscode.workspace.fs.createDirectory(historyUri);
        }

        // Find active task files
        const entries = await vscode.workspace.fs.readDirectory(tasksUri);
        const activeFiles = entries
            .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.ACTIVE.xml'))
            .map(([name]) => name);

        if (activeFiles.length === 0) {
            const message = "❌ Nenhuma tarefa ativa encontrada para completar";
            return message;
        }

        // Get the first active file (or implement logic to choose specific one)
        const activeFileName = activeFiles[0];
        const activeFileUri = vscode.Uri.joinPath(tasksUri, activeFileName);

        // Read the current file content
        const fileBytes = await vscode.workspace.fs.readFile(activeFileUri);
        let fileContent = Buffer.from(fileBytes).toString('utf8');

        // Generate new filename by replacing .ACTIVE with .DONE
        const newFileName = activeFileName.replace('.ACTIVE.xml', '.DONE.xml');
        const newFileUri = vscode.Uri.joinPath(historyUri, newFileName);

        // Update internal references in the XML content
        // Replace any occurrence of the old filename with the new one
        fileContent = fileContent.replace(
            new RegExp(activeFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            newFileName
        );

        // Update any file path references
        const oldPath = path.join('.cappy', 'tasks', activeFileName);
        const newPath = path.join('.cappy', 'history', newFileName);
        fileContent = fileContent.replace(
            new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            newPath
        );

        // Add completion timestamp to the XML if there's a metadata section
        const completionTimestamp = new Date().toISOString();
        if (fileContent.includes('<metadata>')) {
            // Add completion timestamp to metadata
            fileContent = fileContent.replace(
                '</metadata>',
                `    <completed-at>${completionTimestamp}</completed-at>\n</metadata>`
            );
        } else if (fileContent.includes('<task>')) {
            // Add metadata section with completion timestamp if it doesn't exist
            fileContent = fileContent.replace(
                '<task>',
                `<task>\n    <metadata>\n        <completed-at>${completionTimestamp}</completed-at>\n    </metadata>`
            );
        }

        // Change status to completed if there's a status field
        fileContent = fileContent.replace(
            /<status>.*?<\/status>/g,
            '<status>concluida</status>'
        );

        // Write the file to history directory
        await vscode.workspace.fs.writeFile(newFileUri, Buffer.from(fileContent, 'utf8'));

        // Delete the original file from tasks directory
        await vscode.workspace.fs.delete(activeFileUri);

        // Prepare success message with new file path
        const newFilePath = path.join('.cappy', 'history', newFileName);
        const message = `✅ Tarefa movida para histórico com sucesso:
📁 Arquivo: ${newFileName}
📍 Novo caminho: ${newFilePath}
⏰ Concluída em: ${completionTimestamp}`;

        return message;

    } catch (error) {
        const message = `❌ Erro ao mover tarefa para histórico: ${error}`;
        return message;
    }
}

export default completeTask;
