import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CappyConfig } from '../models/cappyConfig';

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

    async writeCappyConfig(config: CappyConfig): Promise<void> {
        const configPath = path.join(this.ensureWorkspace(), '.capy', 'config.yaml');
        // Ensure .capy directory exists
        const capyDir = path.dirname(configPath);
        if (!fs.existsSync(capyDir)) {
            await fs.promises.mkdir(capyDir, { recursive: true });
        }
        // NOTE: For now, we store minimal YAML. Full mapping can be added when needed.
        const yaml = `version: "${config.version}"
createdAt: "${(config as any).createdAt || ''}"
lastUpdated: "${(config as any).lastUpdated || ''}"
`;
        await fs.promises.writeFile(configPath, yaml, 'utf8');
    }

    async readCappyConfig(): Promise<CappyConfig | null> {
        const configPath = path.join(this.ensureWorkspace(), '.capy', 'config.yaml');
        
        try {
            const content = await fs.promises.readFile(configPath, 'utf8');
            // Minimal parse: extract version if present
            const m = content.match(/version:\s*"?([\d.]+)"?/);
            const version = m ? m[1] : '0.0.0';
            return {
                version,
                instructionsVersion: '',
                project: { name: '', language: [], framework: [] },
                stack: { primary: 'typescript', secondary: [], patterns: [], conventions: { codeStyle: [], testing: [], architecture: [] } },
                environment: { os: 'windows', shell: 'powershell', editor: 'vscode', packageManager: 'npm', containerization: 'docker' },
                context: { maxRules: 0, autoPrioritize: false, languageSpecific: false, projectPatterns: false, autoUpdateCopilot: false },
                tasks: { maxAtomicHours: 0, defaultTemplate: '', autoTimeEstimation: false, atomicityWarning: false, requireUnitTests: false, testFramework: '', testCoverage: 0, nextTaskNumber: 1, workflowMode: 'single-focus' },
                ai: { provider: 'copilot', copilotIntegration: true, contextFile: '.github/copilot-instructions.md', maxContextSize: 4000 },
                analytics: { enabled: false, trackTime: false, trackEffectiveness: false },
                createdAt: new Date(),
                lastUpdated: new Date(),
            } as CappyConfig;
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
     * Update or inject Cappy instructions in copilot-instructions.md with version control
     */
    async updateCappyInstructions(cappyContent: string, version: string): Promise<void> {
        const instructionsPath = await this.getCopilotInstructionsPath();
        const startMarker = `=====================START CAPYBARA MEMORY v${version}=====================`;
        const endMarker = `======================END CAPYBARA MEMORY v${version}======================`;
        
        let existingContent = '';
        if (fs.existsSync(instructionsPath)) {
            existingContent = await fs.promises.readFile(instructionsPath, 'utf8');
        }

        // Remove any existing Cappy sections (any version)
        const cleanedContent = this.removeExistingCappySection(existingContent);
        
        // Add new Cappy section
        const newContent = cleanedContent.trim() 
            ? `${cleanedContent}\n\n${cappyContent}`
            : cappyContent;

        // Ensure .github directory exists
        const githubDir = path.dirname(instructionsPath);
        if (!fs.existsSync(githubDir)) {
            await fs.promises.mkdir(githubDir, { recursive: true });
        }

        await fs.promises.writeFile(instructionsPath, newContent, 'utf8');
    }

    /**
     * Remove existing Cappy section from content
     */
    private removeExistingCappySection(content: string): string {
        const startPattern = /=+START CAPYBARA MEMORY v[\d.]+={20,}/;
        const endPattern = /=+END CAPYBARA MEMORY v[\d.]+={20,}/;
        
        const lines = content.split('\n');
        const result: string[] = [];
        let inCappySection = false;
        
        for (const line of lines) {
            if (startPattern.test(line)) {
                inCappySection = true;
                continue;
            }
            
            if (endPattern.test(line)) {
                inCappySection = false;
                continue;
            }
            
            if (!inCappySection) {
                result.push(line);
            }
        }
        
        return result.join('\n').trim();
    }

    /**
     * Get current Cappy version from instructions file
     */
    async getCurrentCappyVersion(): Promise<string | null> {
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
