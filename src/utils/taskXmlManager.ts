import * as fs from 'fs';
import * as path from 'path';
import { Task, TaskStatus, TaskStep, TaskContext, TaskValidation, TaskProgress } from '../models/task';

export class TaskXmlManager {
    
    /**
     * Generates XML content for a task
     */
    public static generateTaskXml(task: Task): string {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<task id="${task.id}" versao="${task.version}">
    <metadados>
        <titulo>${this.escapeXml(task.title)}</titulo>
        <descricao>${this.escapeXml(task.description)}</descricao>
        <status>${task.status}</status>
        <progresso>${task.progress.completed}/${task.progress.total}</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="${this.escapeXml(task.context.mainTechnology)}"${task.context.version ? ` versao="${this.escapeXml(task.context.version)}"` : ''}/>
        <dependencias>
${task.context.dependencies.map(dep => `            <lib>${this.escapeXml(dep.name)}</lib>`).join('\n')}
        </dependencias>
    </contexto>
    
    <steps>
${task.steps.map(step => this.generateStepXml(step)).join('\n')}
    </steps>
    
    <validacao>
        <checklist>
${task.validation.checklist.map(item => `            <item>${this.escapeXml(item)}</item>`).join('\n')}
        </checklist>
    </validacao>
</task>`;
        
        return xml;
    }

    /**
     * Parses XML content and returns Task object
     */
    public static parseTaskXml(xmlContent: string): Task {
        // Simple XML parsing - in production, you might want to use a proper XML parser
        const taskMatch = xmlContent.match(/<task id="([^"]*)" versao="([^"]*)">/);
        if (!taskMatch) {
            throw new Error('Invalid task XML format');
        }

        const id = taskMatch[1];
        const version = taskMatch[2];

        // Extract metadata
        const title = this.extractXmlValue(xmlContent, 'titulo');
        const description = this.extractXmlValue(xmlContent, 'descricao');
        const status = this.extractXmlValue(xmlContent, 'status') as TaskStatus;
        const progressMatch = this.extractXmlValue(xmlContent, 'progresso').match(/(\d+)\/(\d+)/);
        const progress: TaskProgress = {
            completed: parseInt(progressMatch?.[1] || '0'),
            total: parseInt(progressMatch?.[2] || '0')
        };

        // Extract context
        const techMatch = xmlContent.match(/<tecnologia principal="([^"]*)"(?:\s+versao="([^"]*)")?\/>/);
        const mainTechnology = techMatch?.[1] || '';
        const techVersion = techMatch?.[2];

        const libsMatch = xmlContent.match(/<dependencias>(.*?)<\/dependencias>/s);
        const dependencies = [];
        if (libsMatch) {
            const libMatches = libsMatch[1].matchAll(/<lib>([^<]*)<\/lib>/g);
            for (const libMatch of libMatches) {
                dependencies.push({
                    name: this.unescapeXml(libMatch[1]),
                    type: 'lib' as const
                });
            }
        }

        // Extract steps
        const stepsMatch = xmlContent.match(/<steps>(.*?)<\/steps>/s);
        const steps: TaskStep[] = [];
        if (stepsMatch) {
            const stepMatches = stepsMatch[1].matchAll(/<step[^>]*>(.*?)<\/step>/gs);
            for (const stepMatch of stepMatches) {
                const stepXml = stepMatch[0];
                const step = this.parseStepXml(stepXml);
                steps.push(step);
            }
        }

        // Extract validation
        const checklistMatch = xmlContent.match(/<checklist>(.*?)<\/checklist>/s);
        const checklist: string[] = [];
        if (checklistMatch) {
            const itemMatches = checklistMatch[1].matchAll(/<item>([^<]*)<\/item>/g);
            for (const itemMatch of itemMatches) {
                checklist.push(this.unescapeXml(itemMatch[1]));
            }
        }

        return {
            id,
            version,
            title: this.unescapeXml(title),
            description: this.unescapeXml(description),
            status,
            progress,
            createdAt: new Date(),
            path: '',
            context: {
                mainTechnology: this.unescapeXml(mainTechnology),
                version: techVersion ? this.unescapeXml(techVersion) : undefined,
                dependencies
            },
            steps,
            validation: {
                checklist
            }
        };
    }

    /**
     * Saves task as XML file
     */
    public static saveTaskXml(task: Task, taskPath: string): void {
        const xmlContent = this.generateTaskXml(task);
        const xmlFilePath = path.join(taskPath, 'task.xml');
        fs.writeFileSync(xmlFilePath, xmlContent, 'utf8');
    }

    /**
     * Loads task from XML file
     */
    public static loadTaskXml(taskPath: string): Task {
        const xmlFilePath = path.join(taskPath, 'task.xml');
        if (!fs.existsSync(xmlFilePath)) {
            throw new Error(`Task XML file not found: ${xmlFilePath}`);
        }
        
        const xmlContent = fs.readFileSync(xmlFilePath, 'utf8');
        const task = this.parseTaskXml(xmlContent);
        task.path = taskPath;
        
        return task;
    }

    /**
     * Updates step completion status in XML file
     */
    public static updateStepCompletion(taskPath: string, stepId: string, completed: boolean): void {
        const task = this.loadTaskXml(taskPath);
        const step = task.steps.find(s => s.id === stepId);
        if (step) {
            step.completed = completed;
            
            // Update progress
            task.progress.completed = task.steps.filter(s => s.completed).length;
            
            this.saveTaskXml(task, taskPath);
        }
    }

    private static generateStepXml(step: TaskStep): string {
        const attributes = [
            `id="${step.id}"`,
            `ordem="${step.order}"`,
            `concluido="${step.completed}"`,
            `obrigatorio="${step.required}"`
        ];
        
        if (step.dependsOn) {
            attributes.push(`dependeDe="${step.dependsOn}"`);
        }

        const criteriaXml = step.criteria.map(c => `                <criterio>${this.escapeXml(c)}</criterio>`).join('\n');
        const deliverablesXml = step.deliverables?.length 
            ? step.deliverables.map(d => `            <entrega>${this.escapeXml(d)}</entrega>`).join('\n')
            : '';

        return `        <step ${attributes.join(' ')}>
            <titulo>${this.escapeXml(step.title)}</titulo>
            <descricao>${this.escapeXml(step.description)}</descricao>
            <criterios>
${criteriaXml}
            </criterios>
${deliverablesXml ? `            ${deliverablesXml}\n` : ''}        </step>`;
    }

    private static parseStepXml(stepXml: string): TaskStep {
        const idMatch = stepXml.match(/id="([^"]*)"/);
        const orderMatch = stepXml.match(/ordem="([^"]*)"/);
        const completedMatch = stepXml.match(/concluido="([^"]*)"/);
        const requiredMatch = stepXml.match(/obrigatorio="([^"]*)"/);
        const dependsOnMatch = stepXml.match(/dependeDe="([^"]*)"/);

        const title = this.extractXmlValue(stepXml, 'titulo');
        const description = this.extractXmlValue(stepXml, 'descricao');

        // Extract criteria
        const criteriosMatch = stepXml.match(/<criterios>(.*?)<\/criterios>/s);
        const criteria: string[] = [];
        if (criteriosMatch) {
            const criterioMatches = criteriosMatch[1].matchAll(/<criterio>([^<]*)<\/criterio>/g);
            for (const criterioMatch of criterioMatches) {
                criteria.push(this.unescapeXml(criterioMatch[1]));
            }
        }

        // Extract deliverables
        const deliverables: string[] = [];
        const entregaMatches = stepXml.matchAll(/<entrega>([^<]*)<\/entrega>/g);
        for (const entregaMatch of entregaMatches) {
            deliverables.push(this.unescapeXml(entregaMatch[1]));
        }

        return {
            id: idMatch?.[1] || '',
            order: parseInt(orderMatch?.[1] || '0'),
            title: this.unescapeXml(title),
            description: this.unescapeXml(description),
            completed: completedMatch?.[1] === 'true',
            required: requiredMatch?.[1] === 'true',
            dependsOn: dependsOnMatch?.[1],
            criteria,
            deliverables: deliverables.length > 0 ? deliverables : undefined
        };
    }

    private static extractXmlValue(xml: string, tagName: string): string {
        const match = xml.match(new RegExp(`<${tagName}>([^<]*)</${tagName}>`));
        return match?.[1] || '';
    }

    private static escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private static unescapeXml(text: string): string {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }
}
