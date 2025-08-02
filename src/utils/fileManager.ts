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

    async ensureCapybaraStructure(): Promise<void> {
        const workspaceRoot = this.ensureWorkspace();
        const capyDir = path.join(workspaceRoot, '.capy');
        const githubDir = path.join(workspaceRoot, '.github');

        await fs.promises.mkdir(capyDir, { recursive: true });
        await fs.promises.mkdir(githubDir, { recursive: true });
        await fs.promises.mkdir(path.join(capyDir, 'history'), { recursive: true });
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
            if (fs.existsSync(configPath)) {
                const content = await fs.promises.readFile(configPath, 'utf8');
                return JSON.parse(content) as CapybaraConfig;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getCopilotInstructionsPath(): Promise<string> {
        return path.join(this.ensureWorkspace(), '.github', 'copilot-instructions.md');
    }

    async writeCopilotInstructions(content: string): Promise<void> {
        const instructionsPath = await this.getCopilotInstructionsPath();
        await fs.promises.writeFile(instructionsPath, content, 'utf8');
    }

    /**
     * Update or inject Capybara instructions in copilot-instructions.md with version control
     */
    async updateCapybaraInstructions(capybaraContent: string, version: string): Promise<void> {
        const instructionsPath = await this.getCopilotInstructionsPath();
        
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
}
