import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

export class SimpleInitCommand {
    static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.commands.registerCommand('forge.init', async () => {
            try {
                // Check if workspace exists
                const workspaceRoot = SimpleInitCommand.getWorkspaceRoot();
                vscode.window.showInformationMessage('🔨 FORGE: Initializing framework...');
                
                // Create .forge directory
                const forgeDir = path.join(workspaceRoot, '.forge');
                
                // Check if already exists
                if (await exists(forgeDir)) {
                    const overwrite = await vscode.window.showWarningMessage(
                        '⚠️ FORGE already initialized. Overwrite?',
                        'Yes', 'No'
                    );
                    if (overwrite !== 'Yes') {
                        return;
                    }
                }
                
                await mkdir(forgeDir, { recursive: true });
                
                // Create basic config.json
                const configContent = JSON.stringify({
                    project: {
                        name: path.basename(workspaceRoot),
                        description: "FORGE-enabled project",
                        type: "general"
                    },
                    settings: {
                        maxPreventionRules: 15,
                        autoUpdateCopilotContext: true
                    },
                    context: {
                        lastUpdated: new Date().toISOString(),
                        rulesCount: 0,
                        version: "1.0.26"
                    }
                }, null, 2);
                
                await writeFile(path.join(forgeDir, 'config.json'), configContent);
                
                // Create basic prevention-rules.md
                const rulesContent = `# 🛡️ Prevention Rules

> These rules are automatically integrated into your AI assistant context.

## 📊 Statistics
- **Total Active Rules:** 0
- **Last Updated:** ${new Date().toLocaleDateString()}

---

*No rules defined yet. Add your first prevention rule when you encounter an issue.*`;
                
                await writeFile(path.join(forgeDir, 'prevention-rules.md'), rulesContent);
                
                // Create tasks directory
                const tasksDir = path.join(workspaceRoot, 'tasks');
                await mkdir(tasksDir, { recursive: true });
                
                // Create .gitignore entry for copilot-instructions.md
                const gitignorePath = path.join(workspaceRoot, '.gitignore');
                let gitignoreContent = '';
                
                if (await exists(gitignorePath)) {
                    gitignoreContent = await promisify(fs.readFile)(gitignorePath, 'utf8');
                }
                
                if (!gitignoreContent.includes('.github/copilot-instructions.md')) {
                    gitignoreContent += '\n# FORGE Framework - Private instructions\n.github/copilot-instructions.md\n';
                    await writeFile(gitignorePath, gitignoreContent);
                }
                
                vscode.window.showInformationMessage('🎉 FORGE Framework initialized successfully!');
                
            } catch (error) {
                vscode.window.showErrorMessage(`🔨 FORGE Init Error: ${error}`);
                console.error('FORGE Init Command Error:', error);
            }
        });
    }
    
    private static getWorkspaceRoot(): string {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error("No workspace root found. Please open a folder first.");
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
}
