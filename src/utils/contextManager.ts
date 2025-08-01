import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from './fileManager';
import { PreventionRule } from '../models/preventionRule';
import { CapybaraConfig } from '../models/capybaraConfig';

export class CopilotContextManager implements vscode.Disposable {
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];
    private fileManager: FileManager;
    private isWatching = false;

    constructor() {
        this.fileManager = new FileManager();
    }

    public async startWatching(): Promise<void> {
        if (this.isWatching) {
            return;
        }

        this.isWatching = true;

        // Watch for changes in difficulties.md files
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/tasks/**/difficulties.md');
        
        this.fileWatcher.onDidChange(this.onFileChanged, this, this.disposables);
        this.fileWatcher.onDidCreate(this.onFileChanged, this, this.disposables);
        this.fileWatcher.onDidDelete(this.onFileChanged, this, this.disposables);

        // Watch for prevention rules changes
        const preventionRulesWatcher = vscode.workspace.createFileSystemWatcher('**/.forge/prevention-rules.json');
        preventionRulesWatcher.onDidChange(this.onFileChanged, this, this.disposables);
        preventionRulesWatcher.onDidCreate(this.onFileChanged, this, this.disposables);

        this.disposables.push(this.fileWatcher, preventionRulesWatcher);

        // Initial context update
        await this.updateContext();
    }

    public stopWatching(): void {
        if (!this.isWatching) {
            return;
        }

        this.isWatching = false;
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.fileWatcher = undefined;
    }

    private async onFileChanged(uri: vscode.Uri): Promise<void> {
        // Debounce updates
        setTimeout(async () => {
            await this.updateContext();
        }, 1000);
    }

    public async updateContext(): Promise<void> {
        try {
            const preventionRules = await this.extractAllPreventionRules();
            const projectContext = await this.getProjectContext();
            const copilotInstructions = this.generateCopilotInstructions(preventionRules, projectContext);

            await this.fileManager.writeCopilotInstructions(copilotInstructions);
            
            console.log(`Updated Copilot context with ${preventionRules.length} prevention rules`);
        } catch (error) {
            console.error('Error updating Copilot context:', error);
            vscode.window.showErrorMessage('Failed to update Copilot context: ' + error);
        }
    }

    private async extractAllPreventionRules(): Promise<PreventionRule[]> {
        const rules: PreventionRule[] = [];
        
        if (!vscode.workspace.workspaceFolders) {
            return rules;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const tasksPath = path.join(workspaceRoot, 'tasks');

        // Extract rules from task difficulties
        if (fs.existsSync(tasksPath)) {
            const taskFolders = fs.readdirSync(tasksPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const taskFolder of taskFolders) {
                const taskPath = path.join(tasksPath, taskFolder);
                const difficultiesPath = path.join(taskPath, 'difficulties.md');

                if (fs.existsSync(difficultiesPath)) {
                    const taskRules = await this.extractRulesFromDifficulties(difficultiesPath, taskFolder);
                    rules.push(...taskRules);
                }
            }
        }

        // Load manually added prevention rules
        const rulesPath = path.join(workspaceRoot, '.forge', 'prevention-rules.json');
        if (fs.existsSync(rulesPath)) {
            try {
                const rulesContent = fs.readFileSync(rulesPath, 'utf8');
                const manualRules: PreventionRule[] = JSON.parse(rulesContent);
                rules.push(...manualRules);
            } catch (error) {
                console.error('Error loading manual prevention rules:', error);
            }
        }

        return this.prioritizeRules(rules);
    }

    private async extractRulesFromDifficulties(difficultiesPath: string, taskId: string): Promise<PreventionRule[]> {
        const rules: PreventionRule[] = [];
        
        try {
            const content = fs.readFileSync(difficultiesPath, 'utf8');
            const lines = content.split('\n');

            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Look for DON'T patterns
                const dontMatch = trimmedLine.match(/^❌\s*DON'T\s+(.*?)\s*→\s*(.*)/i);
                if (dontMatch) {
                    const rule: PreventionRule = {
                        id: `${taskId}_${Date.now()}_${Math.random()}`,
                        problem: dontMatch[1].trim(),
                        solution: dontMatch[2].trim(),
                        category: this.categorizeRule(dontMatch[1].trim()),
                        timeSaved: 1,
                        confidence: 4,
                        sourceTask: taskId,
                        createdAt: new Date(),
                        appliedCount: 0,
                        effectiveness: 0.8,
                        tags: []
                    };
                    rules.push(rule);
                }
            }
        } catch (error) {
            console.error(`Error extracting rules from ${difficultiesPath}:`, error);
        }

        return rules;
    }

    private categorizeRule(problem: string): any {
        const problemLower = problem.toLowerCase();
        
        if (problemLower.includes('database') || problemLower.includes('sql')) {
            return 'database';
        }
        if (problemLower.includes('security') || problemLower.includes('auth')) {
            return 'security';
        }
        if (problemLower.includes('performance') || problemLower.includes('slow')) {
            return 'performance';
        }
        if (problemLower.includes('test')) {
            return 'testing';
        }
        if (problemLower.includes('deploy')) {
            return 'deployment';
        }
        if (problemLower.includes('validation') || problemLower.includes('input')) {
            return 'validation';
        }
        if (problemLower.includes('error') || problemLower.includes('exception')) {
            return 'error-handling';
        }
        if (problemLower.includes('config') || problemLower.includes('env')) {
            return 'configuration';
        }
        
        return 'other';
    }

    private prioritizeRules(rules: PreventionRule[]): PreventionRule[] {
        // Sort by effectiveness and confidence
        return rules.sort((a, b) => {
            const scoreA = a.effectiveness * a.confidence;
            const scoreB = b.effectiveness * b.confidence;
            return scoreB - scoreA;
        });
    }

    private async getProjectContext(): Promise<ProjectContext> {
        const config = await this.fileManager.readCapybaraConfig();
        const languages = await this.fileManager.getProjectLanguages();
        const frameworks = await this.fileManager.getProjectFrameworks();
        
        const context: ProjectContext = {
            projectName: config?.project.name || 'Unknown Project',
            languages,
            frameworks,
            currentTask: await this.getCurrentTask(),
            architecture: config?.project.description || ''
        };

        return context;
    }

    private async getCurrentTask(): Promise<string> {
        // Find the most recently modified active task
        if (!vscode.workspace.workspaceFolders) {
            return 'No active task';
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const tasksPath = path.join(workspaceRoot, 'tasks');

        if (!fs.existsSync(tasksPath)) {
            return 'No tasks found';
        }

        try {
            const taskFolders = fs.readdirSync(tasksPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter(name => {
                    // Check if task is active (no completion.md or empty completion.md)
                    const completionPath = path.join(tasksPath, name, 'completion.md');
                    if (!fs.existsSync(completionPath)) {
                        return true;
                    }
                    const content = fs.readFileSync(completionPath, 'utf8');
                    return content.trim().length === 0;
                });

            if (taskFolders.length === 0) {
                return 'No active tasks';
            }

            // Return the most recent active task
            const recentTask = taskFolders.sort().pop();
            return recentTask?.replace(/^TASK_\d+_/, '').replace(/_/g, ' ') || 'Unknown task';
        } catch (error) {
            return 'Error reading tasks';
        }
    }

    private generateCopilotInstructions(rules: PreventionRule[], context: ProjectContext): string {
        const config = vscode.workspace.getConfiguration('forge');
        const maxRules = config.get('maxPreventionRules', 50);
        const limitedRules = rules.slice(0, maxRules);

        const languageList = context.languages.join(', ');
        const frameworkList = context.frameworks.join(', ');

        let instructions = `# Capybara Instructions for GitHub Copilot

You are working with Capybara. Apply these accumulated learnings when generating code.

## Project Context
- **Project**: ${context.projectName}
- **Languages**: ${languageList || 'Not detected'}
- **Frameworks**: ${frameworkList || 'Not detected'}
- **Current Task**: ${context.currentTask}
- **Architecture**: ${context.architecture || 'Standard architecture'}

## Prevention Rules (Auto-Generated from FORGE Tasks)

The following rules were learned from previous mistakes and difficulties. Apply them when generating code:

`;

        // Group rules by category
        const rulesByCategory = this.groupRulesByCategory(limitedRules);

        for (const [category, categoryRules] of rulesByCategory.entries()) {
            if (categoryRules.length === 0) {
                continue;
            }

            const categoryName = category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ');
            instructions += `### ${categoryName} Rules\n\n`;

            for (const rule of categoryRules) {
                instructions += `❌ **DON'T** ${rule.problem} → ${rule.solution}\n`;
                instructions += `   *Source: ${rule.sourceTask}, Confidence: ${rule.confidence}/5, Time Saved: ${rule.timeSaved}h*\n\n`;
            }
        }

        instructions += `## When user says "Create FORGE task [NAME]":

1. **Analyze Atomicity**: Check if the task is atomic (≤3 hours estimated)
2. **Apply Prevention Rules**: Check all relevant rules from above categories
3. **Create Structure**: Generate task folder with templates
4. **Include Context**: Apply project-specific patterns and conventions
5. **Generate Code**: Follow prevention rules and best practices

## Code Generation Guidelines:

- Always validate user inputs (Prevention Rule priority)
- Include proper error handling
- Use environment variables for configuration
- Follow project's naming conventions
- Include type hints/annotations where applicable
- Add appropriate logging and monitoring
- Consider performance implications
- Ensure security best practices

## Task Structure:
When creating FORGE tasks, use this structure:
\`\`\`
tasks/
├── TASK_XX_TASK_NAME/
│   ├── description.md    # What to build
│   ├── completion.md     # What was built
│   ├── difficulties.md  # Problems encountered
│   └── artifacts/        # Generated code/files
\`\`\`

---
*This context is automatically updated by Capybara. Last updated: ${new Date().toISOString()}*
*Total Prevention Rules: ${rules.length} | Rules in Context: ${limitedRules.length}*
`;

        return instructions;
    }

    private groupRulesByCategory(rules: PreventionRule[]): Map<string, PreventionRule[]> {
        const grouped = new Map<string, PreventionRule[]>();

        for (const rule of rules) {
            const category = rule.category.toString();
            if (!grouped.has(category)) {
                grouped.set(category, []);
            }
            grouped.get(category)!.push(rule);
        }

        return grouped;
    }

    public dispose(): void {
        this.stopWatching();
    }
}

interface ProjectContext {
    projectName: string;
    languages: string[];
    frameworks: string[];
    currentTask: string;
    architecture: string;
}
