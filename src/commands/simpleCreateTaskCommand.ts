import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);
const readdir = promisify(fs.readdir);

export class SimpleCreateTaskCommand {
    static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.commands.registerCommand('forge.createTask', async () => {
            try {
                const workspaceRoot = SimpleCreateTaskCommand.getWorkspaceRoot();
                const forgeDir = path.join(workspaceRoot, '.forge');
                
                // Check if FORGE is initialized
                if (!await exists(forgeDir)) {
                    const initFirst = await vscode.window.showWarningMessage(
                        '⚠️ FORGE not initialized. Initialize first?',
                        'Initialize', 'Cancel'
                    );
                    if (initFirst === 'Initialize') {
                        await vscode.commands.executeCommand('forge.init');
                        return;
                    } else {
                        return;
                    }
                }
                
                // Get next step number
                const tasksDir = path.join(workspaceRoot, 'tasks');
                const stepNumber = await SimpleCreateTaskCommand.getNextStepNumber(tasksDir);
                
                // Get task details from user
                const taskName = await vscode.window.showInputBox({
                    prompt: 'Enter task name (short description)',
                    placeHolder: 'e.g., implement-user-authentication'
                });
                
                if (!taskName) {
                    return;
                }
                
                const taskDescription = await vscode.window.showInputBox({
                    prompt: 'Enter detailed task description',
                    placeHolder: 'What needs to be implemented? Include acceptance criteria.'
                });
                
                if (!taskDescription) {
                    return;
                }
                
                // Create task directory
                const stepDirName = `STEP_${stepNumber.toString().padStart(4, '0')}_${taskName.toLowerCase().replace(/\s+/g, '-')}`;
                const stepDir = path.join(tasksDir, stepDirName);
                
                await mkdir(stepDir, { recursive: true });
                await mkdir(path.join(stepDir, 'artifacts'), { recursive: true });
                
                // Create task files
                await SimpleCreateTaskCommand.createTaskFiles(stepDir, stepNumber, taskName, taskDescription);
                
                vscode.window.showInformationMessage(`🎯 Task ${stepDirName} created successfully!`);
                
                // Open description file
                const descriptionFile = path.join(stepDir, `STEP_${stepNumber.toString().padStart(4, '0')}_DESCRIPTION.md`);
                const doc = await vscode.workspace.openTextDocument(descriptionFile);
                await vscode.window.showTextDocument(doc);
                
            } catch (error) {
                vscode.window.showErrorMessage(`🔨 Create Task Error: ${error}`);
                console.error('FORGE Create Task Error:', error);
            }
        });
    }
    
    private static async getNextStepNumber(tasksDir: string): Promise<number> {
        try {
            if (!await exists(tasksDir)) {
                await mkdir(tasksDir, { recursive: true });
                return 1;
            }
            
            const items = await readdir(tasksDir);
            const stepDirs = items.filter(item => item.startsWith('STEP_'));
            
            if (stepDirs.length === 0) {
                return 1;
            }
            
            const stepNumbers = stepDirs.map(dir => {
                const match = dir.match(/STEP_(\d{4})/);
                return match ? parseInt(match[1], 10) : 0;
            });
            
            return Math.max(...stepNumbers) + 1;
            
        } catch (error) {
            return 1;
        }
    }
    
    private static async createTaskFiles(stepDir: string, stepNumber: number, taskName: string, taskDescription: string): Promise<void> {
        const stepId = stepNumber.toString().padStart(4, '0');
        
        // Description file
        const descriptionContent = `# STEP_${stepId}: ${taskName}

## 📋 Task Description
${taskDescription}

## 🎯 Acceptance Criteria
- [ ] Define specific acceptance criteria here
- [ ] What constitutes "done" for this task?
- [ ] Include any technical requirements

## ⏱️ Time Estimation
- **Estimated:** 2-3 hours
- **Atomicity Check:** ✅ Task should be completable in ≤3 hours

## 🔗 Dependencies
- List any dependencies on other tasks
- External libraries or tools needed
- Prerequisites that must be completed first

## 📝 Implementation Notes
*Add implementation details, approaches, or considerations here*

## 🧪 Testing Strategy
- Unit tests required?
- Integration testing approach
- Manual testing checklist

---
**Created:** ${new Date().toLocaleDateString()}  
**Status:** 🟡 Planning  
**Next Step:** Define implementation approach`;

        await writeFile(
            path.join(stepDir, `STEP_${stepId}_DESCRIPTION.md`), 
            descriptionContent
        );
        
        // Done criteria file
        const doneContent = `# STEP_${stepId} - Completion Criteria

## ✅ Definition of Done

### Core Requirements
- [ ] All acceptance criteria from DESCRIPTION.md are met
- [ ] Code is implemented and tested
- [ ] Documentation is updated
- [ ] No breaking changes introduced

### Quality Gates
- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Code follows project standards
- [ ] Performance is acceptable

### Knowledge Capture
- [ ] Any issues encountered are documented in DIFFICULTIES_FACED.md
- [ ] Prevention rules added if applicable
- [ ] Implementation notes updated

## 🎉 Mark as Complete
When all criteria above are met, mark this task as complete using:
\`FORGE: Complete Task\`

---
**Task:** ${taskName}  
**Created:** ${new Date().toLocaleDateString()}`;

        await writeFile(
            path.join(stepDir, `STEP_${stepId}_DONE.md`), 
            doneContent
        );
        
        // Difficulties template
        const difficultiesContent = `# STEP_${stepId} - Difficulties Faced

*Document any problems, errors, or challenges encountered during implementation*

## 🚫 Issues Encountered

### Issue #1: [Issue Title]
- **Problem:** Describe what went wrong
- **Context:** When/where it happened
- **Solution:** How it was resolved
- **Prevention:** How to avoid this in the future

### Issue #2: [Add more as needed]
- **Problem:** 
- **Context:** 
- **Solution:** 
- **Prevention:** 

## 🧠 Lessons Learned
- Key insights from this task
- Better approaches discovered
- Things to remember for future tasks

## 🛡️ Prevention Rules Generated
*Rules that should be added to prevention-rules.md:*

1. **Rule Name:** Brief description
   - **Context:** When this applies
   - **Action:** What to do/avoid

---
**Task:** ${taskName}  
**Date:** ${new Date().toLocaleDateString()}`;

        await writeFile(
            path.join(stepDir, `STEP_${stepId}_DIFFICULTIES_FACED.md`), 
            difficultiesContent
        );
    }
    
    private static getWorkspaceRoot(): string {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error("No workspace root found. Please open a folder first.");
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
}
