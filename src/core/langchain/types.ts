// CappyChain - LangChain-like implementation for VS Code
export interface ChainContext {
    workspace: string;
    currentFile?: string;
    selection?: string;
    activeTask?: any;
    variables: Record<string, any>;
    history: ChainStep[];
    tools: Map<string, ChainTool>;
}

export interface ChainTool {
    name: string;
    description: string;
    parameters: Record<string, any>;
    execute(args: Record<string, any>, context: ChainContext): Promise<any>;
}

export interface ChainStep {
    id: string;
    type: 'llm' | 'tool' | 'condition' | 'transform' | 'parallel' | 'chain_tool';
    name: string;
    input: any;
    output?: any;
    timestamp: number;
    duration?: number;
    error?: string;
}

export interface ChainNode {
    id: string;
    type: 'llm' | 'tool' | 'condition' | 'transform' | 'parallel' | 'chain_tool';
    name: string;
    config: any;
    dependencies: string[];
    execute(context: ChainContext, input: any): Promise<any>;
}

export interface ChainDefinition {
    id: string;
    name: string;
    description: string;
    nodes: ChainNode[];
    startNode: string;
    variables?: Record<string, any>;
    tools?: ChainTool[];
}

export interface LLMChainNode extends ChainNode {
    type: 'llm';
    config: {
        model: string;
        prompt: string;
        temperature?: number;
        maxTokens?: number;
        systemMessage?: string;
        tools?: string[]; // Lista de tools disponíveis para o LLM
    };
}

export interface ChainToolNode extends ChainNode {
    type: 'chain_tool';
    config: {
        toolName: string;
        parameters: Record<string, any>;
    };
}

export interface ToolChainNode extends ChainNode {
    type: 'tool';
    config: {
        toolName: string;
        parameters: Record<string, any>;
    };
}

export interface ConditionChainNode extends ChainNode {
    type: 'condition';
    config: {
        condition: string;
        truePath: string;
        falsePath: string;
    };
}

export interface TransformChainNode extends ChainNode {
    type: 'transform';
    config: {
        transformer: string;
        parameters?: Record<string, any>;
    };
}

export interface ParallelChainNode extends ChainNode {
    type: 'parallel';
    config: {
        branches: string[];
        waitForAll?: boolean;
        combineResults?: string;
    };
}