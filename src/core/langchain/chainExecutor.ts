import * as vscode from 'vscode';
import { ChainDefinition, ChainContext, ChainStep } from './types';
import { CappyChain } from './cappyChain';
import { CappyChainTools } from './chainTools';

/**
 * Enhanced chain executor with internal tool support
 * Following Python LangChain pattern with registered tools
 */
export class EnhancedChainExecutor {
    private chain: CappyChain;
    private context: ChainContext;

    constructor(definition: ChainDefinition) {
        this.context = {
            workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            variables: definition.variables || {},
            history: [],
            tools: new Map()
        };

        // Register tools from definition
        if (definition.tools) {
            for (const tool of definition.tools) {
                this.context.tools.set(tool.name, tool);
            }
        }

        // Also register common built-in tools
        CappyChainTools.registerAllTools(this.context);

        this.chain = new CappyChain(definition, this.context);
    }

    /**
     * Execute the chain with input and return final result
     */
    async execute(input: any): Promise<any> {
        try {
            console.log(`CappyChain Executor: Starting chain execution`);
            console.log(`Available tools: ${Array.from(this.context.tools.keys()).join(', ')}`);

            const result = await this.chain.execute(input);
            
            console.log(`CappyChain Executor: Chain completed successfully`);
            console.log(`Steps executed: ${this.context.history.length}`);
            
            return result;
        } catch (error: any) {
            console.error(`CappyChain Executor: Chain execution failed`, error);
            throw new Error(`Chain execution failed: ${error.message}`);
        }
    }

    /**
     * Get execution context (variables, steps, tools)
     */
    getContext(): ChainContext {
        return this.context;
    }

    /**
     * Get execution steps for debugging
     */
    getSteps(): ChainStep[] {
        return this.context.history;
    }

    /**
     * Get available tools
     */
    getAvailableTools(): string[] {
        return Array.from(this.context.tools.keys());
    }

    /**
     * Add a custom tool to the execution context
     */
    addTool(tool: any): void {
        this.context.tools.set(tool.name, tool);
        console.log(`CappyChain Executor: Added custom tool '${tool.name}'`);
    }

    /**
     * Set context variables before execution
     */
    setVariables(variables: Record<string, any>): void {
        Object.assign(this.context.variables, variables);
        console.log(`CappyChain Executor: Set variables`, Object.keys(variables));
    }

    /**
     * Get current context variables
     */
    getVariables(): Record<string, any> {
        return { ...this.context.variables };
    }

    /**
     * Execute a specific node by ID (useful for debugging)
     */
    async executeNode(nodeId: string, input: any): Promise<any> {
        // Access nodes through the definition
        const definition = (this.chain as any).definition;
        const node = definition.nodes.find((n: any) => n.id === nodeId);
        if (!node) {
            throw new Error(`Node '${nodeId}' not found in chain`);
        }

        try {
            console.log(`CappyChain Executor: Executing node '${nodeId}' (${node.name})`);
            const result = await node.execute(this.context, input);
            
            // Record step
            const step: ChainStep = {
                id: nodeId,
                type: node.type,
                name: node.name,
                input,
                output: result,
                timestamp: Date.now()
            };
            this.context.history.push(step);
            
            return result;
        } catch (error: any) {
            console.error(`CappyChain Executor: Node '${nodeId}' execution failed`, error);
            
            // Record error step
            const step: ChainStep = {
                id: nodeId,
                type: node.type,
                name: node.name,
                input,
                timestamp: Date.now(),
                error: error.message
            };
            this.context.history.push(step);
            
            throw error;
        }
    }

    /**
     * Create executor from enhanced template
     */
    static fromTemplate(templateId: string): EnhancedChainExecutor {
        // Import here to avoid circular dependency
        const { EnhancedChainTemplates: enhancedChainTemplates } = require('./enhancedChainTemplates');
        const template = enhancedChainTemplates.getEnhancedTemplate(templateId);
        
        if (!template) {
            throw new Error(`Template '${templateId}' not found`);
        }
        
        return new EnhancedChainExecutor(template);
    }

    /**
     * List available enhanced templates
     */
    static listTemplates(): string[] {
        // Import here to avoid circular dependency
        const { EnhancedChainTemplates: enhancedChainTemplates } = require('./enhancedChainTemplates');
        return enhancedChainTemplates.getAllEnhancedTemplates().map((t: any) => t.id);
    }

    /**
     * Create a simple file creation executor
     */
    static createFileCreationExecutor(): EnhancedChainExecutor {
        return EnhancedChainExecutor.fromTemplate('enhanced_file_creation');
    }

    /**
     * Create a Cappy task workflow executor
     */
    static createTaskWorkflowExecutor(): EnhancedChainExecutor {
        return EnhancedChainExecutor.fromTemplate('enhanced_task_workflow');
    }

    /**
     * Create a command execution executor
     */
    static createCommandExecutionExecutor(): EnhancedChainExecutor {
        return EnhancedChainExecutor.fromTemplate('enhanced_command_execution');
    }

    /**
     * Execute a quick tool demonstration
     */
    static async executeToolDemo(): Promise<void> {
        try {
            const executor = EnhancedChainExecutor.fromTemplate('demo_tool_registration');
            await executor.execute('Demonstrating internal tool registration');
            
            vscode.window.showInformationMessage('CappyChain tool demo completed successfully!');
        } catch (error: any) {
            console.error('Tool demo failed:', error);
            vscode.window.showErrorMessage(`Tool demo failed: ${error.message}`);
        }
    }
}

/**
 * Legacy chain executor (keeping for backward compatibility)
 */
export class ChainExecutor {
    private static instance: ChainExecutor;
    private activeChains: Map<string, CappyChain> = new Map();
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Cappy Chains');
    }

    static getInstance(): ChainExecutor {
        if (!ChainExecutor.instance) {
            ChainExecutor.instance = new ChainExecutor();
        }
        return ChainExecutor.instance;
    }

    /**
     * Execute a predefined chain template
     */
    async executeTemplate(templateId: string, input?: any, variables?: Record<string, any>): Promise<any> {
        // Try enhanced templates first
        try {
            const enhancedExecutor = EnhancedChainExecutor.fromTemplate(templateId);
            if (variables) {
                enhancedExecutor.setVariables(variables);
            }
            return await enhancedExecutor.execute(input);
        } catch (enhancedError) {
            // Fall back to legacy templates
            const { ChainTemplates: chainTemplates } = require('./chainTemplates');
            const template = chainTemplates.getTemplate?.(templateId);
            if (!template) {
                throw new Error(`Chain template not found: ${templateId}`);
            }

            return this.executeChain(template, input, variables);
        }
    }

    /**
     * Execute a custom chain definition
     */
    async executeChain(definition: ChainDefinition, input?: any, variables?: Record<string, any>): Promise<any> {
        const chainId = `${definition.id}-${Date.now()}`;
        
        try {
            // Create context with current VS Code state
            const context: ChainContext = {
                workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                variables: {
                    ...definition.variables,
                    ...variables,
                    currentFile: vscode.window.activeTextEditor?.document.fileName || '',
                    workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
                },
                history: [],
                tools: new Map()
            };

            // Register built-in tools
            CappyChainTools.registerAllTools(context);

            // Create and execute chain
            const chain = new CappyChain(definition, context);
            this.activeChains.set(chainId, chain);

            this.outputChannel.appendLine(`🔗 Starting chain: ${definition.name}`);
            this.outputChannel.show(true);

            const result = await chain.execute(input);

            this.outputChannel.appendLine(`✅ Chain completed: ${definition.name}`);
            this.outputChannel.appendLine(`📊 Steps executed: ${context.history.length}`);
            this.outputChannel.appendLine(`📄 Result: ${JSON.stringify(result, null, 2)}`);

            return {
                chainId,
                result,
                history: context.history,
                context: context
            };

        } catch (error) {
            this.outputChannel.appendLine(`❌ Chain failed: ${error}`);
            throw error;

        } finally {
            this.activeChains.delete(chainId);
        }
    }

    /**
     * Get available chain templates
     */
    getAvailableChains(): Array<{id: string, name: string, description: string}> {
        const enhancedTemplates = EnhancedChainExecutor.listTemplates().map(id => ({
            id,
            name: `Enhanced: ${id}`,
            description: `Enhanced chain template: ${id}`
        }));

        try {
            const { ChainTemplates: chainTemplates } = require('./chainTemplates');
            const legacyTemplates = chainTemplates.getAllTemplates?.()?.map?.((chain: any) => ({
                id: chain.id,
                name: chain.name,
                description: chain.description
            })) || [];

            return [...enhancedTemplates, ...legacyTemplates];
        } catch (error) {
            return enhancedTemplates;
        }
    }

    /**
     * Smart chain selection based on user input
     */
    selectChainForPrompt(prompt: string): string | null {
        const promptLower = prompt.toLowerCase();
        
        // Enhanced template mappings
        if (promptLower.includes('task') || promptLower.includes('workflow')) {
            return 'enhanced_task_workflow';
        }
        if (promptLower.includes('file') || promptLower.includes('create')) {
            return 'enhanced_file_creation';
        }
        if (promptLower.includes('command') || promptLower.includes('execute')) {
            return 'enhanced_command_execution';
        }
        if (promptLower.includes('variable') || promptLower.includes('context')) {
            return 'enhanced_variable_management';
        }
        if (promptLower.includes('demo') || promptLower.includes('tool')) {
            return 'demo_tool_registration';
        }
        
        return null;
    }
}