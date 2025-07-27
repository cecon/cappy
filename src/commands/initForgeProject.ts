/**
 * Command to initialize FORGE framework in user's project
 * Creates the modular instruction structure in .github/instructions/
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export async function initForgeInProject() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    
    try {
        // Create .github/instructions/ directory
        const instructionsDir = path.join(workspaceRoot, '.github', 'instructions');
        await fs.promises.mkdir(instructionsDir, { recursive: true });

        // Create .forge/ directory for local config
        const forgeDir = path.join(workspaceRoot, '.forge');
        await fs.promises.mkdir(forgeDir, { recursive: true });

        // Handle existing copilot-instructions.md file
        const copilotInstructionsPath = path.join(workspaceRoot, '.github', 'copilot-instructions.md');
        await handleCopilotInstructionsFile(copilotInstructionsPath);

        // Copy modular instruction files from extension resources
        await copyInstructionFiles(instructionsDir);

        // Create minimal forge config
        const forgeConfig = {
            forgeVersion: "1.0.0",
            projectName: path.basename(workspaceRoot),
            stepCounter: 0,
            preventionRules: [],
            settings: {
                atomicityLimit: 3,
                autoAccumulate: true,
                templateStyle: "markdown"
            }
        };

        await fs.promises.writeFile(
            path.join(forgeDir, 'config.json'),
            JSON.stringify(forgeConfig, null, 2)
        );

        // Create steps directory
        const stepsDir = path.join(workspaceRoot, 'steps');
        await fs.promises.mkdir(stepsDir, { recursive: true });

        vscode.window.showInformationMessage(
            'FORGE Framework initialized successfully! ' +
            'Copilot instructions are now active.'
        );

        // Open the main copilot instructions file
        const copilotInstructionsUri = vscode.Uri.file(copilotInstructionsPath);
        await vscode.window.showTextDocument(copilotInstructionsUri);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize FORGE: ${error}`);
    }
}

async function handleCopilotInstructionsFile(filePath: string) {
    try {
        // Check if file already exists
        const fileExists = await fs.promises.access(filePath).then(() => true).catch(() => false);
        
        if (fileExists) {
            // Read existing content
            const existingContent = await fs.promises.readFile(filePath, 'utf8');
            
            // Check if FORGE instructions are already present
            if (existingContent.includes('FORGE Framework') || existingContent.includes('forge-methodology.md')) {
                vscode.window.showInformationMessage(
                    'FORGE instructions already present in copilot-instructions.md'
                );
                return;
            }
            
            // Ask user how to handle existing file
            const choice = await vscode.window.showQuickPick(
                [
                    'Append FORGE instructions to existing file',
                    'Prepend FORGE instructions to existing file', 
                    'Replace existing file with FORGE instructions',
                    'Skip copilot-instructions.md setup'
                ],
                {
                    placeHolder: 'Existing copilot-instructions.md found. How would you like to proceed?'
                }
            );
            
            switch (choice) {
                case 'Append FORGE instructions to existing file':
                    await appendForgeInstructions(filePath, existingContent);
                    break;
                case 'Prepend FORGE instructions to existing file':
                    await prependForgeInstructions(filePath, existingContent);
                    break;
                case 'Replace existing file with FORGE instructions':
                    await createForgeInstructionsFile(filePath);
                    break;
                case 'Skip copilot-instructions.md setup':
                    vscode.window.showInformationMessage(
                        'Skipped copilot-instructions.md setup. You can manually add FORGE references.'
                    );
                    break;
                default:
                    // User cancelled, default to append
                    await appendForgeInstructions(filePath, existingContent);
                    break;
            }
        } else {
            // Create new file
            await createForgeInstructionsFile(filePath);
        }
    } catch (error) {
        throw new Error(`Failed to handle copilot-instructions.md: ${error}`);
    }
}

async function createForgeInstructionsFile(filePath: string) {
    const forgeInstructions = `# GitHub Copilot Instructions - FORGE Framework

## Primary Directive
This project uses the FORGE Framework for atomic task management and automatic error prevention. 

**ALWAYS** follow the comprehensive methodology detailed in:
- \`.github/instructions/forge-methodology.md\` - Complete FORGE workflow
- \`.github/instructions/forge-templates.md\` - STEP templates and structure  
- \`.github/instructions/forge-patterns.md\` - Context-specific patterns and rules

## Core Behavior
1. **STEP Creation**: Create atomic tasks using 4-file structure with error accumulation
2. **Atomicity Validation**: Ensure tasks are completable in 1-3 hours
3. **Error Prevention**: Inherit and accumulate "DON'T DO" rules from previous STEPs
4. **Progressive Learning**: Every mistake becomes prevention for future STEPs

## Quick Reference
- Use \`steps/STEP_XX_[TASK_NAME]/\` structure
- Always read previous STEP_XX_DIFFICULTIES_FACED.md first
- Copy accumulated rules to new STEP_XX_DESCRIPTION.md
- Document completion and propagate lessons learned

For complete instructions, refer to the files in \`.github/instructions/\`.`;

    await fs.promises.writeFile(filePath, forgeInstructions);
}

async function appendForgeInstructions(filePath: string, existingContent: string) {
    const forgeSection = `

---

## FORGE Framework Integration
This project uses the FORGE Framework for atomic task management and automatic error prevention.

**ALWAYS** follow the comprehensive methodology detailed in:
- \`.github/instructions/forge-methodology.md\` - Complete FORGE workflow
- \`.github/instructions/forge-templates.md\` - STEP templates and structure  
- \`.github/instructions/forge-patterns.md\` - Context-specific patterns and rules

### FORGE Core Behavior
1. **STEP Creation**: Create atomic tasks using 4-file structure with error accumulation
2. **Atomicity Validation**: Ensure tasks are completable in 1-3 hours
3. **Error Prevention**: Inherit and accumulate "DON'T DO" rules from previous STEPs
4. **Progressive Learning**: Every mistake becomes prevention for future STEPs

### FORGE Quick Reference
- Use \`steps/STEP_XX_[TASK_NAME]/\` structure
- Always read previous STEP_XX_DIFFICULTIES_FACED.md first
- Copy accumulated rules to new STEP_XX_DESCRIPTION.md
- Document completion and propagate lessons learned`;

    const updatedContent = existingContent + forgeSection;
    await fs.promises.writeFile(filePath, updatedContent);
    
    vscode.window.showInformationMessage(
        'FORGE instructions appended to existing copilot-instructions.md'
    );
}

async function prependForgeInstructions(filePath: string, existingContent: string) {
    const forgeSection = `# GitHub Copilot Instructions

## FORGE Framework Integration
This project uses the FORGE Framework for atomic task management and automatic error prevention.

**ALWAYS** follow the comprehensive methodology detailed in:
- \`.github/instructions/forge-methodology.md\` - Complete FORGE workflow
- \`.github/instructions/forge-templates.md\` - STEP templates and structure  
- \`.github/instructions/forge-patterns.md\` - Context-specific patterns and rules

### FORGE Core Behavior
1. **STEP Creation**: Create atomic tasks using 4-file structure with error accumulation
2. **Atomicity Validation**: Ensure tasks are completable in 1-3 hours
3. **Error Prevention**: Inherit and accumulate "DON'T DO" rules from previous STEPs
4. **Progressive Learning**: Every mistake becomes prevention for future STEPs

### FORGE Quick Reference
- Use \`steps/STEP_XX_[TASK_NAME]/\` structure
- Always read previous STEP_XX_DIFFICULTIES_FACED.md first
- Copy accumulated rules to new STEP_XX_DESCRIPTION.md
- Document completion and propagate lessons learned

---

`;

    const updatedContent = forgeSection + existingContent;
    await fs.promises.writeFile(filePath, updatedContent);
    
    vscode.window.showInformationMessage(
        'FORGE instructions prepended to existing copilot-instructions.md'
    );
}

async function copyInstructionFiles(targetDir: string) {
    const extensionPath = vscode.extensions.getExtension('your-publisher.forge-framework')?.extensionPath;
    if (!extensionPath) {
        throw new Error('Could not find FORGE extension path');
    }

    const sourceDir = path.join(extensionPath, 'resources', 'instructions');
    
    const files = [
        'forge-methodology.md',
        'forge-templates.md', 
        'forge-patterns.md'
    ];

    for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);
        
        try {
            const content = await fs.promises.readFile(sourcePath, 'utf8');
            await fs.promises.writeFile(targetPath, content);
        } catch (error) {
            console.error(`Failed to copy ${file}:`, error);
            // Create basic template if source file doesn't exist
            await createBasicTemplate(targetPath, file);
        }
    }
}

async function createBasicTemplate(filePath: string, fileName: string) {
    let content = '';
    
    switch (fileName) {
        case 'forge-methodology.md':
            content = '# FORGE Methodology\n\n[Methodology content will be loaded from extension]';
            break;
        case 'forge-templates.md':
            content = '# FORGE Templates\n\n[Templates content will be loaded from extension]';
            break;
        case 'forge-patterns.md':
            content = '# FORGE Patterns\n\n[Patterns content will be loaded from extension]';
            break;
    }
    
    await fs.promises.writeFile(filePath, content);
}
