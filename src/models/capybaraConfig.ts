export interface CapybaraConfig {
    version: string;
    instructionsVersion: string; // Versão dos arquivos de instruções
    project: {
        name: string;
        language: string[];
        framework: string[];
        description?: string;
        stackInstructions?: string; // Path to stack-specific instructions file
        currentPhase?: string; // Current development phase for macro context
        architectureNotes?: string; // High-level architecture overview
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
        currentTask?: string; // Current active task (e.g., "task_0001")
        nextTaskNumber: number; // Next sequential task number
        workflowMode: 'single-focus' | 'multi-task'; // New workflow mode
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

export const DEFAULT_CAPYBARA_CONFIG: Partial<CapybaraConfig> = {
    version: '1.0.0',
    instructionsVersion: '2.0.0', // Nova versão com scripts LLM
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
        maxRules: 15, // Reduced for solo dev - focus on what matters
        autoPrioritize: true,
        languageSpecific: true,
        projectPatterns: true,
        autoUpdateCopilot: true
    },
    tasks: {
        maxAtomicHours: 2, // Smaller chunks for solo velocity
        defaultTemplate: 'lightweight',
        autoTimeEstimation: true,
        atomicityWarning: true,
        requireUnitTests: false,
        testFramework: 'jest',
        testCoverage: 80,
        nextTaskNumber: 1, // Sequential task numbering
        workflowMode: 'single-focus' // New focused workflow
    },
    ai: {
        provider: 'copilot',
        copilotIntegration: true,
        contextFile: '.github/copilot-instructions.md', // Private instructions in .gitignore
        maxContextSize: 4000 // Smaller context to avoid Copilot ignoring
    },
    analytics: {
        enabled: true,
        trackTime: true,
        trackEffectiveness: true
    }
};
