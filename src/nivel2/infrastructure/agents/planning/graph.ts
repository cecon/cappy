/**
 * @fileoverview Planning Agent Graph - LangGraph workflow for task planning
 */

import { StateGraph, END } from '@langchain/langgraph';
import * as vscode from 'vscode';
import { PlanningGraphState, type PlanningState } from './state';
import { 
  collectScope, 
  analyzeCodebase, 
  draftPlan, 
  confirmPlan, 
  createTaskFile 
} from './nodes';

// ============================================================================
// Edge Functions (Routing)
// ============================================================================

function routeAfterScope(state: PlanningState): string {
  if (state.phase === 'analyzing_codebase') {
    return 'analyze_codebase';
  }
  // Stay in collecting scope
  return END;
}

function routeAfterDraft(state: PlanningState): string {
  if (state.phase === 'confirming_plan') {
    return END; // Wait for user confirmation
  }
  return 'collect_scope'; // Go back to scope collection
}

// ============================================================================
// Graph Builder
// ============================================================================

export function createPlanningGraph() {
  const workflow = new StateGraph(PlanningGraphState)
    // Nodes - only nodes that are part of the automatic flow
    .addNode('collect_scope', collectScope)
    .addNode('analyze_codebase', analyzeCodebase)
    .addNode('draft_plan', draftPlan)
    
    // Start -> Collect Scope
    .addEdge('__start__', 'collect_scope')
    
    // Collect Scope -> Analysis or END (waiting for more input)
    .addConditionalEdges('collect_scope', routeAfterScope, {
      analyze_codebase: 'analyze_codebase',
      [END]: END
    })
    
    // Analysis -> Draft Plan
    .addEdge('analyze_codebase', 'draft_plan')
    
    // Draft Plan -> END (show plan and wait for confirmation)
    // Confirmation and task creation are handled manually in runPlanningAgent
    .addConditionalEdges('draft_plan', routeAfterDraft, {
      collect_scope: 'collect_scope',
      [END]: END
    });

  return workflow.compile();
}

// ============================================================================
// Agent Runner
// ============================================================================

export async function runPlanningAgent(
  messages: Array<{ role: string; content: string }>,
  existingState?: Partial<PlanningState>,
  progressCallback?: (msg: string) => void,
  chatModel?: vscode.LanguageModelChat
): Promise<{ response: string; state: PlanningState }> {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  // Build workspace context
  const workspaceContext = workspace ? {
    rootPath: workspace.uri.fsPath,
    projectName: workspace.name,
    projectType: await detectProjectType(workspace),
    mainLanguage: await detectMainLanguage(workspace),
    openFiles: vscode.workspace.textDocuments
      .filter(doc => !doc.isUntitled)
      .map(doc => vscode.workspace.asRelativePath(doc.uri)),
    activeFile: vscode.window.activeTextEditor?.document.uri.fsPath
  } : undefined;

  // Determine which node to start from based on phase
  const currentPhase = existingState?.phase || 'collecting_scope';
  
  // Build initial state - only pass non-undefined values
  const initialState: Record<string, unknown> = {
    messages,
    workspaceContext,
    progressCallback,
    chatModel, // Pass the model from chat participant
    phase: currentPhase
  };

  // Add existing state properties if they exist
  if (existingState?.taskPlan) {
    initialState.taskPlan = existingState.taskPlan;
  }
  if (existingState?.scopeQuestions) {
    initialState.scopeQuestions = existingState.scopeQuestions;
  }
  if (existingState?.codebaseInfo) {
    initialState.codebaseInfo = existingState.codebaseInfo;
  }
  if (existingState?.taskCreated !== undefined) {
    initialState.taskCreated = existingState.taskCreated;
  }

  // If we're in confirming_plan phase and receive new message, go to confirm node
  if (currentPhase === 'confirming_plan') {
    const confirmResult = await confirmPlan(initialState as unknown as PlanningState);
    
    // If confirmed, create the task
    if (confirmResult.phase === 'creating_task') {
      const createResult = await createTaskFile({
        ...initialState,
        ...confirmResult
      } as unknown as PlanningState);
      
      return {
        response: createResult.response || 'Task criada!',
        state: { ...initialState, ...confirmResult, ...createResult } as unknown as PlanningState
      };
    }
    
    // Otherwise return the confirm result
    return {
      response: confirmResult.response || 'Aguardando confirmação...',
      state: { ...initialState, ...confirmResult } as unknown as PlanningState
    };
  }

  // Run the graph for other phases
  const graph = createPlanningGraph();
  const result = await graph.invoke(initialState);

  return {
    response: result.response || 'Como posso ajudar você a planejar uma task?',
    state: result
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function detectProjectType(workspace: vscode.WorkspaceFolder): Promise<string> {
  try {
    const files = await vscode.workspace.fs.readDirectory(workspace.uri);
    const fileNames = new Set(files.map(([name]) => name));

    if (fileNames.has('package.json')) {
      // Check for specific frameworks
      const pkgUri = vscode.Uri.joinPath(workspace.uri, 'package.json');
      const content = await vscode.workspace.fs.readFile(pkgUri);
      const pkg = JSON.parse(Buffer.from(content).toString('utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps['next']) return 'Next.js';
      if (deps['react']) return 'React';
      if (deps['vue']) return 'Vue.js';
      if (deps['@angular/core']) return 'Angular';
      if (deps['express']) return 'Express.js';
      if (deps['@nestjs/core']) return 'NestJS';
      return 'Node.js';
    }
    if (fileNames.has('requirements.txt') || fileNames.has('pyproject.toml')) return 'Python';
    if (fileNames.has('pom.xml') || fileNames.has('build.gradle')) return 'Java';
    if (fileNames.has('go.mod')) return 'Go';
    if (fileNames.has('Cargo.toml')) return 'Rust';
    if (fileNames.has('composer.json')) return 'PHP';
    if (fileNames.has('Gemfile')) return 'Ruby';
    if (fileNames.has('*.csproj')) return '.NET';
  } catch {
    // Ignore errors
  }
  return 'Unknown';
}

async function detectMainLanguage(workspace: vscode.WorkspaceFolder): Promise<string> {
  try {
    const files = await vscode.workspace.fs.readDirectory(workspace.uri);
    const fileNames = files.map(([name]) => name);
    
    if (fileNames.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) return 'TypeScript';
    if (fileNames.some(f => f.endsWith('.js') || f.endsWith('.jsx'))) return 'JavaScript';
    if (fileNames.some(f => f.endsWith('.py'))) return 'Python';
    if (fileNames.some(f => f.endsWith('.java'))) return 'Java';
    if (fileNames.some(f => f.endsWith('.go'))) return 'Go';
    if (fileNames.some(f => f.endsWith('.rs'))) return 'Rust';
    if (fileNames.some(f => f.endsWith('.rb'))) return 'Ruby';
    if (fileNames.some(f => f.endsWith('.php'))) return 'PHP';
    if (fileNames.some(f => f.endsWith('.cs'))) return 'C#';
  } catch {
    // Ignore errors
  }
  return 'Unknown';
}
