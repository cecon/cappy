export interface Task {
    id: string; // e.g., "task_0001"
    stepId?: string; // e.g., "STEP_0001" when completed and moved to history
    name: string;
    description: string;
    status: TaskStatus;
    estimatedHours: number;
    actualHours?: number;
    createdAt: Date;
    completedAt?: Date;
    pausedAt?: Date;
    path: string; // Current path (.capy/task_XXXX or .capy/history/STEP_XXXX)
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
    active = 'active',        // Currently being worked on
    paused = 'paused',        // Created but not active
    completed = 'completed'   // Moved to history
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
