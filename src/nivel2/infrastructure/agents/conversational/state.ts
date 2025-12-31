import { Annotation } from '@langchain/langgraph';

export const ConversationalGraphState = Annotation.Root({
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),

  workspaceContext: Annotation<{
    rootPath: string;
    openFiles: string[];
    activeFile?: string;
    gitBranch?: string;
    gitStatus?: string;
    projectType?: string;
  } | undefined>(),

  intent: Annotation<{
    type: 'chat' | 'code_question' | 'create_task' | 'search_code';
    complexity: 'simple' | 'medium' | 'complex';
    requiresTools: boolean;
    suggestedTools: string[];
    reasoning?: string;
  } | undefined>(),

  gatheredInfo: Annotation<Record<string, unknown>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({})
  }),

  response: Annotation<string | undefined>(),

  progressCallback: Annotation<((msg: string) => void) | undefined>()
});

export type ConversationalState = typeof ConversationalGraphState.State;

