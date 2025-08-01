import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class InitCommandWithoutFsExtra {
    static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.commands.registerCommand('forge.init', async () => {
            try {
                // Check if workspace exists
                const workspaceRoot = InitCommandWithoutFsExtra.getWorkspaceRoot();
                
                // Show progress
                return await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '🔨 Initializing FORGE Framework',
                    cancellable: false
                }, async (progress) => {
                    
                    progress.report({ increment: 0, message: 'Checking workspace...' });
                    
                    const forgeDir = path.join(workspaceRoot, '.forge');
                    const githubDir = path.join(workspaceRoot, '.github');
                    
                    // Check if already exists
                    if (await exists(forgeDir)) {
                        const overwrite = await vscode.window.showWarningMessage(
                            '⚠️ FORGE already initialized. Overwrite?',
                            'Yes', 'No'
                        );
                        if (overwrite !== 'Yes') {
                            return false;
                        }
                    }
                    
                    progress.report({ increment: 20, message: 'Creating directories...' });
                    
                    // Create directories
                    await mkdir(forgeDir, { recursive: true });
                    await mkdir(githubDir, { recursive: true });
                    await mkdir(path.join(forgeDir, 'history'), { recursive: true });
                    await mkdir(path.join(workspaceRoot, 'tasks'), { recursive: true });
                    
                    progress.report({ increment: 40, message: 'Detecting project info...' });
                    
                    // Detect project info
                    const projectInfo = await InitCommandWithoutFsExtra.detectProjectInfo(workspaceRoot);
                    
                    progress.report({ increment: 60, message: 'Creating configuration...' });
                    
                    // Create config.json
                    const config = {
                        version: "1.0.27",
                        project: {
                            name: projectInfo.name,
                            description: projectInfo.description,
                            language: projectInfo.languages,
                            framework: projectInfo.frameworks,
                            type: projectInfo.type
                        },
                        stack: {
                            environment: "windows-powershell",
                            editor: "vscode",
                            ai: "github-copilot"
                        },
                        settings: {
                            maxPreventionRules: 15,
                            autoUpdateCopilotContext: true,
                            taskTimeEstimation: true,
                            showNotifications: true
                        },
                        context: {
                            lastUpdated: new Date().toISOString(),
                            rulesCount: 0,
                            tasksCount: 0
                        },
                        tasks: {
                            currentStep: null,
                            autoNumbering: true,
                            maxStepHours: 3
                        },
                        ai: {
                            contextUpdateFrequency: "onTaskComplete",
                            maxContextLength: 4000
                        },
                        analytics: {
                            trackTaskCompletion: true,
                            trackErrorPatterns: true
                        },
                        createdAt: new Date().toISOString(),
                        lastUpdated: new Date().toISOString()
                    };
                    
                    await writeFile(
                        path.join(forgeDir, 'config.json'), 
                        JSON.stringify(config, null, 2)
                    );
                    
                    progress.report({ increment: 80, message: 'Creating files...' });
                    
                    // Create prevention-rules.md
                    const rulesContent = `# 🛡️ Prevention Rules

> These rules are automatically integrated into your AI assistant context.

## 📊 Statistics
- **Total Active Rules:** 0
- **Last Updated:** ${new Date().toLocaleDateString()}
- **Project:** ${projectInfo.name}
- **Languages:** ${projectInfo.languages.join(', ')}

---

## 🔧 Environment Rules

### Windows PowerShell
- Always use PowerShell-compatible commands
- Use semicolon for command chaining
- Prefer Get-ChildItem over ls

### VS Code Extensions
- Test commands immediately after implementation
- Use proper error handling with try/catch
- Always validate workspace before operations

---

*No custom rules defined yet. Add your first prevention rule when you encounter an issue.*`;
                    
                    await writeFile(path.join(forgeDir, 'prevention-rules.md'), rulesContent);
                    
                    // Create copilot instructions
                    await InitCommandWithoutFsExtra.createCopilotInstructions(githubDir, projectInfo);
                    
                    // Update .gitignore
                    await InitCommandWithoutFsExtra.updateGitignore(workspaceRoot);
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                    
                    vscode.window.showInformationMessage(
                        '🎉 FORGE Framework initialized successfully! Use "FORGE: Create Task" to start.'
                    );
                    
                    return true;
                });
                
            } catch (error) {
                vscode.window.showErrorMessage(`🔨 FORGE Init Error: ${error}`);
                console.error('FORGE Init Command Error:', error);
                return false;
            }
        });
    }
    
    private static async detectProjectInfo(workspacePath: string): Promise<any> {
        const projectName = path.basename(workspacePath);
        const languages: string[] = [];
        const frameworks: string[] = [];
        
        try {
            // Check for package.json (JavaScript/TypeScript)
            if (await exists(path.join(workspacePath, 'package.json'))) {
                languages.push('javascript');
                
                const packageContent = await readFile(path.join(workspacePath, 'package.json'), 'utf8');
                const pkg = JSON.parse(packageContent);
                
                // Check dependencies for frameworks
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                if (deps['@types/vscode']) frameworks.push('vscode-extension');
                if (deps['react']) frameworks.push('react');
                if (deps['next']) frameworks.push('nextjs');
                if (deps['vue']) frameworks.push('vue');
                if (deps['express']) frameworks.push('express');
            }
            
            // Check for TypeScript
            if (await exists(path.join(workspacePath, 'tsconfig.json'))) {
                if (!languages.includes('javascript')) languages.push('javascript');
                languages.push('typescript');
            }
            
            // Check for Python
            const files = await readdir(workspacePath);
            if (files.some(f => f.endsWith('.py'))) {
                languages.push('python');
            }
            
            // Check for C#
            if (files.some(f => f.endsWith('.cs')) || files.some(f => f.endsWith('.csproj'))) {
                languages.push('csharp');
            }
            
        } catch (error) {
            // Silent fallback
            console.log('Project detection error:', error);
        }
        
        return {
            name: projectName,
            description: `${projectName} - Solo development with FORGE Framework`,
            languages: languages.length > 0 ? languages : ['unknown'],
            frameworks: frameworks,
            type: frameworks.includes('vscode-extension') ? 'vscode-extension' : 'general'
        };
    }
    
    private static async createCopilotInstructions(githubDir: string, projectInfo: any): Promise<void> {
        const instructionsContent = `# 🔨 ${projectInfo.name} - FORGE Instructions

## 📋 Project Context
- **Name:** ${projectInfo.name}
- **Type:** ${projectInfo.type}
- **Languages:** ${projectInfo.languages.join(', ')}
- **Frameworks:** ${projectInfo.frameworks.join(', ')}

## 🎯 Development Guidelines
1. **Atomic Tasks:** Keep tasks ≤3 hours
2. **Error Learning:** Document errors as prevention rules
3. **Solo Focus:** Optimize for single developer workflow
4. **Context Aware:** Always check workspace structure first

## 🛡️ Prevention Rules
*Rules will be automatically injected here from prevention-rules.md*

---
*This file is automatically managed by FORGE Framework*`;
        
        await writeFile(path.join(githubDir, 'copilot-instructions.md'), instructionsContent);
    }
    
    private static async updateGitignore(workspacePath: string): Promise<void> {
        const gitignorePath = path.join(workspacePath, '.gitignore');
        let gitignoreContent = '';
        
        try {
            if (await exists(gitignorePath)) {
                gitignoreContent = await readFile(gitignorePath, 'utf8');
            }
            
            const forgeIgnores = [
                '# FORGE Framework - Private instructions',
                '.github/copilot-instructions.md',
                ''
            ];
            
            let needsUpdate = false;
            for (const line of forgeIgnores) {
                if (line && !gitignoreContent.includes(line)) {
                    needsUpdate = true;
                    break;
                }
            }
            
            if (needsUpdate) {
                gitignoreContent += '\n' + forgeIgnores.join('\n');
                await writeFile(gitignorePath, gitignoreContent);
            }
            
        } catch (error) {
            // Silent fallback - .gitignore is optional
            console.log('Gitignore update error:', error);
        }
    }
    
    private static getWorkspaceRoot(): string {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error("No workspace root found. Please open a folder first.");
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
}
