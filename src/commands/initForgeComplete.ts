import * as vscode from 'vscode';
import { ForgeConfig, DEFAULT_FORGE_CONFIG } from '../models/forgeConfig';

/**
 * Command: "vamos inicializar as configs do forge"
 * Complete FORGE initialization with environment and stack detection
 */
export async function initForgeComplete(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first');
        return;
    }

    try {
        vscode.window.showInformationMessage('🚀 Inicializando configurações FORGE...');
        
        // Phase 1: Environment Detection
        const environment = await detectAndConfigureEnvironment();
        
        // Phase 2: Stack Detection  
        const stack = await detectAndConfigureStack();
        
        // Phase 3: FORGE Preferences
        const forgePrefs = await configureForgePreferences();
        
        // Phase 4: Generate Files
        await generateForgeFiles({
            ...DEFAULT_FORGE_CONFIG,
            environment,
            stack,
            ...forgePrefs,
            createdAt: new Date(),
            lastUpdated: new Date()
        } as ForgeConfig);
        
        vscode.window.showInformationMessage('🎯 FORGE configurado com sucesso!');
        
    } catch (error) {
        vscode.window.showErrorMessage(`Error initializing FORGE: ${error}`);
    }
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

async function detectAndConfigureEnvironment() {
    const platform = process.platform;
    let detectedOS: 'windows' | 'macos' | 'linux';
    let detectedShell: string;
    
    // Auto-detect OS and default shell
    switch (platform) {
        case 'win32':
            detectedOS = 'windows';
            detectedShell = 'powershell';
            break;
        case 'darwin':
            detectedOS = 'macos';
            detectedShell = 'zsh';
            break;
        default:
            detectedOS = 'linux';
            detectedShell = 'bash';
    }
    
    // Auto-detect editor (we know it's VS Code)
    const detectedEditor = 'vscode';
    
    // Auto-detect package manager
    const packageManager = await detectPackageManager();
    
    // Confirm with user
    const confirmation = await vscode.window.showInformationMessage(
        `🔍 Ambiente detectado: ${detectedOS} + ${detectedShell} + ${detectedEditor} + ${packageManager}`,
        'Confirmar',
        'Configurar manualmente'
    );
    
    if (confirmation === 'Confirmar') {
        return {
            os: detectedOS,
            shell: detectedShell as any,
            editor: detectedEditor as any,
            packageManager,
            containerization: 'docker' as any
        };
    } else {
        // Manual configuration
        return await manualEnvironmentConfiguration();
    }
}

async function detectPackageManager(): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return 'npm';
    
    // Check for lock files
    if (await fileExists(vscode.Uri.joinPath(workspaceFolder.uri, 'pnpm-lock.yaml'))) {
        return 'pnpm';
    }
    if (await fileExists(vscode.Uri.joinPath(workspaceFolder.uri, 'yarn.lock'))) {
        return 'yarn';
    }
    if (await fileExists(vscode.Uri.joinPath(workspaceFolder.uri, 'package-lock.json'))) {
        return 'npm';
    }
    if (await fileExists(vscode.Uri.joinPath(workspaceFolder.uri, 'requirements.txt'))) {
        return 'pip';
    }
    if (await fileExists(vscode.Uri.joinPath(workspaceFolder.uri, 'Cargo.toml'))) {
        return 'cargo';
    }
    
    return 'npm'; // default
}

async function detectAndConfigureStack() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) throw new Error('No workspace folder');
    
    const detectedStack = await autoDetectStack(workspaceFolder);
    
    if (detectedStack) {
        const confirmation = await vscode.window.showInformationMessage(
            `🎯 Stack detectada: ${detectedStack.primary} + ${detectedStack.secondary.join(' + ')}`,
            'Confirmar',
            'Configurar manualmente'
        );
        
        if (confirmation === 'Confirmar') {
            return detectedStack;
        }
    }
    
    // Manual stack configuration
    return await manualStackConfiguration();
}

async function autoDetectStack(workspaceFolder: vscode.WorkspaceFolder) {
    // Check for TypeScript
    if (await fileExists(vscode.Uri.joinPath(workspaceFolder.uri, 'tsconfig.json'))) {
        const packageJson = await readPackageJson(workspaceFolder);
        const frameworks = [];
        
        if (packageJson?.dependencies?.express || packageJson?.devDependencies?.express) {
            frameworks.push('express');
        }
        if (packageJson?.dependencies?.react || packageJson?.devDependencies?.react) {
            frameworks.push('react');
        }
        if (packageJson?.dependencies?.['next'] || packageJson?.devDependencies?.['next']) {
            frameworks.push('nextjs');
        }
        
        return {
            primary: 'typescript',
            secondary: ['node', ...frameworks],
            patterns: ['rest-api'],
            conventions: {
                codeStyle: ['eslint', 'prettier'],
                testing: packageJson?.devDependencies?.jest ? ['jest'] : ['vitest'],
                architecture: ['clean-architecture']
            }
        };
    }
    
    // Check for Python
    if (await fileExists(vscode.Uri.joinPath(workspaceFolder.uri, 'requirements.txt'))) {
        return {
            primary: 'python',
            secondary: ['fastapi'], // could detect more specifically
            patterns: ['rest-api'],
            conventions: {
                codeStyle: ['black', 'ruff'],
                testing: ['pytest'],
                architecture: ['clean-architecture']
            }
        };
    }
    
    // Check for Rust
    if (await fileExists(vscode.Uri.joinPath(workspaceFolder.uri, 'Cargo.toml'))) {
        return {
            primary: 'rust',
            secondary: ['actix-web'], // could detect more specifically
            patterns: ['rest-api'],
            conventions: {
                codeStyle: ['rustfmt'],
                testing: ['cargo-test'],
                architecture: ['clean-architecture']
            }
        };
    }
    
    return null;
}

async function readPackageJson(workspaceFolder: vscode.WorkspaceFolder) {
    try {
        const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
        const content = await vscode.workspace.fs.readFile(packageJsonUri);
        return JSON.parse(content.toString());
    } catch {
        return null;
    }
}

async function manualEnvironmentConfiguration() {
    // Implementation for manual environment configuration
    // This would show QuickPick menus for each option
    
    const os = await vscode.window.showQuickPick(
        ['windows', 'macos', 'linux'],
        { placeHolder: 'Selecione o sistema operacional' }
    );
    
    const shell = await vscode.window.showQuickPick(
        ['powershell', 'bash', 'zsh', 'cmd'],
        { placeHolder: 'Selecione o shell padrão' }
    );
    
    // ... more configuration steps
    
    return {
        os: os as any,
        shell: shell as any,
        editor: 'vscode' as any,
        packageManager: 'npm',
        containerization: 'docker' as any
    };
}

async function manualStackConfiguration() {
    const primary = await vscode.window.showQuickPick(
        [
            { label: 'TypeScript/Node.js', value: 'typescript' },
            { label: 'Python', value: 'python' },
            { label: 'Rust', value: 'rust' },
            { label: 'Java', value: 'java' },
            { label: 'C#', value: 'csharp' },
            { label: 'Go', value: 'go' }
        ],
        { placeHolder: 'Selecione a linguagem principal' }
    );
    
    // ... more configuration steps based on primary language
    
    return {
        primary: primary?.value || 'typescript',
        secondary: ['node'],
        patterns: ['rest-api'],
        conventions: {
            codeStyle: ['eslint'],
            testing: ['jest'],
            architecture: ['clean-architecture']
        }
    };
}

async function configureForgePreferences() {
    const maxHours = await vscode.window.showInputBox({
        prompt: 'Máximo de horas por STEP atômica',
        value: '3',
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 8) {
                return 'Digite um número entre 1 e 8';
            }
            return null;
        }
    });
    
    const requireTests = await vscode.window.showQuickPick(
        ['Sim', 'Não'],
        { placeHolder: 'Testes unitários obrigatórios?' }
    );
    
    return {
        tasks: {
            maxAtomicHours: parseInt(maxHours || '3'),
            defaultTemplate: 'standard',
            autoTimeEstimation: true,
            atomicityWarning: true,
            requireUnitTests: requireTests === 'Sim',
            testFramework: 'jest',
            testCoverage: 80
        }
    };
}

async function generateForgeFiles(config: ForgeConfig) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) throw new Error('No workspace folder');
    
    // 1. Create forgeConfig.json
    await createFile(
        vscode.Uri.joinPath(workspaceFolder.uri, 'src', 'forgeConfig.json'),
        JSON.stringify(config, null, 2)
    );
    
    // 2. Create stack-instructions.md
    const stackInstructions = generateStackInstructions(config.stack);
    await createFile(
        vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'stack-instructions.md'),
        stackInstructions
    );
    
    // 3. Create copilot-instructions.md with environment rules
    const copilotInstructions = generateCopilotInstructions(config);
    await createFile(
        vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'copilot-instructions.md'),
        copilotInstructions
    );
    
    // 4. Create steps directory
    await createDirectory(vscode.Uri.joinPath(workspaceFolder.uri, 'steps'));
}

async function createFile(uri: vscode.Uri, content: string) {
    // Ensure directory exists
    const dir = vscode.Uri.joinPath(uri, '..');
    await createDirectory(dir);
    
    // Write file
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

async function createDirectory(uri: vscode.Uri) {
    try {
        await vscode.workspace.fs.createDirectory(uri);
    } catch {
        // Directory might already exist, ignore
    }
}

function generateStackInstructions(stack: any): string {
    // Generate stack-specific instructions based on the configuration
    // This would use templates from forge-stack-setup.md
    return `# Stack Instructions - ${stack.primary}\n\n[Generated content based on stack configuration]`;
}

function generateCopilotInstructions(config: ForgeConfig): string {
    // Load template and inject environment rules
    const environmentRules = generateEnvironmentRules(config.environment);
    
    // Use template from copilot-instructions-template.md and replace placeholders
    return `# GitHub Copilot Instructions - FORGE Framework

## 🎯 Primary Directive
This project uses the FORGE Framework for atomic task management and automatic error prevention.

## 📚 Stack-Specific Guidelines
{LOAD_FROM: .github/stack-instructions.md}

## 🖥️ Environment-Specific Rules
${environmentRules}

[... rest of template content ...]`;
}

function generateEnvironmentRules(environment: any): string {
    // Generate environment-specific rules based on OS, shell, etc.
    // This would use templates from environment-rules-templates.md
    
    if (environment.os === 'windows' && environment.shell === 'powershell') {
        return `## 🖥️ **Environment Rules - Windows PowerShell + VS Code**

### **Shell Command Syntax**
- ✅ **DO**: Use semicolon to chain commands
  \`\`\`powershell
  npm install; npm run build; npm start
  \`\`\`
- ❌ **DON'T**: Use && (bash syntax won't work)
  \`\`\`bash
  npm install && npm run build  # ❌ PowerShell error
  \`\`\`

### **Environment Variables**
- ✅ **DO**: PowerShell environment syntax
  \`\`\`powershell
  $env:NODE_ENV = "development"
  \`\`\`
- ❌ **DON'T**: Use bash export syntax
  \`\`\`bash
  export NODE_ENV=development  # ❌ PowerShell doesn't understand
  \`\`\``;
    }
    
    // Add templates for other environments...
    return '// Environment rules for ' + environment.os + ' + ' + environment.shell;
}
