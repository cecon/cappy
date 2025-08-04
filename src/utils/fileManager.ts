import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CapybaraConfig } from '../models/capybaraConfig';

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
        return this.workspaceRoot;
    }

    async writeCapybaraConfig(config: CapybaraConfig): Promise<void> {
        const configPath = path.join(this.ensureWorkspace(), '.capy', 'config.json');
        // Ensure .capy directory exists
        const capyDir = path.dirname(configPath);
        if (!fs.existsSync(capyDir)) {
            await fs.promises.mkdir(capyDir, { recursive: true });
        }
        const jsonContent = JSON.stringify(config, null, 2);
        await fs.promises.writeFile(configPath, jsonContent, 'utf8');
    }

    async readCapybaraConfig(): Promise<CapybaraConfig | null> {
        const configPath = path.join(this.ensureWorkspace(), '.capy', 'config.json');
        
        try {
            const jsonContent = await fs.promises.readFile(configPath, 'utf8');
            return JSON.parse(jsonContent) as CapybaraConfig;
        } catch (error) {
            return null;
        }
    }

    async getCopilotInstructionsPath(): Promise<string> {
        return path.join(this.ensureWorkspace(), '.github', 'copilot-instructions.md');
    }

    async writeCopilotInstructions(content: string): Promise<void> {
        const instructionsPath = await this.getCopilotInstructionsPath();
        // Ensure .github directory exists
        const githubDir = path.dirname(instructionsPath);
        if (!fs.existsSync(githubDir)) {
            await fs.promises.mkdir(githubDir, { recursive: true });
        }
        await fs.promises.writeFile(instructionsPath, content, 'utf8');
    }

    /**
     * Update or inject Capybara instructions in copilot-instructions.md with version control
     */
    async updateCapybaraInstructions(capybaraContent: string, version: string): Promise<void> {
        const instructionsPath = await this.getCopilotInstructionsPath();
        const startMarker = `=====================START CAPYBARA MEMORY v${version}=====================`;
        const endMarker = `======================END CAPYBARA MEMORY v${version}======================`;
        
        let existingContent = '';
        if (fs.existsSync(instructionsPath)) {
            existingContent = await fs.promises.readFile(instructionsPath, 'utf8');
        }

        // Remove any existing Capybara sections (any version)
        const cleanedContent = this.removeExistingCapybaraSection(existingContent);
        
        // Add new Capybara section
        const newContent = cleanedContent.trim() 
            ? `${cleanedContent}\n\n${capybaraContent}`
            : capybaraContent;

        // Ensure .github directory exists
        const githubDir = path.dirname(instructionsPath);
        if (!fs.existsSync(githubDir)) {
            await fs.promises.mkdir(githubDir, { recursive: true });
        }

        await fs.promises.writeFile(instructionsPath, newContent, 'utf8');
    }

    /**
     * Remove existing Capybara section from content
     */
    private removeExistingCapybaraSection(content: string): string {
        const startPattern = /=+START CAPYBARA MEMORY v[\d.]+={20,}/;
        const endPattern = /=+END CAPYBARA MEMORY v[\d.]+={20,}/;
        
        const lines = content.split('\n');
        const result: string[] = [];
        let inCapybaraSection = false;
        
        for (const line of lines) {
            if (startPattern.test(line)) {
                inCapybaraSection = true;
                continue;
            }
            
            if (endPattern.test(line)) {
                inCapybaraSection = false;
                continue;
            }
            
            if (!inCapybaraSection) {
                result.push(line);
            }
        }
        
        return result.join('\n').trim();
    }

    /**
     * Get current Capybara version from instructions file
     */
    async getCurrentCapybaraVersion(): Promise<string | null> {
        const instructionsPath = await this.getCopilotInstructionsPath();
        
        if (!fs.existsSync(instructionsPath)) {
            return null;
        }
        
        const content = await fs.promises.readFile(instructionsPath, 'utf8');
        const versionMatch = content.match(/START CAPYBARA MEMORY v([\d.]+)/);
        
        return versionMatch ? versionMatch[1] : null;
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
        if (await this.hasFilesWithExtension('.py')) {
            languages.add('python');
        }

        // Check for C# files
        if (await this.hasFilesWithExtension('.cs')) {
            languages.add('csharp');
        }

        // Check for Java files
        if (await this.hasFilesWithExtension('.java')) {
            languages.add('java');
        }

        return Array.from(languages);
    }

    private async hasFilesWithExtension(extension: string): Promise<boolean> {
        const workspaceRoot = this.ensureWorkspace();
        
        try {
            const files = await this.findFilesRecursively(workspaceRoot, extension);
            return files.length > 0;
        } catch (error) {
            console.error(`Error searching for ${extension} files:`, error);
            return false;
        }
    }

    private async findFilesRecursively(dir: string, extension: string, maxDepth: number = 3): Promise<string[]> {
        if (maxDepth <= 0) {
            return [];
        }

        const files: string[] = [];
        
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    const subFiles = await this.findFilesRecursively(fullPath, extension, maxDepth - 1);
                    files.push(...subFiles);
                } else if (entry.isFile() && entry.name.endsWith(extension)) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Ignore directory access errors
        }
        
        return files;
    }
}
