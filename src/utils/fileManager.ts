import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';
import { ForgeConfig } from '../models/forgeConfig';
import { Task } from '../models/task';
import { PreventionRule } from '../models/preventionRule';

export class FileManager {
    private workspaceRoot: string | null = null;

    constructor() {
        // Don't throw in constructor - initialize safely
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
    }

    private ensureWorkspace(): string {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder found');
        }
        return this.ensureWorkspace();
    }

    async ensureForgeStructure(): Promise<void> {
        const workspaceRoot = this.ensureWorkspace();
        const forgePath = path.join(workspaceRoot, '.forge');
        const tasksPath = path.join(workspaceRoot, 'tasks');
        const vscodePath = path.join(workspaceRoot, '.vscode');
        const templatesPath = path.join(forgePath, 'templates');

        await fs.promises.mkdir(forgePath, { recursive: true });
        await fs.promises.mkdir(tasksPath, { recursive: true });
        await fs.promises.mkdir(vscodePath, { recursive: true });
        await fs.promises.mkdir(templatesPath, { recursive: true });
    }

    async writeForgeConfig(config: ForgeConfig): Promise<void> {
        const configPath = path.join(this.ensureWorkspace(), '.forge', 'config.yml');
        const yamlContent = yaml.stringify(config);
        await fs.promises.writeFile(configPath, yamlContent, 'utf8');
    }

    async readForgeConfig(): Promise<ForgeConfig | null> {
        const configPath = path.join(this.ensureWorkspace(), '.forge', 'config.yml');
        
        try {
            const yamlContent = await fs.promises.readFile(configPath, 'utf8');
            return yaml.parse(yamlContent) as ForgeConfig;
        } catch (error) {
            return null;
        }
    }

    async createTaskFolder(taskId: string): Promise<string> {
        const taskPath = path.join(this.ensureWorkspace(), 'tasks', taskId);
        const artifactsPath = path.join(taskPath, 'artifacts');

        await fs.promises.mkdir(taskPath, { recursive: true });
        await fs.promises.mkdir(artifactsPath, { recursive: true });

        return taskPath;
    }

    async writeTaskFile(taskPath: string, filename: string, content: string): Promise<void> {
        const filePath = path.join(taskPath, filename);
        await fs.promises.writeFile(filePath, content, 'utf8');
    }

    async readTaskFile(taskPath: string, filename: string): Promise<string | null> {
        const filePath = path.join(taskPath, filename);
        
        try {
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (error) {
            return null;
        }
    }

    async getCopilotInstructionsPath(): Promise<string> {
        return path.join(this.ensureWorkspace(), '.vscode', 'copilot-instructions.md');
    }

    async writeCopilotInstructions(content: string): Promise<void> {
        const instructionsPath = await this.getCopilotInstructionsPath();
        await fs.promises.writeFile(instructionsPath, content, 'utf8');
    }

    async getTaskFolders(): Promise<string[]> {
        const tasksPath = path.join(this.ensureWorkspace(), 'tasks');
        
        try {
            const items = await fs.promises.readdir(tasksPath, { withFileTypes: true });
            return items
                .filter((item) => item.isDirectory())
                .map((item) => item.name)
                .sort();
        } catch (error) {
            return [];
        }
    }

    async taskExists(taskId: string): Promise<boolean> {
        const taskPath = path.join(this.ensureWorkspace(), 'tasks', taskId);
        try {
            await fs.promises.access(taskPath, fs.constants.F_OK);
            return true;
        } catch (error: any) {
            return error.code !== 'ENOENT';
        }
    }

    async getProjectLanguages(): Promise<string[]> {
        const languages: Set<string> = new Set();

        // Check package.json for JavaScript/TypeScript projects
        const packageJsonPath = path.join(this.ensureWorkspace(), 'package.json');
        try {
            await fs.promises.access(packageJsonPath, fs.constants.F_OK);
            languages.add('javascript');
            
            // Check for TypeScript
            const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);
            if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
                languages.add('typescript');
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Error reading package.json:', error);
            }
        }

        // Check for Python files
        const pythonFiles = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**', 1);
        if (pythonFiles.length > 0) {
            languages.add('python');
        }

        // Check for Java files
        const javaFiles = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**', 1);
        if (javaFiles.length > 0) {
            languages.add('java');
        }

        // Check for C# files
        const csharpFiles = await vscode.workspace.findFiles('**/*.cs', '**/node_modules/**', 1);
        if (csharpFiles.length > 0) {
            languages.add('csharp');
        }

        // Check for Rust files
        const rustFiles = await vscode.workspace.findFiles('**/*.rs', '**/node_modules/**', 1);
        if (rustFiles.length > 0) {
            languages.add('rust');
        }

        return Array.from(languages);
    }

    async getProjectFrameworks(): Promise<string[]> {
        const frameworks: Set<string> = new Set();

        // Check package.json for web frameworks
        const packageJsonPath = path.join(this.ensureWorkspace(), 'package.json');
        try {
            await fs.promises.access(packageJsonPath, fs.constants.F_OK);
            try {
                const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf8');
                const packageJson = JSON.parse(packageJsonContent);
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

                if (deps.react) {
                    frameworks.add('react');
                }
                if (deps.vue) {
                    frameworks.add('vue');
                }
                if (deps.angular) {
                    frameworks.add('angular');
                }
                if (deps.svelte) {
                    frameworks.add('svelte');
                }
                if (deps.next) {
                    frameworks.add('nextjs');
                }
                if (deps.nuxt) {
                    frameworks.add('nuxtjs');
                }
                if (deps.express) {
                    frameworks.add('express');
                }
                if (deps.fastify) {
                    frameworks.add('fastify');
                }
                if (deps.nest) {
                    frameworks.add('nestjs');
                }
            } catch (error) {
                // Ignore JSON parsing errors
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Error checking package.json:', error);
            }
        }

        // Check for Python frameworks
        const requirementsPath = path.join(this.ensureWorkspace(), 'requirements.txt');
        try {
            await fs.promises.access(requirementsPath, fs.constants.F_OK);
            try {
                const requirements = await fs.promises.readFile(requirementsPath, 'utf8');
                if (requirements.includes('django')) {
                    frameworks.add('django');
                }
                if (requirements.includes('flask')) {
                    frameworks.add('flask');
                }
                if (requirements.includes('fastapi')) {
                    frameworks.add('fastapi');
                }
            } catch (error) {
                // Ignore file read errors
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Error checking requirements.txt:', error);
            }
        }

        return Array.from(frameworks);
    }
}
