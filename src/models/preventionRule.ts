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
    database = 'database',
    security = 'security',
    performance = 'performance',
    testing = 'testing',
    deployment = 'deployment',
    validation = 'validation',
    errorHandling = 'error-handling',
    configuration = 'configuration',
    architecture = 'architecture',
    other = 'other'
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
