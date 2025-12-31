import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

export interface TerminalCommandInput {
    /**
     * The command to execute in the terminal
     */
    command: string;
}

/**
 * Language Model Tool for executing terminal commands.
 * Allows the agent to run shell commands like 'find', 'grep', 'ls', etc.
 */
export class TerminalCommandTool implements vscode.LanguageModelTool<TerminalCommandInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<TerminalCommandInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { command } = options.input;
        
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;

            if (!cwd) {
                throw new Error('No workspace folder open');
            }

            // Execute the command
            const { stdout, stderr } = await exec(command, { 
                cwd,
                maxBuffer: 1024 * 1024 // 1MB buffer
            });

            let output = '';
            if (stdout) {
                output += `STDOUT:\n${stdout}\n`;
            }
            if (stderr) {
                output += `STDERR:\n${stderr}\n`;
            }

            if (!output) {
                output = '(No output)';
            }

            return {
                content: [new vscode.LanguageModelTextPart(output)]
            };
        } catch (error: any) {
            const errorMessage = error.message || String(error);
            const stderr = error.stderr ? `\nSTDERR:\n${error.stderr}` : '';
            
            return {
                content: [new vscode.LanguageModelTextPart(`Error executing command: ${errorMessage}${stderr}`)]
            };
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<TerminalCommandInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Executing terminal command: ${options.input.command}`
        };
    }
}
