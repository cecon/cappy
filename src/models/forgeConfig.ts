export interface ForgeConfig {
    version: string;
    project: {
        name: string;
        language: string[];
        framework: string[];
        description?: string;
        stackInstructions?: string; // Path to stack-specific instructions file
    };
    stack: {
        primary: string; // e.g., 'typescript', 'python', 'rust', 'java'
        secondary: string[]; // e.g., ['react', 'express', 'postgres']
        patterns: string[]; // e.g., ['mvc', 'rest-api', 'microservices']
        conventions: {
            codeStyle: string[]; // e.g., ['eslint', 'prettier', 'airbnb']
            testing: string[]; // e.g., ['jest', 'cypress', 'tdd']
            architecture: string[]; // e.g., ['clean-architecture', 'ddd']
        };
    };
    environment: {
        os: 'windows' | 'macos' | 'linux';
        shell: 'powershell' | 'bash' | 'zsh' | 'cmd' | 'fish';
        editor: 'vscode' | 'cursor' | 'other';
        packageManager: string; // 'npm', 'yarn', 'pnpm', 'pip', 'cargo', etc.
        containerization: 'docker' | 'podman' | 'none';
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
        requireUnitTests: boolean;
        testFramework: string;
        testCoverage: number;
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
    stack: {
        primary: 'typescript',
        secondary: ['node', 'express'],
        patterns: ['rest-api'],
        conventions: {
            codeStyle: ['eslint', 'prettier'],
            testing: ['jest'],
            architecture: ['clean-architecture']
        }
    },
    environment: {
        os: 'windows',
        shell: 'powershell',
        editor: 'vscode',
        packageManager: 'npm',
        containerization: 'docker'
    },
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
        atomicityWarning: true,
        requireUnitTests: false,
        testFramework: 'jest',
        testCoverage: 80
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
