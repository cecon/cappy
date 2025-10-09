import * as vscode from 'vscode';
import { ChainContext, ChainDefinition, ChainNode, ChainStep, ChainTool, LLMChainNode, ToolChainNode, ConditionChainNode, TransformChainNode, ParallelChainNode, ChainToolNode } from './types';

export class CappyChain {
    private context: ChainContext;
    private definition: ChainDefinition;
    private nodes: Map<string, ChainNode>;
    private executed: Set<string> = new Set();

    constructor(definition: ChainDefinition, initialContext: Partial<ChainContext> = {}) {
        this.definition = definition;
        this.nodes = new Map(definition.nodes.map(node => [node.id, node]));
        
        // Initialize context
        this.context = {
            workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            variables: { ...definition.variables, ...initialContext.variables },
            history: [],
            tools: new Map(),
            ...initialContext
        };

        // Register tools from definition
        if (definition.tools) {
            for (const tool of definition.tools) {
                this.context.tools.set(tool.name, tool);
            }
        }
    }

    async execute(input?: any): Promise<any> {
        console.log(`🔗 Starting CappyChain: ${this.definition.name}`);
        
        try {
            const result = await this.executeNode(this.definition.startNode, input);
            console.log(`✅ CappyChain completed: ${this.definition.name}`);
            return result;
        } catch (error) {
            console.error(`❌ CappyChain failed: ${this.definition.name}`, error);
            throw error;
        }
    }

    private async executeNode(nodeId: string, input: any): Promise<any> {
        if (this.executed.has(nodeId)) {
            console.warn(`⚠️ Node ${nodeId} already executed, skipping`);
            return this.context.variables[`${nodeId}_result`];
        }

        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found in chain`);
        }

        console.log(`🔄 Executing node: ${node.name} (${node.type})`);
        const startTime = Date.now();

        // Check dependencies
        for (const depId of node.dependencies) {
            if (!this.executed.has(depId)) {
                await this.executeNode(depId, input);
            }
        }

        try {
            const result = await node.execute(this.context, input);
            const duration = Date.now() - startTime;

            // Record step in history
            const step: ChainStep = {
                id: nodeId,
                type: node.type,
                name: node.name,
                input,
                output: result,
                timestamp: startTime,
                duration
            };
            this.context.history.push(step);

            // Store result in context
            this.context.variables[`${nodeId}_result`] = result;
            this.executed.add(nodeId);

            console.log(`✅ Node completed: ${node.name} (${duration}ms)`);
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            
            const step: ChainStep = {
                id: nodeId,
                type: node.type,
                name: node.name,
                input,
                timestamp: startTime,
                duration,
                error: error?.toString()
            };
            this.context.history.push(step);

            console.error(`❌ Node failed: ${node.name}`, error);
            throw error;
        }
    }

    getContext(): ChainContext {
        return { ...this.context };
    }

    getHistory(): ChainStep[] {
        return [...this.context.history];
    }

    setVariable(key: string, value: any): void {
        this.context.variables[key] = value;
    }

    getVariable(key: string): any {
        return this.context.variables[key];
    }

    // Register a tool in the chain
    registerTool(tool: ChainTool): void {
        this.context.tools.set(tool.name, tool);
    }

    // Get available tools
    getTools(): ChainTool[] {
        return Array.from(this.context.tools.values());
    }

    // Execute a tool by name
    async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
        const tool = this.context.tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found in chain`);
        }
        return await tool.execute(args, this.context);
    }
}

// Factory functions for creating chain nodes
export class ChainNodeFactory {
    
    static createLLMNode(
        id: string, 
        name: string, 
        config: LLMChainNode['config'], 
        dependencies: string[] = []
    ): LLMChainNode {
        return {
            id,
            name,
            type: 'llm',
            config,
            dependencies,
            async execute(context: ChainContext, input: any): Promise<any> {
                // Use VS Code Language Model API
                if (vscode.lm && typeof vscode.lm.selectChatModels === 'function') {
                    try {
                        const models = await vscode.lm.selectChatModels();
                        const selectedModel = models.find(m => m.id === config.model) || models[0];
                        
                        if (!selectedModel) {
                            throw new Error('No language model available');
                        }

                        // Build prompt with context variables
                        let prompt = config.prompt;
                        for (const [key, value] of Object.entries(context.variables)) {
                            prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
                        }

                        // Add input to prompt
                        if (input) {
                            prompt = prompt.replace(/\{\{input\}\}/g, String(input));
                        }

                        // Add tools information if available
                        let systemMessage = config.systemMessage || '';
                        if (config.tools && config.tools.length > 0) {
                            const availableTools = config.tools.map(toolName => {
                                const tool = context.tools.get(toolName);
                                if (tool) {
                                    return `- ${tool.name}: ${tool.description}`;
                                }
                                return `- ${toolName}: Tool not found`;
                            }).join('\n');
                            
                            systemMessage += `\n\nAvailable tools:\n${availableTools}\n\nTo use a tool, respond with JSON: {"tool": "toolName", "args": {"param": "value"}}`;
                        }

                        const messages = [
                            ...(systemMessage ? [vscode.LanguageModelChatMessage.User(systemMessage)] : []),
                            vscode.LanguageModelChatMessage.User(prompt)
                        ];

                        const response = await selectedModel.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
                        
                        let fullResponse = '';
                        for await (const fragment of response.text) {
                            fullResponse += fragment;
                        }

                        // Check if response is a tool call
                        if (config.tools && config.tools.length > 0) {
                            try {
                                const toolCall = JSON.parse(fullResponse.trim());
                                if (toolCall.tool && context.tools.has(toolCall.tool)) {
                                    const tool = context.tools.get(toolCall.tool)!;
                                    const toolResult = await tool.execute(toolCall.args || {}, context);
                                    return {
                                        type: 'tool_call',
                                        toolName: toolCall.tool,
                                        args: toolCall.args,
                                        result: toolResult
                                    };
                                }
                            } catch (e) {
                                // Not a tool call, return as regular response
                            }
                        }

                        return fullResponse.trim();

                    } catch (error) {
                        throw new Error(`LLM execution failed: ${error}`);
                    }
                } else {
                    throw new Error('VS Code Language Model API not available');
                }
            }
        };
    }

    static createToolNode(
        id: string,
        name: string,
        config: ToolChainNode['config'],
        dependencies: string[] = []
    ): ToolChainNode {
        return {
            id,
            name,
            type: 'tool',
            config,
            dependencies,
            async execute(context: ChainContext, input: any): Promise<any> {
                // Execute VS Code command or Cappy tool
                try {
                    const parameters = { ...config.parameters };
                    
                    // Replace variables in parameters
                    for (const [key, value] of Object.entries(parameters)) {
                        if (typeof value === 'string') {
                            let newValue = value;
                            for (const [varKey, varValue] of Object.entries(context.variables)) {
                                newValue = newValue.replace(new RegExp(`\\{\\{${varKey}\\}\\}`, 'g'), String(varValue));
                            }
                            parameters[key] = newValue;
                        }
                    }

                    // Add input to parameters if specified
                    if (input && !parameters.input) {
                        parameters.input = input;
                    }

                    const result = await vscode.commands.executeCommand(config.toolName, parameters);
                    return result;

                } catch (error) {
                    throw new Error(`Tool execution failed: ${error}`);
                }
            }
        };
    }

    static createConditionNode(
        id: string,
        name: string,
        config: ConditionChainNode['config'],
        dependencies: string[] = []
    ): ConditionChainNode {
        return {
            id,
            name,
            type: 'condition',
            config,
            dependencies,
            async execute(context: ChainContext, input: any): Promise<any> {
                // Evaluate condition
                let condition = config.condition;
                
                // Replace variables
                for (const [key, value] of Object.entries(context.variables)) {
                    condition = condition.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
                }

                // Replace input
                if (input) {
                    condition = condition.replace(/\{\{input\}\}/g, String(input));
                }

                // Simple condition evaluation (could be enhanced)
                const isTrue = ChainNodeFactory.evaluateCondition(condition);
                const nextNodeId = isTrue ? config.truePath : config.falsePath;
                
                // Return which path was chosen
                return {
                    conditionResult: isTrue,
                    nextNode: nextNodeId,
                    evaluatedCondition: condition
                };
            }
        };
    }

    static evaluateCondition(condition: string): boolean {
        try {
            // Simple evaluation - could be enhanced with a proper expression parser
            // For now, support basic comparisons
            const comparisons = [
                { regex: /(.+)\s*===\s*(.+)/, op: (a: any, b: any) => a === b },
                { regex: /(.+)\s*!==\s*(.+)/, op: (a: any, b: any) => a !== b },
                { regex: /(.+)\s*>\s*(.+)/, op: (a: any, b: any) => Number(a) > Number(b) },
                { regex: /(.+)\s*<\s*(.+)/, op: (a: any, b: any) => Number(a) < Number(b) },
                { regex: /(.+)\s*contains\s*(.+)/, op: (a: any, b: any) => String(a).includes(String(b)) }
            ];

            for (const comp of comparisons) {
                const match = condition.match(comp.regex);
                if (match) {
                    const left = match[1].trim().replace(/['"]/g, '');
                    const right = match[2].trim().replace(/['"]/g, '');
                    return comp.op(left, right);
                }
            }

            // Fallback: check if condition is truthy
            return Boolean(condition && condition !== 'false' && condition !== '0');

        } catch (error) {
            console.warn('Condition evaluation failed, defaulting to false:', error);
            return false;
        }
    }

    static createTransformNode(
        id: string,
        name: string,
        config: TransformChainNode['config'],
        dependencies: string[] = []
    ): TransformChainNode {
        return {
            id,
            name,
            type: 'transform',
            config,
            dependencies,
            async execute(context: ChainContext, input: any): Promise<any> {
                // Apply transformation
                switch (config.transformer) {
                    case 'extract_code':
                        return ChainNodeFactory.extractCode(input);
                    case 'extract_json':
                        return ChainNodeFactory.extractJSON(input);
                    case 'split_lines':
                        return String(input).split('\n');
                    case 'join_lines':
                        return Array.isArray(input) ? input.join('\n') : input;
                    case 'uppercase':
                        return String(input).toUpperCase();
                    case 'lowercase':
                        return String(input).toLowerCase();
                    case 'trim':
                        return String(input).trim();
                    case 'length':
                        return String(input).length;
                    default:
                        throw new Error(`Unknown transformer: ${config.transformer}`);
                }
            }
        };
    }

    static extractCode(text: string): string[] {
        const codeBlocks: string[] = [];
        const regex = /```(?:\w+)?\n([\s\S]*?)```/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            codeBlocks.push(match[1].trim());
        }
        
        return codeBlocks;
    }

    static extractJSON(text: string): any {
        try {
            const jsonRegex = /\{[\s\S]*\}/;
            const match = text.match(jsonRegex);
            if (match) {
                return JSON.parse(match[0]);
            }
            return JSON.parse(text);
        } catch (error) {
            throw new Error(`Failed to extract JSON: ${error}`);
        }
    }

    static createChainToolNode(
        id: string,
        name: string,
        config: {
            toolName: string;
            parameters: Record<string, any>;
        },
        dependencies: string[] = []
    ): ChainToolNode {
        return {
            id,
            name,
            type: 'chain_tool',
            config,
            dependencies,
            async execute(context: ChainContext, input: any): Promise<any> {
                const tool = context.tools.get(config.toolName);
                if (!tool) {
                    throw new Error(`Chain tool '${config.toolName}' not found in context`);
                }

                try {
                    // Prepare arguments from input and config
                    const args = { ...config.parameters };
                    
                    // If input is an object, merge it with args
                    if (typeof input === 'object' && input !== null) {
                        Object.assign(args, input);
                    } else if (input !== undefined) {
                        // If input is a primitive, assign it to a default parameter
                        args.input = input;
                    }

                    const result = await tool.execute(args, context);
                    
                    return result;
                } catch (error: any) {
                    throw new Error(`Chain tool '${config.toolName}' execution failed: ${error.message}`);
                }
            }
        };
    }
}