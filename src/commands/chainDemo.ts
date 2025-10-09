import * as vscode from 'vscode';
import { EnhancedChainExecutor } from '../core/langchain/chainExecutor';

/**
 * Demo command to showcase CappyChain with internal tools
 * Following Python LangChain pattern
 */
export async function executeCappyChainDemo(context: vscode.ExtensionContext): Promise<void> {
    try {
        vscode.window.showInformationMessage('🔗 Starting CappyChain Demo...');

        // Demo 1: Tool registration demonstration
        console.log('=== Demo 1: Tool Registration Pattern ===');
        const demoExecutor = EnhancedChainExecutor.fromTemplate('demo_tool_registration');
        await demoExecutor.execute('Demonstrating internal tool registration');

        // Demo 2: File creation workflow
        console.log('=== Demo 2: File Creation Workflow ===');
        const fileExecutor = EnhancedChainExecutor.createFileCreationExecutor();
        fileExecutor.setVariables({
            filePath: 'demo_cappy_output.txt',
            fileContent: `# CappyChain Demo Output

Generated at: ${new Date().toISOString()}

This file was created using CappyChain's internal tool system, 
following the Python LangChain pattern where tools are registered 
within chains as methods.

## Features Demonstrated:
- Internal tool registration
- Variable management
- File creation
- Logging system
- Notification system

## Available Tools:
${demoExecutor.getAvailableTools().join(', ')}
`
        });
        await fileExecutor.execute('Creating demo file with enhanced chain');

        // Demo 3: Task workflow
        console.log('=== Demo 3: Task Workflow ===');
        const taskExecutor = EnhancedChainExecutor.createTaskWorkflowExecutor();
        await taskExecutor.execute('Running Cappy task workflow');

        // Demo 4: Variable management
        console.log('=== Demo 4: Variable Management ===');
        const variableExecutor = EnhancedChainExecutor.fromTemplate('enhanced_variable_management');
        variableExecutor.setVariables({
            currentTimestamp: new Date().toISOString(),
            inputUserName: 'CappyChain User'
        });
        await variableExecutor.execute('Demonstrating variable management');

        // Demo 5: Mixed LLM and tools
        console.log('=== Demo 5: Mixed LLM and Tools ===');
        const mixedExecutor = EnhancedChainExecutor.fromTemplate('enhanced_mixed_llm_tool');
        mixedExecutor.setVariables({
            actionRequired: 'false',
            suggestedCommand: 'workbench.action.showCommands',
            suggestedArgs: []
        });
        await mixedExecutor.execute('Analyze this demo request and determine actions');

        // Show completion summary
        const availableTemplates = EnhancedChainExecutor.listTemplates();
        const summary = `
✅ CappyChain Demo Completed Successfully!

📋 Templates Available: ${availableTemplates.length}
📝 Templates: ${availableTemplates.join(', ')}

🛠️ Built-in Tools Demonstrated:
- create_file: File creation with content
- read_file: Read file content
- execute_command: Execute VS Code commands
- create_task: Create Cappy tasks
- work_on_task: Work on current task
- show_notification: Display notifications
- set_variable: Manage context variables
- log_message: Console logging

🔗 Pattern: Python LangChain-style tool registration
📦 Architecture: Internal tools as methods within chains
🚀 Ready for production use!
        `;

        vscode.window.showInformationMessage('CappyChain Demo completed! Check console for details.');
        console.log(summary);

        // Open output file if created
        try {
            const outputPath = vscode.Uri.file('demo_cappy_output.txt');
            await vscode.window.showTextDocument(outputPath);
        } catch (e) {
            console.log('Output file not found, continuing...');
        }

    } catch (error: any) {
        console.error('CappyChain Demo failed:', error);
        vscode.window.showErrorMessage(`CappyChain Demo failed: ${error.message}`);
    }
}

/**
 * Quick tool demo specifically for internal tool registration
 */
export async function executeQuickToolDemo(): Promise<void> {
    await EnhancedChainExecutor.executeToolDemo();
}

/**
 * List available chain templates
 */
export async function listChainTemplates(): Promise<void> {
    try {
        const templates = EnhancedChainExecutor.listTemplates();
        const templateList = templates.map((id: string) => `• ${id}`).join('\\n');
        
        const message = `Available CappyChain Templates (${templates.length}):

${templateList}

These templates demonstrate internal tool registration following the Python LangChain pattern.`;

        vscode.window.showInformationMessage(message, { modal: true });
        console.log('CappyChain Templates:', templates);
        
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to list templates: ${error.message}`);
    }
}

/**
 * Execute a specific template by ID
 */
export async function executeChainTemplate(): Promise<void> {
    try {
        const templates = EnhancedChainExecutor.listTemplates();
        const selected = await vscode.window.showQuickPick(templates, {
            placeHolder: 'Select a CappyChain template to execute'
        });

        if (!selected) {
            return;
        }

        vscode.window.showInformationMessage(`Executing template: ${selected}`);
        
        const executor = EnhancedChainExecutor.fromTemplate(selected);
        const result = await executor.execute(`User requested execution of template: ${selected}`);
        
        console.log(`Template ${selected} executed successfully:`, result);
        vscode.window.showInformationMessage(`Template ${selected} completed successfully!`);
        
    } catch (error: any) {
        console.error('Template execution failed:', error);
        vscode.window.showErrorMessage(`Template execution failed: ${error.message}`);
    }
}