export interface Task {
    id: string;
    name: string;
    description: string;
    status: TaskStatus;
    estimatedHours: number;
    actualHours?: number;
    createdAt: Date;
    completedAt?: Date;
    path: string;
    artifacts: string[];
    difficulties: string[];
    preventionRules: string[];
    atomicity: {
        isAtomic: boolean;
        estimatedHours: number;
        confidence: number;
        suggestions?: string[];
    };
}

export enum TaskStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
    PAUSED = 'paused'
}

export interface TaskTemplate {
    description: string;
    completion: string;
    difficulties: string;
}

export interface TaskMetrics {
    timeVariance: number;
    atomicityAccuracy: number;
    preventionRulesGenerated: number;
}
