export interface PreventionRule {
    id: string;
    problem: string;
    solution: string;
    category: PreventionRuleCategory;
    language?: string[];
    framework?: string[];
    timeSaved: number;
    confidence: number;
    sourceTask: string;
    createdAt: Date;
    appliedCount: number;
    effectiveness: number;
    tags: string[];
}

export enum PreventionRuleCategory {
    DATABASE = 'database',
    SECURITY = 'security',
    PERFORMANCE = 'performance',
    TESTING = 'testing',
    DEPLOYMENT = 'deployment',
    VALIDATION = 'validation',
    ERROR_HANDLING = 'error-handling',
    CONFIGURATION = 'configuration',
    ARCHITECTURE = 'architecture',
    OTHER = 'other'
}

export interface PreventionRuleTemplate {
    problem: string;
    solution: string;
    category: PreventionRuleCategory;
    languages: string[];
    frameworks: string[];
    estimatedTimeSaved: number;
    confidence: number;
}

export interface PreventionRuleStats {
    totalRules: number;
    rulesByCategory: Record<PreventionRuleCategory, number>;
    totalTimeSaved: number;
    averageEffectiveness: number;
    mostEffectiveRules: PreventionRule[];
}
