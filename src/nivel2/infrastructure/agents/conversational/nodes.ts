import * as vscode from 'vscode';
import type { ConversationalState } from './state';
import { LLMSelector } from '../../services/llm-selector';

const READ_ONLY_TOOLS = [
  'cappy_read_file',
  'cappy_grep_search',
  'cappy_check_task_file',
  'cappy_run_terminal_command'
];

function getLastMessage(state: ConversationalState): string {
  return state.messages[state.messages.length - 1]?.content || '';
}

async function readResponse(model: vscode.LanguageModelChatResponse): Promise<string> {
  let result = '';
  for await (const chunk of model.text as AsyncIterable<unknown>) {
    if (typeof chunk === 'string') {
      result += chunk;
    } else if (chunk && typeof chunk === 'object' && 'value' in (chunk as any)) {
      result += (chunk as any).value;
    }
  }
  return result;
}

export async function analyzeIntent(state: ConversationalState): Promise<Partial<ConversationalState>> {
  state.progressCallback?.('🔍 Analisando intenção...');

  const lastMessage = getLastMessage(state);
  const model = await LLMSelector.selectBestModel();
  if (!model) {
    throw new Error('No LLM available');
  }

  const analysisPrompt = `Analyze this user message and determine intent.

User: ${lastMessage}

Workspace: ${state.workspaceContext?.rootPath || 'unknown'}
Open files: ${state.workspaceContext?.openFiles.slice(0, 5).join(', ') || 'none'}

Respond with JSON only:
{
  "type": "chat" | "code_question" | "create_task" | "search_code",
  "complexity": "simple" | "medium" | "complex",
  "requiresTools": boolean,
  "suggestedTools": ["cappy_read_file", "cappy_grep_search", "cappy_check_task_file", "cappy_run_terminal_command", "cappy_create_task_file"],
  "reasoning": "brief explanation"
}`;
  const response = await model.sendRequest([
    vscode.LanguageModelChatMessage.User(analysisPrompt)
  ], {});

  const raw = await readResponse(response);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let intent: NonNullable<ConversationalState['intent']> = {
    type: 'chat',
    complexity: 'simple',
    requiresTools: false,
    suggestedTools: [],
    reasoning: ''
  };

  if (jsonMatch) {
    try {
      intent = {
        ...intent,
        ...(JSON.parse(jsonMatch[0]) as Partial<NonNullable<ConversationalState['intent']>>)
      };
    } catch {
      // fallback uses defaults
    }
  }

  // Heuristic: questions about the project need workspace context, so force tool usage
  const messageLower = lastMessage.toLowerCase();
  const asksWhatProjectDoes = /o que (esse|este) projeto faz|what does this project do|project overview/.test(messageLower);
  const defaultTools = ['cappy_grep_search', 'cappy_read_file'];

  if (asksWhatProjectDoes) {
    intent = {
      ...intent,
      type: intent.type === 'chat' ? 'search_code' : intent.type,
      complexity: intent.complexity === 'simple' ? 'medium' : intent.complexity,
      requiresTools: true,
      suggestedTools: Array.from(new Set([...(intent.suggestedTools || []), ...defaultTools]))
    };
  }

  // Fallback: if tools are required but none suggested, seed with safe read-only defaults
  if (intent.requiresTools && (!intent.suggestedTools || intent.suggestedTools.length === 0)) {
    intent = { ...intent, suggestedTools: defaultTools };
  }

  return { intent };
}

export async function gatherInfo(state: ConversationalState): Promise<Partial<ConversationalState>> {
  state.progressCallback?.('🔧 Coletando informações...');

  const gatheredInfo: Record<string, unknown> = {};
  const suggestedTools = state.intent?.suggestedTools || [];
  const allowedTools = [
    ...READ_ONLY_TOOLS,
    ...(state.intent?.type === 'create_task' ? ['cappy_create_task_file'] : [])
  ];

  const cappyTools = vscode.lm.tools.filter(
    t => t.name.startsWith('cappy_') && allowedTools.includes(t.name)
  );
  const workspacePath = state.workspaceContext?.rootPath || '';
  const lastMessage = getLastMessage(state);

  for (const toolName of suggestedTools) {
    if (!allowedTools.includes(toolName)) {
      continue;
    }
    const tool = cappyTools.find(t => t.name === toolName);
    if (!tool) continue;

    try {
      state.progressCallback?.(`🔧 Usando ${toolName}...`);

      let toolInput: any = {};

      if (toolName.includes('read_file')) {
        toolInput = {
          filePath: state.workspaceContext?.activeFile || `${workspacePath}/README.md`
        };
      } else if (toolName.includes('grep_search')) {
        toolInput = { query: lastMessage, isRegexp: false };
      } else if (toolName.includes('check_task')) {
        toolInput = { fileName: 'task.ACTIVE.xml' };
      } else if (toolName.includes('run_terminal')) {
        toolInput = { command: 'pwd' };
      }

      const toolResult = await vscode.lm.invokeTool(
        toolName,
        { input: toolInput } as vscode.LanguageModelToolInvocationOptions<object>,
        new vscode.CancellationTokenSource().token
      );

      let resultText = '';
      for (const part of toolResult.content) {
        if (part instanceof vscode.LanguageModelTextPart) {
          resultText += part.value;
        }
      }

      gatheredInfo[toolName] = resultText;
    } catch (error) {
      console.error(`[GatherInfo] Tool ${toolName} failed:`, error);
      gatheredInfo[toolName] = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return { gatheredInfo };
}

export async function directResponse(state: ConversationalState): Promise<Partial<ConversationalState>> {
  state.progressCallback?.('💬 Gerando resposta...');

  const model = await LLMSelector.selectBestModel();
  if (!model) {
    throw new Error('No LLM available');
  }

  const lastMessage = getLastMessage(state);
  const history = state.messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

  const prompt = `You are Cappy, a friendly AI coding assistant.

User: ${lastMessage}

History:
${history}

Respond naturally and helpfully in the user's language.`;

  const response = await model.sendRequest([
    vscode.LanguageModelChatMessage.User(prompt)
  ], {});

  const result = await readResponse(response);
  return { response: result.trim() };
}

export async function generateResponse(state: ConversationalState): Promise<Partial<ConversationalState>> {
  state.progressCallback?.('✍️ Gerando resposta final...');

  const model = await LLMSelector.selectBestModel();
  if (!model) {
    throw new Error('No LLM available');
  }

  const lastMessage = getLastMessage(state);
  const history = state.messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

  const wsContext = state.workspaceContext;
  const workspaceInfo = wsContext ? `
Project: ${wsContext.rootPath}
Branch: ${wsContext.gitBranch || 'unknown'}
Status: ${wsContext.gitStatus || 'clean'}
Open files: ${wsContext.openFiles.slice(0, 5).join(', ')}
Active: ${wsContext.activeFile || 'none'}
  `.trim() : 'No workspace context';

  const gatheredContext = Object.entries(state.gatheredInfo || {})
    .map(([tool, result]) => `[${tool}]:\n${String(result).substring(0, 1000)}`)
    .join('\n\n');

  const prompt = `You are Cappy, an AI coding assistant with workspace understanding.

WORKSPACE:
${workspaceInfo}

USER MESSAGE: ${lastMessage}

CONVERSATION HISTORY:
${history}

GATHERED INFORMATION:
${gatheredContext || 'none'}

${state.intent?.type === 'create_task' ? `
TASK CREATION GUIDELINES:
When creating a task, structure it like this:
- Title: Clear and actionable
- Category: feature|bugfix|refactor|docs|test
- Description with:
  ## Context: Why this task exists
  ## Steps: Numbered, file-specific actions
  ## Acceptance Criteria: Testable outcomes
  ## Testing: How to verify

Use cappy_create_task_file tool with proper JSON structure.
` : ''}

Respond naturally in the user's language. Be helpful, technical when needed, friendly always.`;

  const allowedTools = [
    'cappy_read_file',
    'cappy_grep_search',
    'cappy_check_task_file',
    'cappy_run_terminal_command',
    'cappy_create_task_file',
    'cappy_create_todo',
    'cappy_list_todos',
    'cappy_complete_todo'
  ];

  const cappyTools = vscode.lm.tools.filter(
    t => t.name.startsWith('cappy_') && allowedTools.includes(t.name)
  );

  const response = await model.sendRequest([
    vscode.LanguageModelChatMessage.User(prompt)
  ], {
    tools: cappyTools
  });

  let finalResponse = '';

  for await (const chunk of response.text as AsyncIterable<unknown>) {
    if (typeof chunk === 'string') {
      finalResponse += chunk;
    } else if (chunk && typeof chunk === 'object' && 'value' in (chunk as any)) {
      finalResponse += (chunk as any).value ?? '';
    } else if (chunk && typeof chunk === 'object' && 'name' in (chunk as any) && 'input' in (chunk as any)) {
      const call = chunk as any;

      if (!allowedTools.includes(call.name)) {
        state.progressCallback?.(`⚠️ Ignorando tool não permitida: ${call.name}`);
        continue;
      }

      state.progressCallback?.(`🔧 ${call.name}...`);
      try {
        await vscode.lm.invokeTool(
          call.name,
          { input: call.input } as vscode.LanguageModelToolInvocationOptions<object>,
          new vscode.CancellationTokenSource().token
        );
      } catch (error) {
        console.error(`Tool ${call.name} failed:`, error);
      }
    }
  }

  return { response: finalResponse.trim() };
}
