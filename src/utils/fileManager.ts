import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'yaml';
import { ForgeConfig } from '../models/forgeConfig';
import { Task } from '../models/task';
import { PreventionRule } from '../models/preventionRule';

export class FileManager {
    private workspaceRoot: string;

    constructor() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }
        this.workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    async ensureForgeStructure(): Promise<void> {
        const forgePath = path.join(this.workspaceRoot, '.forge');
        const tasksPath = path.join(this.workspaceRoot, 'tasks');
        const vscodePath = path.join(this.workspaceRoot, '.vscode');
        const templatesPath = path.join(forgePath, 'templates');

        await fs.ensureDir(forgePath);
        await fs.ensureDir(tasksPath);
        await fs.ensureDir(vscodePath);
        await fs.ensureDir(templatesPath);
    }

    async writeForgeConfig(config: ForgeConfig): Promise<void> {
        const configPath = path.join(this.workspaceRoot, '.forge', 'config.yml');
        const yamlContent = yaml.stringify(config);
        await fs.writeFile(configPath, yamlContent, 'utf8');
    }

    async readForgeConfig(): Promise<ForgeConfig | null> {
        const configPath = path.join(this.workspaceRoot, '.forge', 'config.yml');
        
        try {
            const yamlContent = await fs.readFile(configPath, 'utf8');
            return yaml.parse(yamlContent) as ForgeConfig;
        } catch (error) {
            return null;
        }
    }

    async createTaskFolder(taskId: string): Promise<string> {
        const taskPath = path.join(this.workspaceRoot, 'tasks', taskId);
        const artifactsPath = path.join(taskPath, 'artifacts');

        await fs.ensureDir(taskPath);
        await fs.ensureDir(artifactsPath);

        return taskPath;
    }

    async writeTaskFile(taskPath: string, filename: string, content: string): Promise<void> {
        const filePath = path.join(taskPath, filename);
        await fs.writeFile(filePath, content, 'utf8');
    }

    async readTaskFile(taskPath: string, filename: string): Promise<string | null> {
        const filePath = path.join(taskPath, filename);
        
        try {
            return await fs.readFile(filePath, 'utf8');
        } catch (error) {
            return null;
        }
    }

    async getCopilotInstructionsPath(): Promise<string> {
        return path.join(this.workspaceRoot, '.vscode', 'copilot-instructions.md');
    }

    async writeCopilotInstructions(content: string): Promise<void> {
        const instructionsPath = await this.getCopilotInstructionsPath();
        await fs.writeFile(instructionsPath, content, 'utf8');
    }

    async getTaskFolders(): Promise<string[]> {
        const tasksPath = path.join(this.workspaceRoot, 'tasks');
        
        try {
            const items = await fs.readdir(tasksPath, { withFileTypes: true });
            return items
                .filter((item: fs.Dirent) => item.isDirectory())
                .map((item: fs.Dirent) => item.name)
                .sort();
        } catch (error) {
            return [];
        }
    }

    async taskExists(taskId: string): Promise<boolean> {
        const taskPath = path.join(this.workspaceRoot, 'tasks', taskId);
        return fs.pathExists(taskPath);
    }

    async getProjectLanguages(): Promise<string[]> {
        const languages: Set<string> = new Set();

        // Check package.json for JavaScript/TypeScript projects
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
            languages.add('javascript');
            
            // Check for TypeScript
            const packageJson = await fs.readJson(packageJsonPath);
            if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
                languages.add('typescript');
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
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
            try {
                const packageJson = await fs.readJson(packageJsonPath);
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

                if (deps.react) frameworks.add('react');
                if (deps.vue) frameworks.add('vue');
                if (deps.angular) frameworks.add('angular');
                if (deps.svelte) frameworks.add('svelte');
                if (deps.next) frameworks.add('nextjs');
                if (deps.nuxt) frameworks.add('nuxtjs');
                if (deps.express) frameworks.add('express');
                if (deps.fastify) frameworks.add('fastify');
                if (deps.nest) frameworks.add('nestjs');
            } catch (error) {
                // Ignore JSON parsing errors
            }
        }

        // Check for Python frameworks
        const requirementsPath = path.join(this.workspaceRoot, 'requirements.txt');
        if (await fs.pathExists(requirementsPath)) {
            try {
                const requirements = await fs.readFile(requirementsPath, 'utf8');
                if (requirements.includes('django')) frameworks.add('django');
                if (requirements.includes('flask')) frameworks.add('flask');
                if (requirements.includes('fastapi')) frameworks.add('fastapi');
            } catch (error) {
                // Ignore file read errors
            }
        }

        return Array.from(frameworks);
    }
}
