import * as vscode from 'vscode';
import { PreventionRule, PreventionRuleCategory } from '../models/preventionRule';
import * as fs from 'fs';
import * as path from 'path';

export class PreventionRuleAdder {
    public async show(): Promise<boolean> {
        try {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return false;
            }

            const problemDescription = await vscode.window.showInputBox({
                prompt: 'Describe the problem or mistake to prevent',
                placeHolder: 'e.g., XSS vulnerability due to unescaped output',
                validateInput: (value) => {
                    if (!value || value.trim().length < 5) {
                        return 'Problem description must be at least 5 characters long';
                    }
                    return null;
                }
            });

            if (!problemDescription) {
                return false;
            }

            const solution = await vscode.window.showInputBox({
                prompt: 'Describe the correct solution',
                placeHolder: 'e.g., Always use proper escaping/sanitization functions',
                validateInput: (value) => {
                    if (!value || value.trim().length < 5) {
                        return 'Solution must be at least 5 characters long';
                    }
                    return null;
                }
            });

            if (!solution) {
                return false;
            }

            const categoryOptions = Object.values(PreventionRuleCategory).map(cat => ({
                label: cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' '),
                value: cat
            }));

            const selectedCategory = await vscode.window.showQuickPick(
                categoryOptions.map(opt => opt.label),
                {
                    placeHolder: 'Select a category for this rule',
                    canPickMany: false
                }
            );

            if (!selectedCategory) {
                return false;
            }

            const category = categoryOptions.find(opt => opt.label === selectedCategory)?.value || PreventionRuleCategory.other;

            const rule: PreventionRule = {
                id: `rule-${Date.now()}`,
                problem: problemDescription.trim(),
                solution: solution.trim(),
                category,
                timeSaved: 0,
                confidence: 1.0,
                sourceTask: '',
                createdAt: new Date(),
                appliedCount: 0,
                effectiveness: 0,
                tags: []
            };

            const success = await this.addPreventionRule(rule);
            
            if (success) {
                vscode.window.showInformationMessage('Prevention rule added successfully!');
                return true;
            } else {
                vscode.window.showErrorMessage('Failed to add prevention rule.');
                return false;
            }

        } catch (error) {
            console.error('Error in PreventionRuleAdder:', error);
            vscode.window.showErrorMessage('An error occurred while adding the prevention rule.');
            return false;
        }
    }

    private async addPreventionRule(rule: PreventionRule): Promise<boolean> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
            const forgeDir = path.join(workspaceRoot, '.forge');
            const rulesPath = path.join(forgeDir, 'prevention-rules.md');

            // Ensure .forge directory exists
            try {
                await fs.promises.mkdir(forgeDir, { recursive: true });
            } catch (error: any) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }

            const ruleMarkdown = `
## Prevention Rule #${rule.id}

**Category:** ${rule.category.charAt(0).toUpperCase() + rule.category.slice(1).replace(/-/g, ' ')}  
**Problem:** ${rule.problem}  
**Solution:** ${rule.solution}  
**Created:** ${rule.createdAt.toLocaleDateString()}

---
`;

            // Check if file exists and append or create
            try {
                await fs.promises.access(rulesPath, fs.constants.F_OK);
                await fs.promises.appendFile(rulesPath, ruleMarkdown, 'utf8');
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    const header = `# Prevention Rules

This file contains prevention rules to help avoid common mistakes and improve code quality.

---
`;
                    await fs.promises.writeFile(rulesPath, header + ruleMarkdown, 'utf8');
                } else {
                    throw error;
                }
            }

            return true;
        } catch (error) {
            console.error('Error saving prevention rule:', error);
            return false;
        }
    }
}
