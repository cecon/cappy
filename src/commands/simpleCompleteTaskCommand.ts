import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);
const readdir = promisify(fs.readdir);

export class SimpleCompleteTaskCommand {
    static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.commands.registerCommand('forge.completeTask', async () => {
            try {
                const workspaceRoot = SimpleCompleteTaskCommand.getWorkspaceRoot();
                const tasksDir = path.join(workspaceRoot, 'tasks');
                
                // Check if tasks directory exists
                if (!await exists(tasksDir)) {
                    vscode.window.showErrorMessage('⚠️ No tasks directory found. Create a task first.');
                    return;
                }
                
                // Get available tasks
                const tasks = await SimpleCompleteTaskCommand.getIncompleteTasks(tasksDir);
                
                if (tasks.length === 0) {
                    vscode.window.showInformationMessage('🎉 No incomplete tasks found!');
                    return;
                }
                
                // Let user select task to complete
                const selectedTask = await vscode.window.showQuickPick(
                    tasks.map(task => ({
                        label: task.name,
                        description: task.path,
                        detail: `Step ${task.stepNumber}`
                    })),
                    {
                        placeHolder: 'Select task to mark as complete'
                    }
                );
                
                if (!selectedTask) {
                    return;
                }
                
                const taskPath = selectedTask.description!;
                
                // Mark task as completed
                await SimpleCompleteTaskCommand.markTaskAsCompleted(taskPath);
                
                vscode.window.showInformationMessage(`✅ Task "${selectedTask.label}" marked as completed!`);
                
                // Ask if user wants to add lessons learned
                const addLessons = await vscode.window.showQuickPick([
                    'Yes - Add lessons learned',
                    'No - Just mark as complete'
                ], {
                    placeHolder: 'Did you encounter any issues or learn something?'
                });
                
                if (addLessons?.startsWith('Yes')) {
                    const difficultiesFile = path.join(taskPath, `${path.basename(taskPath).split('_').slice(0, 2).join('_')}_DIFFICULTIES_FACED.md`);
                    if (await exists(difficultiesFile)) {
                        const doc = await vscode.workspace.openTextDocument(difficultiesFile);
                        await vscode.window.showTextDocument(doc);
                    }
                }
                
            } catch (error) {
                vscode.window.showErrorMessage(`🔨 Complete Task Error: ${error}`);
                console.error('FORGE Complete Task Error:', error);
            }
        });
    }
    
    private static async getIncompleteTasks(tasksDir: string): Promise<any[]> {
        try {
            const items = await readdir(tasksDir);
            const stepDirs = items.filter(item => item.startsWith('STEP_'));
            const tasks = [];
            
            for (const stepDir of stepDirs) {
                const stepPath = path.join(tasksDir, stepDir);
                const completedFile = path.join(stepPath, 'COMPLETED.md');
                
                // Check if task is not already completed
                if (!await exists(completedFile)) {
                    const stepMatch = stepDir.match(/STEP_(\d{4})_(.+)/);
                    if (stepMatch) {
                        tasks.push({
                            name: stepMatch[2].replace(/-/g, ' '),
                            stepNumber: stepMatch[1],
                            path: stepPath
                        });
                    }
                }
            }
            
            return tasks;
            
        } catch (error) {
            return [];
        }
    }
    
    private static async markTaskAsCompleted(taskPath: string): Promise<void> {
        const stepName = path.basename(taskPath);
        const stepMatch = stepName.match(/STEP_(\d{4})_(.+)/);
        
        if (!stepMatch) {
            throw new Error('Invalid task directory format');
        }
        
        const stepId = stepMatch[1];
        const taskName = stepMatch[2].replace(/-/g, ' ');
        
        const completedContent = `# ✅ STEP_${stepId} - COMPLETED

## Task Summary
**Task:** ${taskName}  
**Completed:** ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}  
**Status:** ✅ DONE

## Completion Checklist
- [x] All acceptance criteria met
- [x] Code implemented and tested
- [x] Documentation updated
- [x] No breaking changes
- [x] Quality gates passed

## Time Tracking
- **Estimated:** As defined in DESCRIPTION.md
- **Actual:** [Manual entry - update if needed]
- **Efficiency:** [Within/Over estimate]

## Deliverables
- Implementation completed
- Tests passing
- Documentation updated
- Prevention rules added (if applicable)

## Next Steps
*Note any follow-up tasks or related work that should be done next*

---
**Marked complete by:** FORGE Framework  
**Completion Method:** Manual via Command Palette`;

        await writeFile(path.join(taskPath, 'COMPLETED.md'), completedContent);
        
        // Update DONE.md to reflect completion
        const doneFile = path.join(taskPath, `STEP_${stepId}_DONE.md`);
        if (await exists(doneFile)) {
            let doneContent = await readFile(doneFile, 'utf8');
            doneContent = doneContent.replace(
                /\*\*Created:\*\* .*/,
                `**Created:** ${new Date().toLocaleDateString()}  \n**✅ COMPLETED:** ${new Date().toLocaleDateString()}`
            );
            await writeFile(doneFile, doneContent);
        }
    }
    
    private static getWorkspaceRoot(): string {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error("No workspace root found. Please open a folder first.");
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
}
