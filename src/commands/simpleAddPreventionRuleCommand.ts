import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);

export class SimpleAddPreventionRuleCommand {
    static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.commands.registerCommand('forge.addPreventionRule', async () => {
            try {
                const workspaceRoot = SimpleAddPreventionRuleCommand.getWorkspaceRoot();
                const forgeDir = path.join(workspaceRoot, '.forge');
                
                // Check if FORGE is initialized
                if (!await exists(forgeDir)) {
                    vscode.window.showErrorMessage('⚠️ FORGE not initialized. Run "FORGE: Initialize" first.');
                    return;
                }
                
                // Get rule details from user
                const ruleTitle = await vscode.window.showInputBox({
                    prompt: 'Enter prevention rule title',
                    placeHolder: 'e.g., Always validate workspace before file operations'
                });
                
                if (!ruleTitle) {
                    return;
                }
                
                const ruleCategory = await vscode.window.showQuickPick([
                    'TypeScript',
                    'VS Code Extension',
                    'File Operations',
                    'Error Handling',
                    'Testing',
                    'Performance',
                    'Security',
                    'General'
                ], {
                    placeHolder: 'Select rule category'
                });
                
                if (!ruleCategory) {
                    return;
                }
                
                const ruleContext = await vscode.window.showInputBox({
                    prompt: 'When does this problem occur? (Context)',
                    placeHolder: 'e.g., When creating files without checking if workspace exists'
                });
                
                if (!ruleContext) {
                    return;
                }
                
                const ruleProblem = await vscode.window.showInputBox({
                    prompt: 'What is the problem/error?',
                    placeHolder: 'e.g., Extension crashes with "Cannot read property of undefined"'
                });
                
                if (!ruleProblem) {
                    return;
                }
                
                const ruleSolution = await vscode.window.showInputBox({
                    prompt: 'How to solve/prevent this?',
                    placeHolder: 'e.g., Always check if workspace exists before operations'
                });
                
                if (!ruleSolution) {
                    return;
                }
                
                // Add rule to prevention-rules.md
                await SimpleAddPreventionRuleCommand.addRuleToFile(forgeDir, {
                    category: ruleCategory,
                    title: ruleTitle,
                    context: ruleContext,
                    problem: ruleProblem,
                    solution: ruleSolution
                });
                
                vscode.window.showInformationMessage(`🛡️ Prevention rule "${ruleTitle}" added successfully!`);
                
                // Open prevention rules file
                const rulesFile = path.join(forgeDir, 'prevention-rules.md');
                const doc = await vscode.workspace.openTextDocument(rulesFile);
                await vscode.window.showTextDocument(doc);
                
            } catch (error) {
                vscode.window.showErrorMessage(`🔨 Add Prevention Rule Error: ${error}`);
                console.error('FORGE Add Prevention Rule Error:', error);
            }
        });
    }
    
    private static async addRuleToFile(forgeDir: string, rule: any): Promise<void> {
        const rulesFile = path.join(forgeDir, 'prevention-rules.md');
        let content = '';
        
        // Read existing content
        if (await exists(rulesFile)) {
            content = await readFile(rulesFile, 'utf8');
        }
        
        // Create new rule entry
        const newRule = `

## [${rule.category}] ${rule.title}

**Context:** ${rule.context}  
**Problem:** ${rule.problem}  
**Solution:** ${rule.solution}  
**Added:** ${new Date().toLocaleDateString()}  

---`;
        
        // Update statistics in header
        const ruleCount = (content.match(/## \[.*?\]/g) || []).length + 1;
        
        if (content.includes('- **Total Active Rules:**')) {
            content = content.replace(
                /- \*\*Total Active Rules:\*\* \d+/,
                `- **Total Active Rules:** ${ruleCount}`
            );
            content = content.replace(
                /- \*\*Last Updated:\*\* .*/,
                `- **Last Updated:** ${new Date().toLocaleDateString()}`
            );
        }
        
        // Add new rule at the end
        content += newRule;
        
        await writeFile(rulesFile, content);
    }
    
    private static getWorkspaceRoot(): string {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error("No workspace root found. Please open a folder first.");
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
}
