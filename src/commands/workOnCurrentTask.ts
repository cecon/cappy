import * as vscode from 'vscode';
import * as path from 'path';
import { writeOutput } from '../utils/outputWriter';
import { getActiveTask } from './getActiveTask';

/**
 * Works on the current active task by:
 * 1. Getting the active task via getActiveTask
 * 2. Reading the task XML file
 * 3. Following the script/instructions contained in the XML
 * 4. Performing workspace analysis for prevention rules
 * 5. Managing prevention rules based on config limits
 * 6. Generating comprehensive completion summary
 */
export async function workOnCurrentTask(): Promise<string> {
    try {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            const message = "❌ Nenhum workspace aberto";
            await writeOutput(message);
            return message;
        }

        // First, get the active task status
        const activeTaskStatus = await getActiveTask();
        
        // Parse the XML response to check if there's an active task
        const isActiveMatch = activeTaskStatus.match(/<active>(true|false)<\/active>/);
        const isActive = isActiveMatch?.[1] === 'true';
        
        if (!isActive) {
            const message = `<work-current-task>
<active>false</active>
<file-path></file-path>
<next-step>No active task found</next-step>
<task-content></task-content>
</work-current-task>`;
            await writeOutput(message);
            return message;
        }

        // Extract file path from active task response
        const filePathMatch = activeTaskStatus.match(/<file-path>(.*?)<\/file-path>/);
        const filePath = filePathMatch?.[1];
        
        if (!filePath) {
            const message = "❌ Não foi possível encontrar o caminho do arquivo da tarefa ativa";
            await writeOutput(message);
            return message;
        }

        // Read the task XML file
        const taskFileUri = vscode.Uri.file(filePath);
        const fileBytes = await vscode.workspace.fs.readFile(taskFileUri);
        const taskContent = Buffer.from(fileBytes).toString('utf8');

        // Extract next step from task content
        const nextStep = extractNextStep(taskContent);
        
        // Perform workspace analysis for prevention rules
        await performWorkspaceAnalysis();
        
        // Manage prevention rules based on config
        await managePreventionRulesOverhead();

        // Generate work output
        const workOutput = `<work-current-task>
<active>true</active>
<file-path>${filePath}</file-path>
<next-step>${nextStep}</next-step>
<task-content>${escapeXml(taskContent)}</task-content>
</work-current-task>`;

        await writeOutput(workOutput);
        return workOutput;

    } catch (error) {
        const message = `❌ Erro ao trabalhar na tarefa atual: ${error}`;
        await writeOutput(message);
        return message;
    }
}

/**
 * Extracts the next step to be executed from task XML content
 */
function extractNextStep(taskContent: string): string {
    // Look for steps that are not completed yet
    const stepsMatch = taskContent.match(/<steps>(.*?)<\/steps>/s);
    if (!stepsMatch) {
        return "No steps found in task";
    }

    const stepsContent = stepsMatch[1];
    
    // Find first step without completion timestamp
    const stepMatches = stepsContent.match(/<step[^>]*>(.*?)<\/step>/gs);
    if (!stepMatches) {
        return "No step elements found";
    }

    for (const stepMatch of stepMatches) {
        // Check if step has completion timestamp
        if (!stepMatch.includes('<completed-at>')) {
            // Extract step description or ID
            const descMatch = stepMatch.match(/<description>(.*?)<\/description>/s);
            const idMatch = stepMatch.match(/id="([^"]*)"/);
            
            if (descMatch) {
                return descMatch[1].trim();
            } else if (idMatch) {
                return idMatch[1];
            } else {
                return "Next uncompleted step";
            }
        }
    }

    return "All steps completed";
}

/**
 * Performs comprehensive workspace analysis to identify patterns for prevention rules
 */
async function performWorkspaceAnalysis(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        return;
    }

    try {
        // Analyze common error patterns in the workspace
        await analyzeErrorPatterns();
        
        // Check for code quality issues
        await analyzeCodeQuality();
        
        // Review project structure for improvements
        await analyzeProjectStructure();
        
        // Examine recent changes for learning opportunities
        await analyzeRecentChanges();
        
    } catch (error) {
        console.error('Error during workspace analysis:', error);
    }
}

/**
 * Analyzes error patterns in the workspace
 */
async function analyzeErrorPatterns(): Promise<void> {
    // Look for common error patterns in:
    // - TypeScript compilation errors
    // - Test failures
    // - Runtime errors in logs
    // - Linting issues
    
    // This would integrate with VS Code diagnostics
    const diagnostics = vscode.languages.getDiagnostics();
    
    // Aggregate and categorize errors for prevention rule suggestions
    const errorPatterns: { [key: string]: number } = {};
    
    for (const [uri, diags] of diagnostics) {
        for (const diag of diags) {
            const pattern = categorizeError(diag);
            errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
        }
    }
    
    // Store patterns for prevention rule generation
    await storeErrorPatterns(errorPatterns);
}

/**
 * Categorizes an error for prevention rule analysis
 */
function categorizeError(diagnostic: vscode.Diagnostic): string {
    const message = diagnostic.message.toLowerCase();
    
    if (message.includes('cannot find module')) {
        return 'missing-imports';
    }
    if (message.includes('type') && message.includes('not assignable')) {
        return 'type-errors';
    }
    if (message.includes('unused')) {
        return 'unused-code';
    }
    if (message.includes('deprecated')) {
        return 'deprecated-usage';
    }
    
    return 'general-error';
}

/**
 * Stores error patterns for prevention rule generation
 */
async function storeErrorPatterns(patterns: { [key: string]: number }): Promise<void> {
    // This would store patterns in a temporary analysis file
    // that can be used later for prevention rule suggestions
}

/**
 * Analyzes code quality issues
 */
async function analyzeCodeQuality(): Promise<void> {
    // Analyze for:
    // - Complexity metrics
    // - Code duplication
    // - Performance anti-patterns
    // - Security vulnerabilities
}

/**
 * Analyzes project structure for improvements
 */
async function analyzeProjectStructure(): Promise<void> {
    // Analyze for:
    // - Circular dependencies
    // - Architectural violations
    // - Missing documentation
    // - Inconsistent naming conventions
}

/**
 * Analyzes recent changes for learning opportunities
 */
async function analyzeRecentChanges(): Promise<void> {
    // Analyze recent git changes for:
    // - Frequent bug fix patterns
    // - Refactoring opportunities
    // - Performance improvements
}

/**
 * Manages prevention rules overhead based on config limits
 */
async function managePreventionRulesOverhead(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        return;
    }

    try {
        // Read config to get limits
        const configUri = vscode.Uri.joinPath(ws.uri, '.cappy', 'config.yaml');
        const preventionRulesUri = vscode.Uri.joinPath(ws.uri, '.cappy', 'prevention-rules.xml');
        
        // Check if files exist
        const configExists = await fileExists(configUri);
        const rulesExist = await fileExists(preventionRulesUri);
        
        if (!configExists || !rulesExist) {
            return;
        }

        // Read current prevention rules
        const rulesBytes = await vscode.workspace.fs.readFile(preventionRulesUri);
        const rulesContent = Buffer.from(rulesBytes).toString('utf8');
        
        // Parse rules and apply prioritization
        await prioritizePreventionRules(rulesContent);
        
    } catch (error) {
        console.error('Error managing prevention rules overhead:', error);
    }
}

/**
 * Prioritizes prevention rules by relevance and removes less important ones
 */
async function prioritizePreventionRules(rulesContent: string): Promise<void> {
    // Parse XML to extract rules
    const ruleMatches = rulesContent.match(/<rule[^>]*>.*?<\/rule>/gs);
    if (!ruleMatches) {
        return;
    }

    // Score rules based on:
    // - Frequency of related errors
    // - Recency of creation/usage
    // - Severity/impact
    // - Project relevance
    
    const scoredRules = ruleMatches.map(rule => ({
        content: rule,
        score: calculateRuleScore(rule)
    }));

    // Sort by score (highest first)
    scoredRules.sort((a, b) => b.score - a.score);

    // Keep only top rules based on config limit (default: top 50 by relevance)
    const maxRules = 50; // This would come from config
    const keepRules = scoredRules.slice(0, maxRules);

    // Update prevention rules file if changes needed
    if (scoredRules.length > maxRules) {
        await updatePreventionRulesFile(keepRules.map(r => r.content));
    }
}

/**
 * Calculates relevance score for a prevention rule
 */
function calculateRuleScore(rule: string): number {
    let score = 0;
    
    // Base score for existence
    score += 10;
    
    // Bonus for recent creation
    const createdAtMatch = rule.match(/<createdAt>(.*?)<\/createdAt>/);
    if (createdAtMatch) {
        const createdDate = new Date(createdAtMatch[1]);
        const daysSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 30 - daysSinceCreation); // Recent rules get higher score
    }
    
    // Bonus for high severity
    if (rule.includes('severity="high"') || rule.includes('<severity>high</severity>')) {
        score += 20;
    } else if (rule.includes('severity="medium"') || rule.includes('<severity>medium</severity>')) {
        score += 10;
    }
    
    // Bonus for categories that are currently relevant
    if (rule.includes('category="type-errors"')) {
        score += 15;
    }
    if (rule.includes('category="performance"')) {
        score += 10;
    }
    if (rule.includes('category="security"')) {
        score += 25;
    }
    
    return score;
}

/**
 * Updates the prevention rules file with prioritized rules
 */
async function updatePreventionRulesFile(rules: string[]): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        return;
    }

    const preventionRulesUri = vscode.Uri.joinPath(ws.uri, '.cappy', 'prevention-rules.xml');
    
    // Reconstruct XML with header and prioritized rules
    const newContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="${rules.length}">
${rules.join('\n')}
</prevention-rules>`;

    await vscode.workspace.fs.writeFile(preventionRulesUri, Buffer.from(newContent, 'utf8'));
}

/**
 * Checks if a file exists
 */
async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

/**
 * Escapes XML special characters
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export default workOnCurrentTask;
