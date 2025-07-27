export interface ForgeConfig {
    version: string;
    project: {
        name: string;
        language: string[];
        framework: string[];
        description?: string;
    };
    context: {
        maxRules: number;
        autoPrioritize: boolean;
        languageSpecific: boolean;
        projectPatterns: boolean;
        autoUpdateCopilot: boolean;
    };
    tasks: {
        maxAtomicHours: number;
        defaultTemplate: string;
        autoTimeEstimation: boolean;
        atomicityWarning: boolean;
    };
    ai: {
        provider: 'copilot' | 'claude' | 'chatgpt' | 'custom';
        copilotIntegration: boolean;
        contextFile: string;
        maxContextSize: number;
    };
    analytics: {
        enabled: boolean;
        trackTime: boolean;
        trackEffectiveness: boolean;
    };
    createdAt: Date;
    lastUpdated: Date;
}

export const DEFAULT_FORGE_CONFIG: Partial<ForgeConfig> = {
    version: '1.0.0',
    context: {
        maxRules: 50,
        autoPrioritize: true,
        languageSpecific: true,
        projectPatterns: true,
        autoUpdateCopilot: true
    },
    tasks: {
        maxAtomicHours: 3,
        defaultTemplate: 'standard',
        autoTimeEstimation: true,
        atomicityWarning: true
    },
    ai: {
        provider: 'copilot',
        copilotIntegration: true,
        contextFile: '.vscode/copilot-instructions.md',
        maxContextSize: 8000
    },
    analytics: {
        enabled: true,
        trackTime: true,
        trackEffectiveness: true
    }
};
