export interface Task {
    id: string; // e.g., "cadastro-cliente-react"
    stepId?: string; // e.g., "STEP_0001" when completed and moved to history
    version: string; // e.g., "1.0"
    title: string;
    description: string;
    status: TaskStatus;
    progress: TaskProgress;
    createdAt: Date;
    completedAt?: Date;
    pausedAt?: Date;
    path: string; // Current path (.capy/task_XXXX or .capy/history/STEP_XXXX)
    context: TaskContext;
    steps: TaskStep[];
    validation: TaskValidation;
}

export interface TaskProgress {
    completed: number;
    total: number;
}

export interface TaskContext {
    mainTechnology: string;
    version?: string;
    dependencies: TaskDependency[];
}

export interface TaskDependency {
    name: string;
    type: 'lib' | 'framework' | 'tool';
}

export interface TaskStep {
    id: string;
    order: number;
    title: string;
    description: string;
    completed: boolean;
    required: boolean;
    dependsOn?: string;
    criteria: string[];
    deliverables?: string[];
}

export interface TaskValidation {
    checklist: string[];
}

export enum TaskStatus {
    emAndamento = 'em-andamento',
    pausada = 'pausada',
    concluida = 'concluida'
}

// Legacy interfaces for compatibility during transition
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
