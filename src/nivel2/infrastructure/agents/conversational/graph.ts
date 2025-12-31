import { StateGraph, END } from '@langchain/langgraph';
import * as vscode from 'vscode';
import { ConversationalGraphState, type ConversationalState } from './state';
import { analyzeIntent, directResponse, gatherInfo, generateResponse } from './nodes';
import { shouldUseTools } from './edges';
import { getProjectContext } from '../common/utils';

export function createConversationalGraph() {
  const workflow = new StateGraph(ConversationalGraphState)
    .addNode('analyze_intent', analyzeIntent)
    .addNode('gather_info', gatherInfo)
    .addNode('direct_response', directResponse)
    .addNode('generate_response', generateResponse)
    .addEdge('__start__', 'analyze_intent')
    .addConditionalEdges('analyze_intent', shouldUseTools, {
      gather_info: 'gather_info',
      direct_response: 'direct_response'
    })
    .addEdge('gather_info', 'generate_response')
    .addEdge('direct_response', END)
    .addEdge('generate_response', END);

  return workflow.compile();
}

export async function runConversationalAgent(
  messages: Array<{ role: string; content: string }>,
  progressCallback?: (msg: string) => void
): Promise<{ response: string; state: ConversationalState }> {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  const workspaceContext = workspace
    ? {
        rootPath: workspace.uri.fsPath,
        openFiles: vscode.workspace.textDocuments
          .filter(doc => !doc.isUntitled)
          .map(doc => vscode.workspace.asRelativePath(doc.uri)),
        activeFile: vscode.window.activeTextEditor?.document.uri.fsPath,
        gitBranch: undefined,
        gitStatus: undefined,
        projectType: undefined
      }
    : undefined;

  const initialState: Partial<ConversationalState> = {
    messages,
    workspaceContext,
    progressCallback
  };

  // Seed gathered info with a quick project snapshot to reduce needless questions
  try {
    const snapshot = await getProjectContext();
    initialState.gatheredInfo = { projectContext: snapshot };
  } catch (e) {
    console.warn('Failed to seed project context snapshot', e);
  }

  const graph = createConversationalGraph();
  const result = await graph.invoke(initialState);

  return {
    response: result.response || 'Desculpe, não consegui gerar uma resposta.',
    state: result
  };
}
