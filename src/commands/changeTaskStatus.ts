import * as vscode from 'vscode';
import * as path from 'path';
import { writeOutput } from '../utils/outputWriter';

/**
 * Changes the status of a task file between active and paused.
 * Renames the file and updates internal status and ID.
 * 
 * @param fileName - Name of the file to change status
 * @param newStatus - New status: 'active' or 'paused'
 */
export async function changeTaskStatus(fileName: string, newStatus: 'active' | 'paused'): Promise<string> {
    try {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            const errorMsg = "❌ Nenhum workspace aberto";
            writeOutput(errorMsg);
            return errorMsg;
        }

        // Validate status
        if (newStatus !== 'active' && newStatus !== 'paused') {
            const errorMsg = "❌ Status deve ser 'active' ou 'paused'";
            writeOutput(errorMsg);
            return errorMsg;
        }

        const tasksDir = vscode.Uri.joinPath(ws.uri, '.cappy', 'tasks');
        
        // Check if tasks directory exists
        try {
            await vscode.workspace.fs.stat(tasksDir);
        } catch {
            const errorMsg = "❌ Diretório .cappy/tasks não encontrado";
            writeOutput(errorMsg);
            return errorMsg;
        }

        // Find the current file (could be .ACTIVE.xml or .paused.xml)
        const entries = await vscode.workspace.fs.readDirectory(tasksDir);
        const taskFiles = entries.filter(([name, type]) => 
            type === vscode.FileType.File && 
            (name === fileName || name === fileName.replace(/\.(active|paused)\.xml$/, '.ACTIVE.xml') || name === fileName.replace(/\.(active|paused)\.xml$/, '.paused.xml'))
        );

        let currentFile: string | null = null;
        
        // Try to find the exact file first
        if (taskFiles.find(([name]) => name === fileName)) {
            currentFile = fileName;
        } else {
            // Try to find file with different status extension
            const baseFileName = fileName.replace(/\.(active|paused)\.xml$/, '');
            const foundFile = taskFiles.find(([name]) => 
                name.startsWith(baseFileName) && (name.endsWith('.ACTIVE.xml') || name.endsWith('.paused.xml'))
            );
            if (foundFile) {
                currentFile = foundFile[0];
            }
        }

        if (!currentFile) {
            const errorMsg = `❌ Arquivo de tarefa não encontrado: ${fileName}`;
            writeOutput(errorMsg);
            return errorMsg;
        }

        const currentFilePath = vscode.Uri.joinPath(tasksDir, currentFile);
        
        // Read current file content
        const fileContent = await vscode.workspace.fs.readFile(currentFilePath);
        let xmlContent = Buffer.from(fileContent).toString('utf8');

        // Generate new filename
        const baseFileName = currentFile.replace(/\.(active|paused)\.xml$/, '');
        const newExtension = newStatus === 'active' ? '.ACTIVE.xml' : '.PAUSED.xml';
        const newFileName = baseFileName + newExtension;
        const newFilePath = vscode.Uri.joinPath(tasksDir, newFileName);

        // Update XML content - change status attribute
        xmlContent = xmlContent.replace(
            /(<task[^>]+status=")[^"]*(")/,
            `$1${newStatus === 'active' ? 'em-andamento' : 'pausada'}$2`
        );

        // Update XML content - change ID to match new filename
        const newTaskId = newFileName.replace('.xml', '');
        xmlContent = xmlContent.replace(
            /(<task[^>]+id=")[^"]*(")/,
            `$1${newTaskId}$2`
        );

        // Update timestamp
        const timestamp = new Date().toISOString();
        xmlContent = xmlContent.replace(
            /(<updated>)[^<]*(<\/updated>)/,
            `$1${timestamp}$2`
        );

        // Write new file
        await vscode.workspace.fs.writeFile(newFilePath, Buffer.from(xmlContent, 'utf8'));

        // Delete old file if name changed
        if (currentFile !== newFileName) {
            await vscode.workspace.fs.delete(currentFilePath);
        }

        const successMsg = path.join(tasksDir.fsPath, newFileName);
        writeOutput(successMsg);
        return successMsg;

    } catch (error) {
        const errorMsg = `❌ Erro ao alterar status da tarefa: ${error}`;
        writeOutput(errorMsg);
        return errorMsg;
    }
}

/**
 * VS Code command wrapper for changeTaskStatus
 */
export async function changeTaskStatusCommand(): Promise<void> {
    try {
        // Get filename from user input
        const fileName = await vscode.window.showInputBox({
            prompt: 'Nome do arquivo da tarefa (ex: TASK_20250814_exemplo.ACTIVE.xml)',
            placeHolder: 'TASK_YYYYMMDD_nome.ACTIVE.xml'
        });

        if (!fileName) {
            vscode.window.showWarningMessage('❌ Nome do arquivo é obrigatório');
            return;
        }

        // Get new status from user
        const newStatus = await vscode.window.showQuickPick(
            [
                { label: 'active', description: 'Tarefa ativa (em andamento)' },
                { label: 'paused', description: 'Tarefa pausada' }
            ],
            {
                placeHolder: 'Selecione o novo status da tarefa'
            }
        );

        if (!newStatus) {
            vscode.window.showWarningMessage('❌ Status é obrigatório');
            return;
        }

        const result = await changeTaskStatus(fileName, newStatus.label as 'active' | 'paused');
        
        if (result.startsWith('❌')) {
            vscode.window.showErrorMessage(result);
        } else {
            vscode.window.showInformationMessage(`✅ Status alterado. Novo arquivo: ${path.basename(result)}`);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`❌ Erro: ${error}`);
    }
}

export default changeTaskStatusCommand;
