import * as vscode from 'vscode';
import * as path from 'path';
import { FileManager } from '../utils/fileManager';
import { ForgeConfig, DEFAULT_FORGE_CONFIG } from '../models/forgeConfig';

export class ForgeInitializer {
    private fileManager: FileManager;

    constructor() {
        this.fileManager = new FileManager();
    }

    public async initialize(): Promise<boolean> {
        try {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('FORGE: No workspace folder found. Please open a folder first.');
                return false;
            }

            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const projectName = path.basename(workspaceRoot);

            // Show progress
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Initializing FORGE Framework',
                cancellable: false
            }, async (progress, token) => {
                try {
                    progress.report({ increment: 0, message: 'Setting up FORGE structure...' });

                    // Create FORGE directory structure
                    await this.fileManager.ensureForgeStructure();

                    progress.report({ increment: 25, message: 'Detecting project languages and frameworks...' });

                    // Detect project languages and frameworks
                    const languages = await this.fileManager.getProjectLanguages();
                    const frameworks = await this.fileManager.getProjectFrameworks();

                    progress.report({ increment: 50, message: 'Creating configuration...' });

                    // Create FORGE config
                    const config: ForgeConfig = {
                        ...DEFAULT_FORGE_CONFIG,
                        project: {
                            name: projectName,
                            language: languages,
                            framework: frameworks,
                            description: await this.getProjectDescription()
                        },
                        createdAt: new Date(),
                        lastUpdated: new Date()
                    } as ForgeConfig;

                    await this.fileManager.writeForgeConfig(config);

                    progress.report({ increment: 75, message: 'Creating templates and initial files...' });

                    // Create initial templates
                    await this.createInitialTemplates();

                    // Create initial Copilot instructions
                    await this.createInitialCopilotInstructions(config);

                    progress.report({ increment: 100, message: 'FORGE initialization complete!' });

                    // Show success message with next steps
                    const choice = await vscode.window.showInformationMessage(
                        `FORGE Framework initialized successfully!\n\nProject: ${projectName}\nLanguages: ${languages.join(', ') || 'None detected'}\nFrameworks: ${frameworks.join(', ') || 'None detected'}`,
                        'Create First Task',
                        'Open Dashboard',
                        'Learn More'
                    );

                    if (choice === 'Create First Task') {
                        await vscode.commands.executeCommand('forge.createTask');
                    } else if (choice === 'Open Dashboard') {
                        await vscode.commands.executeCommand('forge.openDashboard');
                    } else if (choice === 'Learn More') {
                        await vscode.env.openExternal(vscode.Uri.parse('https://github.com/cecon/forge-framework'));
                    }

                    return true;
                } catch (error) {
                    vscode.window.showErrorMessage(`FORGE initialization failed: ${error}`);
                    return false;
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`FORGE initialization failed: ${error}`);
            return false;
        }
    }

    private async getProjectDescription(): Promise<string> {
        // Try to get description from package.json
        const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const packageJsonPath = path.join(workspaceRoot, 'package.json');
        
        try {
            const fs = require('fs');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                if (packageJson.description) {
                    return packageJson.description;
                }
            }
        } catch (error) {
            // Ignore errors
        }

        // Try to get description from README
        const readmePath = path.join(workspaceRoot, 'README.md');
        try {
            const fs = require('fs');
            if (fs.existsSync(readmePath)) {
                const readmeContent = fs.readFileSync(readmePath, 'utf8');
                const lines = readmeContent.split('\n');
                
                // Look for first non-header line
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!') && trimmed.length > 10) {
                        return trimmed.substring(0, 200); // Limit length
                    }
                }
            }
        } catch (error) {
            // Ignore errors
        }

        return 'A software project managed with FORGE Framework';
    }

    private async createInitialTemplates(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const templatesPath = path.join(workspaceRoot, '.forge', 'templates');

        // Create description template
        const descriptionTemplate = `# Task: {{TASK_NAME}}

## 🎯 Objective
{{TASK_DESCRIPTION}}

## 📋 Requirements
- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## 🚫 Prevention Rules to Apply
{{PREVENTION_RULES}}

## ⏱️ Time Estimation
**Estimated:** {{ESTIMATED_HOURS}} hours
**Atomicity:** {{ATOMICITY_STATUS}}

## 📝 Implementation Notes
- Implementation approach
- Key considerations
- Dependencies needed

## ✅ Definition of Done
- [ ] Code implemented and tested
- [ ] Documentation updated
- [ ] Prevention rules applied
- [ ] No linting errors
- [ ] Ready for review

---
*Created: {{CREATED_DATE}}*
*FORGE Framework: Focus, Organize, Record, Grow, Evolve*
`;

        const completionTemplate = `# Task Completion: {{TASK_NAME}}

## ✅ What Was Accomplished
- Accomplishment 1
- Accomplishment 2
- Accomplishment 3

## 📊 Time Analysis
- **Estimated:** {{ESTIMATED_HOURS}} hours
- **Actual:** {{ACTUAL_HOURS}} hours
- **Variance:** {{VARIANCE}} ({{VARIANCE_PERCENTAGE}}%)

## 🔧 Technologies Used
- Technology 1
- Technology 2

## 📁 Artifacts Created
- \`file1.ts\` - Description
- \`file2.ts\` - Description

## 🎓 Lessons Learned
- Lesson 1
- Lesson 2

## 📈 Prevention Rules Generated
{{GENERATED_RULES}}

---
*Completed: {{COMPLETED_DATE}}*
*Total Time: {{ACTUAL_HOURS}} hours*
`;

        const difficultiesTemplate = `# Difficulties & Prevention Rules: {{TASK_NAME}}

## 🚨 Problems Encountered

### Problem 1: [Description]
**Issue:** Detailed description of what went wrong
**Impact:** How much time was lost, what broke
**Root Cause:** Why this happened

**Prevention Rule:**
❌ DON'T [what not to do] → [what to do instead]

---

### Problem 2: [Description]
**Issue:** Detailed description of what went wrong
**Impact:** How much time was lost, what broke
**Root Cause:** Why this happened

**Prevention Rule:**
❌ DON'T [what not to do] → [what to do instead]

---

## 📚 Key Learnings for Future Tasks
1. Learning 1
2. Learning 2
3. Learning 3

## 🔄 Process Improvements
- Process improvement 1
- Process improvement 2

---
*Note: Add prevention rules in the format "❌ DON'T [problem] → [solution]" for automatic Copilot integration*
`;

        // Write template files
        const fs = require('fs-extra');
        await fs.writeFile(path.join(templatesPath, 'description.md'), descriptionTemplate);
        await fs.writeFile(path.join(templatesPath, 'completion.md'), completionTemplate);
        await fs.writeFile(path.join(templatesPath, 'difficulties.md'), difficultiesTemplate);

        // Create .gitignore for FORGE
        const gitignorePath = path.join(workspaceRoot, '.forge', '.gitignore');
        const gitignoreContent = `# FORGE Framework - Local files
cache/
temp/
*.log
*.tmp

# Keep these files in version control
!config.yml
!templates/
!prevention-rules.json
`;
        await fs.writeFile(gitignorePath, gitignoreContent);
    }

    private async createInitialCopilotInstructions(config: ForgeConfig): Promise<void> {
        const languageList = config.project.language.join(', ');
        const frameworkList = config.project.framework.join(', ');

        const initialInstructions = `# FORGE Framework Instructions for GitHub Copilot

You are working with FORGE Framework. This project accumulates learning from development tasks.

## Project Context
- **Project**: ${config.project.name}
- **Languages**: ${languageList || 'Not detected'}
- **Frameworks**: ${frameworkList || 'Not detected'}
- **Description**: ${config.project.description}

## What is FORGE?
FORGE (Focus, Organize, Record, Grow, Evolve) is a methodology for accumulating AI knowledge. Each task generates prevention rules that improve future development.

## When user says "Create FORGE task [NAME]":
1. Analyze if the task is atomic (≤3 hours estimated)
2. If not atomic, suggest breaking it down
3. Apply any existing prevention rules relevant to the task
4. Create the task structure with appropriate templates

## Task Structure:
\`\`\`
tasks/
├── TASK_XX_TASK_NAME/
│   ├── description.md    # What to build
│   ├── completion.md     # What was built  
│   ├── difficulties.md  # Problems → Prevention rules
│   └── artifacts/        # Generated code/files
\`\`\`

## Prevention Rules:
*No prevention rules yet. They will be automatically added as tasks are completed and difficulties are documented.*

## Code Generation Guidelines:
- Follow project's language and framework conventions
- Include proper error handling
- Add input validation where appropriate
- Use environment variables for configuration
- Include type hints/annotations where applicable
- Add appropriate logging
- Consider security implications

---
*This context is automatically updated by FORGE Framework*
*Initialized: ${new Date().toISOString()}*
`;

        await this.fileManager.writeCopilotInstructions(initialInstructions);
    }
}
