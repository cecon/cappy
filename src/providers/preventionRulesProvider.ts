import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PreventionRule, PreventionRuleCategory } from '../models/preventionRule';
import { FileManager } from '../utils/fileManager';

type PreventionRuleItemChangeEvent = PreventionRuleItem | undefined | null | void;

export class ForgePreventionRulesProvider implements vscode.TreeDataProvider<PreventionRuleItem> {
    private readonly _onDidChangeTreeData: vscode.EventEmitter<PreventionRuleItemChangeEvent> = new vscode.EventEmitter<PreventionRuleItemChangeEvent>();
    readonly onDidChangeTreeData: vscode.Event<PreventionRuleItemChangeEvent> = this._onDidChangeTreeData.event;

    private readonly fileManager: FileManager;
    private preventionRules: PreventionRule[] = [];

    constructor() {
        this.fileManager = new FileManager();
        this.loadPreventionRules();
    }

    refresh(): void {
        this.loadPreventionRules();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PreventionRuleItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: PreventionRuleItem): Promise<PreventionRuleItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        if (element) {
            // Return rules for specific category
            if (element.contextValue === 'category') {
                const categoryRules = this.preventionRules.filter(rule => rule.category === element.category);
                return categoryRules.map(rule => new PreventionRuleItem(
                    `${rule.problem} → ${rule.solution}`,
                    'rule',
                    rule,
                    vscode.TreeItemCollapsibleState.None
                ));
            }
            return [];
        } else {
            // Return categories
            return this.getCategories();
        }
    }

    private getCategories(): PreventionRuleItem[] {
        const categories = new Map<PreventionRuleCategory, number>();
        
        // Count rules by category
        this.preventionRules.forEach(rule => {
            const count = categories.get(rule.category) || 0;
            categories.set(rule.category, count + 1);
        });

        // Create category items
        const categoryItems: PreventionRuleItem[] = [];
        categories.forEach((count, category) => {
            const categoryName = category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ');
            const item = new PreventionRuleItem(
                `${categoryName} (${count})`,
                'category',
                undefined,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            item.category = category;
            item.iconPath = this.getCategoryIcon(category);
            item.tooltip = `${count} prevention rules in ${categoryName} category`;
            categoryItems.push(item);
        });

        return categoryItems.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
    }

    private async loadPreventionRules(): Promise<void> {
        this.preventionRules = [];
        
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
            const tasksPath = path.join(workspaceRoot, 'tasks');

            if (!fs.existsSync(tasksPath)) {
                return;
            }

            const taskFolders = fs.readdirSync(tasksPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const taskFolder of taskFolders) {
                const taskPath = path.join(tasksPath, taskFolder);
                const difficultiesPath = path.join(taskPath, 'difficulties.md');

                if (fs.existsSync(difficultiesPath)) {
                    const rules = await this.extractPreventionRules(difficultiesPath, taskFolder);
                    this.preventionRules.push(...rules);
                }
            }

            // Load manually added prevention rules
            const rulesPath = path.join(workspaceRoot, '.forge', 'prevention-rules.json');
            if (fs.existsSync(rulesPath)) {
                try {
                    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
                    const manualRules: PreventionRule[] = JSON.parse(rulesContent);
                    this.preventionRules.push(...manualRules);
                } catch (error) {
                    console.error('Error loading prevention rules:', error);
                }
            }
        } catch (error) {
            console.error('Error loading prevention rules:', error);
        }
    }

    private async extractPreventionRules(difficultiesPath: string, taskId: string): Promise<PreventionRule[]> {
        const rules: PreventionRule[] = [];
        
        try {
            const content = fs.readFileSync(difficultiesPath, 'utf8');
            const lines = content.split('\n');

            let currentRule: Partial<PreventionRule> | null = null;
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Look for DON'T patterns
                const dontMatch = trimmedLine.match(/^❌\s*DON'T\s+(.*?)\s*→\s*(.*)/i);
                if (dontMatch) {
                    if (currentRule) {
                        // Save previous rule
                        rules.push(this.completeRule(currentRule, taskId));
                    }
                    
                    currentRule = {
                        problem: dontMatch[1].trim(),
                        solution: dontMatch[2].trim(),
                        sourceTask: taskId
                    };
                } else if (currentRule && trimmedLine.startsWith('Source:')) {
                    // Extract additional context
                    const sourceMatch = trimmedLine.match(/Source:\s*(.*)/);
                    if (sourceMatch) {
                        currentRule.sourceTask = sourceMatch[1].trim();
                    }
                } else if (currentRule && trimmedLine.length > 0 && !trimmedLine.startsWith('#')) {
                    // Additional description
                    if (!currentRule.solution) {
                        currentRule.solution = trimmedLine;
                    }
                }
            }
            
            // Save last rule
            if (currentRule) {
                rules.push(this.completeRule(currentRule, taskId));
            }
        } catch (error) {
            console.error(`Error extracting prevention rules from ${difficultiesPath}:`, error);
        }

        return rules;
    }

    private completeRule(partialRule: Partial<PreventionRule>, taskId: string): PreventionRule {
        return {
            id: `${taskId}_${Date.now()}`,
            problem: partialRule.problem || 'Unknown problem',
            solution: partialRule.solution || 'No solution provided',
            category: this.categorizeRule(partialRule.problem || ''),
            timeSaved: 1, // Default estimate
            confidence: 3, // Medium confidence
            sourceTask: partialRule.sourceTask || taskId,
            createdAt: new Date(),
            appliedCount: 0,
            effectiveness: 0.8,
            tags: this.extractTags(partialRule.problem || '', partialRule.solution || '')
        };
    }

    private categorizeRule(problem: string): PreventionRuleCategory {
        const problemLower = problem.toLowerCase();
        
        if (problemLower.includes('database') || problemLower.includes('sql') || problemLower.includes('migration')) {
            return PreventionRuleCategory.database;
        }
        if (problemLower.includes('security') || problemLower.includes('password') || problemLower.includes('auth')) {
            return PreventionRuleCategory.security;
        }
        if (problemLower.includes('performance') || problemLower.includes('slow') || problemLower.includes('memory')) {
            return PreventionRuleCategory.performance;
        }
        if (problemLower.includes('test') || problemLower.includes('spec')) {
            return PreventionRuleCategory.testing;
        }
        if (problemLower.includes('deploy') || problemLower.includes('build') || problemLower.includes('ci')) {
            return PreventionRuleCategory.deployment;
        }
        if (problemLower.includes('validation') || problemLower.includes('validate') || problemLower.includes('input')) {
            return PreventionRuleCategory.validation;
        }
        if (problemLower.includes('error') || problemLower.includes('exception') || problemLower.includes('catch')) {
            return PreventionRuleCategory.errorHandling;
        }
        if (problemLower.includes('config') || problemLower.includes('environment') || problemLower.includes('env')) {
            return PreventionRuleCategory.configuration;
        }
        if (problemLower.includes('architecture') || problemLower.includes('design') || problemLower.includes('pattern')) {
            return PreventionRuleCategory.architecture;
        }
        
        return PreventionRuleCategory.other;
    }

    private extractTags(problem: string, solution: string): string[] {
        const text = `${problem} ${solution}`.toLowerCase();
        const tags: string[] = [];
        
        // Extract common technical terms
        const techTerms = [
            'javascript', 'typescript', 'python', 'java', 'csharp', 'rust',
            'react', 'vue', 'angular', 'express', 'django', 'flask',
            'database', 'sql', 'nosql', 'redis', 'mongodb',
            'api', 'rest', 'graphql', 'websocket',
            'docker', 'kubernetes', 'aws', 'azure', 'gcp'
        ];
        
        techTerms.forEach(term => {
            if (text.includes(term)) {
                tags.push(term);
            }
        });
        
        return tags;
    }

    private getCategoryIcon(category: PreventionRuleCategory): vscode.ThemeIcon {
        switch (category) {
            case PreventionRuleCategory.database:
                return new vscode.ThemeIcon('database');
            case PreventionRuleCategory.security:
                return new vscode.ThemeIcon('shield');
            case PreventionRuleCategory.performance:
                return new vscode.ThemeIcon('dashboard');
            case PreventionRuleCategory.testing:
                return new vscode.ThemeIcon('beaker');
            case PreventionRuleCategory.deployment:
                return new vscode.ThemeIcon('rocket');
            case PreventionRuleCategory.validation:
                return new vscode.ThemeIcon('check');
            case PreventionRuleCategory.errorHandling:
                return new vscode.ThemeIcon('warning');
            case PreventionRuleCategory.configuration:
                return new vscode.ThemeIcon('settings-gear');
            case PreventionRuleCategory.architecture:
                return new vscode.ThemeIcon('symbol-structure');
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    public getPreventionRules(): PreventionRule[] {
        return this.preventionRules;
    }

    public async addPreventionRule(rule: PreventionRule): Promise<void> {
        this.preventionRules.push(rule);
        
        // Save to file
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
            const rulesPath = path.join(workspaceRoot, '.forge', 'prevention-rules.json');
            
            // Load existing manual rules
            let manualRules: PreventionRule[] = [];
            if (fs.existsSync(rulesPath)) {
                const content = fs.readFileSync(rulesPath, 'utf8');
                manualRules = JSON.parse(content);
            }
            
            manualRules.push(rule);
            fs.writeFileSync(rulesPath, JSON.stringify(manualRules, null, 2), 'utf8');
            
            this.refresh();
        } catch (error) {
            console.error('Error saving prevention rule:', error);
        }
    }
}

export class PreventionRuleItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly contextValue: string,
        public readonly rule?: PreventionRule,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState,
        public category?: PreventionRuleCategory
    ) {
        super(label, collapsibleState);
        
        if (rule) {
            this.tooltip = `${rule.problem}\n→ ${rule.solution}\n\nSource: ${rule.sourceTask}\nConfidence: ${rule.confidence}/5\nTime Saved: ${rule.timeSaved}h`;
            this.description = `${rule.confidence}/5 confidence`;
        }
    }
}
