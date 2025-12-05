/**
 * @fileoverview Conversational Agent Graph - Primary entry point for all interactions
 * @module agents/conversational/graph
 */

import * as vscode from 'vscode';
import type { ConversationalState } from './state';
import type { ProgressCallback } from '../common/types';
import { getProjectContext } from '../common/utils';
import { TaskFileLoader } from '../common/task-file-loader';

/**
 * System Prompts for the Thinking Loop
 */

// Step 1: Analysis prompt
const ANALYSIS_PROMPT = `You are Cappy's analysis system. Analyze ONLY what the user actually said.

User message: {{message}}
Conversation history: {{history}}
Project context: {{projectContext}}

CRITICAL RULES:
1. NEVER assume the user mentioned files they didn't mention
2. NEVER force "README.md" unless explicitly requested
3. Focus on what the user ACTUALLY wants, not what you think they should want
4. If the message is simple (greeting, thanks), mark complexity as "simple" and needsProjectInfo as false

Analyze:
1. Intent: What does the user ACTUALLY want based on their words?
2. Complexity: simple (chat/greeting) | medium (question) | complex (implementation)
3. Information needed: ONLY if required to answer their ACTUAL question
4. Tools: ONLY suggest tools if clearly needed for their ACTUAL request

Respond with JSON:
{
  "intent": "what user actually wants based on their message",
  "complexity": "simple" | "medium" | "complex",
  "needsProjectInfo": boolean,
  "needsCodeAnalysis": boolean,
  "suggestedTools": ["only if clearly needed"],
  "reasoning": "why based on what they said"
}`;

// Step 2: Planning prompt
const PLANNING_PROMPT = `You are Cappy's planning system. Create a minimal, focused plan.

Analysis: {{analysis}}
Available tools: {{tools}}

CRITICAL RULES:
1. ONLY suggest reading files if user explicitly mentioned them or if absolutely necessary
2. NEVER default to README.md unless user asked about project overview
3. Prefer cappy_grep_search over cappy_read_file for finding specific things
4. If analysis.complexity is "simple", plan should be empty (no tools needed)

Create a minimal plan:
{
  "steps": [
    {
      "step": 1,
      "action": "use_tool" | "respond",
      "tool": "tool_name or null",
      "query": "specific search term or file path",
      "reasoning": "why this specific tool is needed"
    }
  ],
  "responseStrategy": "how to answer based on what we have"
}`;

// Step 3: Reflection prompt
const REFLECTION_PROMPT = `You are Cappy's reflection system. Review ONLY the actual information gathered.

Original user question: {{message}}
Analysis of user intent: {{analysis}}
Planning strategy: {{planning}}
Information gathered: {{gatheredInfo}}
Tool results: {{toolResults}}

CRITICAL RULES:
1. Base reflection on analysis.intent - what user ACTUALLY asked for
2. Respect planning.responseStrategy - if it says "simple greeting", don't add complex follow-ups
3. Use ONLY tool results actually obtained, don't invent context
4. If planning.steps is empty, keep reflection minimal
5. NEVER mention topics not in user message, analysis.intent, or tool results
6. If tool results contain files/contexts (grep_search, read_file, retrieve_context found data), assume hasEnoughInfo=true
7. Only mark hasEnoughInfo=false if CRITICAL information is truly missing for the user's question

Reflect:
{
  "hasEnoughInfo": boolean (default: true if any tool results exist),
  "keyPoints": ["points from analysis.intent AND tool results, nothing else"],
  "responseTone": "friendly" | "technical" | "helpful" | "conversational",
  "missingInfo": ["only if truly CRITICAL information is missing"],
  "shouldAskFollowUp": boolean,
  "followUpQuestions": ["only if analysis.complexity is complex AND relevant"]
}`;

// Step 4: Final response prompt
const RESPONSE_PROMPT = `You are Cappy, a friendly AI assistant for software development. 

Based on your internal thinking and research, provide a natural, helpful response.

User message: {{message}}
Your analysis: {{analysis}}
Information gathered: {{gatheredInfo}}
Your reflection: {{reflection}}

CRITICAL RULES:
1. Answer ONLY what the user actually asked
2. NEVER mention tasks, scopes, or contexts the user didn't bring up
3. If user asked about "graph view UI", talk about graph view UI - not about other topics
4. Base your response on analysis + tool results, not on assumptions

Respond naturally in the same language as the user. Be:
- Friendly and direct
- Informative and helpful  
- Professional but approachable
- Focused on their actual question

{{projectContext}}`;

/**
 * Executes a thinking step and returns the result
 */
async function executeThinkingStep(
  model: any,
  prompt: string,
  expectJson: boolean = true
): Promise<string> {
  const response = await model.sendRequest([
    vscode.LanguageModelChatMessage.User(prompt)
  ], {});
  
  let result = '';
  for await (const chunk of response.text) {
    result += chunk;
  }
  
  if (expectJson) {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = result.match(/\{.*\}/s);
    return jsonMatch ? jsonMatch[0] : result;
  }
  
  return result;
}

/**
 * Executes a tool call during the thinking process
 */
async function executeToolInThinking(
  toolName: string,
  toolInput: unknown,
  availableTools: any[]
): Promise<string> {
  try {
    const tool = availableTools.find(t => t.name === toolName);
    if (!tool) {
      return `Tool ${toolName} not found`;
    }

    const toolResult = await vscode.lm.invokeTool(
      toolName,
      { input: toolInput } as vscode.LanguageModelToolInvocationOptions<object>,
      new vscode.CancellationTokenSource().token
    );

    // Convert tool result to string
    let resultText = '';
    for (const part of toolResult.content) {
      if (part instanceof vscode.LanguageModelTextPart) {
        resultText += part.value;
      }
    }
    
    return resultText || 'Tool executed but returned no text content';
  } catch (error) {
    return `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Conversational agent with thinking loop - PRIMARY entry point for all interactions
 */
export async function runConversationalAgent(
  state: ConversationalState,
  progressCallback?: ProgressCallback
): Promise<ConversationalState> {
  progressCallback?.('🤔 Pensando...');
  
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';
  const conversationHistory = state.messages.map(m => 
    `${m.role}: ${m.content}`
  ).join('\n');
  
  // DEBUG: Log what we're actually processing
  console.log('[Conversational] State messages count:', state.messages.length);
  console.log('[Conversational] Last message from state:', lastMessage.substring(0, 100));
  console.log('[Conversational] Last message role:', state.messages[state.messages.length - 1]?.role);
  console.log('[Conversational] Last 3 messages:', state.messages.slice(-3).map(m => ({
    role: m.role,
    preview: m.content.substring(0, 60)
  })));
  
  // Get project context and workspace path
  const projectContext = await getProjectContext();
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

  // Active task context will only be loaded if user explicitly mentions task/tarefa
  let activeTaskContext = '';
  const mentionsTask = lastMessage.toLowerCase().match(/\b(task|tarefa|active task|current task)\b/);
  if (mentionsTask) {
    const taskSummary = await TaskFileLoader.getActiveTaskSummary();
    if (taskSummary) {
      activeTaskContext = `\n\n${taskSummary}\n`;
    }
  }

  try {
    // Get available LLM models
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      throw new Error('[Conversational] No LLM models available');
    }
    
    const model = models[0];
    
    // Get available tools
    const cappyTools = vscode.lm.tools.filter(tool => 
      tool.name.startsWith('cappy_') && 
      (tool.name.includes('read_file') || tool.name.includes('grep') || tool.name.includes('retrieve'))
    );

    const toolNames = cappyTools.map(t => t.name).join(', ');
    
    // 🧠 THINKING LOOP
    
    // Step 1: Analysis
    progressCallback?.('🔍 Analisando mensagem...');
    const analysisPrompt = ANALYSIS_PROMPT
      .replace('{{message}}', lastMessage)
      .replace('{{history}}', conversationHistory)
      .replace('{{projectContext}}', projectContext);
    
    const analysisResult = await executeThinkingStep(model, analysisPrompt, true);
    console.log('[Conversational] Analysis:', analysisResult);
    
    let analysis: any = {};
    try {
      analysis = JSON.parse(analysisResult);
    } catch (e) {
      console.warn('[Conversational] Failed to parse analysis JSON, proceeding with fallback');
      analysis = { complexity: 'simple', needsProjectInfo: false };
    }

    // Step 2: Planning
    progressCallback?.('📋 Planejando resposta...');
    const planningPrompt = PLANNING_PROMPT
      .replace('{{analysis}}', JSON.stringify(analysis, null, 2))
      .replace('{{tools}}', toolNames);
    
    const planningResult = await executeThinkingStep(model, planningPrompt, true);
    console.log('[Conversational] Planning:', planningResult);
    
    let plan: any = { steps: [] };
    try {
      plan = JSON.parse(planningResult);
    } catch (e) {
      console.warn('[Conversational] Failed to parse planning JSON, proceeding with empty plan');
    }

    // Step 3: Execute planned actions (gather information)
    let gatheredInfo = '';
    let toolResults: Record<string, string> = {};
    
    // Skip tool execution for simple intents unless explicitly needed
    const shouldSkipTools = analysis.complexity === 'simple' && !analysis.needsProjectInfo && !analysis.needsCodeAnalysis;
    
    if (shouldSkipTools) {
      console.log('[Conversational] Skipping tools for simple intent');
    } else if (plan.steps && Array.isArray(plan.steps)) {
      for (const step of plan.steps) {
        if (step.action === 'use_tool' && step.tool) {
          progressCallback?.(`🔧 Usando ${step.tool}...`);
          
          // Create tool input based on the tool type
          let toolInput: any = {};
          if (step.tool.includes('read_file')) {
            // Only read README if explicitly mentioned
            if (step.query?.toLowerCase().includes('readme')) {
              toolInput = { filePath: `${workspacePath}/README.md` };
            } else if (step.query) {
              toolInput = { filePath: step.query };
            } else {
              // Skip tool if no valid file path
              console.log('[Conversational] Skipping read_file - no valid path');
              continue;
            }
          } else if (step.tool.includes('retrieve_context')) {
            // Create focused query from analysis intent, not full message
            const focusedQuery = step.query || analysis.intent || lastMessage;
            console.log('[Conversational] Retrieve context query:', focusedQuery);
            toolInput = { query: focusedQuery, maxResults: 10, minScore: 0.4 };
          } else if (step.tool.includes('grep_search')) {
            toolInput = { query: step.query || lastMessage, isRegexp: false };
          }
          
          const result = await executeToolInThinking(step.tool, toolInput, cappyTools);
          toolResults[step.tool] = result;
          gatheredInfo += `\n${step.tool}: ${result.substring(0, 500)}...`;
          
          console.log(`[Conversational] Tool ${step.tool} executed, result length: ${result.length}`);
        }
      }
    }

    // Step 4: Reflection
    progressCallback?.('💭 Refletindo sobre informações...');
    const reflectionPrompt = REFLECTION_PROMPT
      .replace('{{message}}', lastMessage)
      .replace('{{analysis}}', JSON.stringify(analysis, null, 2))
      .replace('{{planning}}', JSON.stringify(plan, null, 2))
      .replace('{{gatheredInfo}}', gatheredInfo)
      .replace('{{toolResults}}', JSON.stringify(toolResults, null, 2));
    
    const reflectionResult = await executeThinkingStep(model, reflectionPrompt, true);
    console.log('[Conversational] Reflection:', reflectionResult);
    
    let reflection: any = {};
    try {
      reflection = JSON.parse(reflectionResult);
    } catch (e) {
      console.warn('[Conversational] Failed to parse reflection JSON, proceeding with fallback');
      reflection = { hasEnoughInfo: true, responseTone: 'helpful' };
    }

    // Step 5: Generate final response
    progressCallback?.('✍️ Gerando resposta final...');
    
    // Only include task context if it was explicitly loaded
    const contextInfo = activeTaskContext 
      ? `${projectContext}\n\nWorkspace Path: ${workspacePath}\n\nActive Task Context:\n${activeTaskContext}`
      : `${projectContext}\n\nWorkspace Path: ${workspacePath}`;
    
    const finalPrompt = RESPONSE_PROMPT
      .replace('{{message}}', lastMessage)
      .replace('{{analysis}}', JSON.stringify(analysis, null, 2))
      .replace('{{gatheredInfo}}', gatheredInfo)
      .replace('{{reflection}}', JSON.stringify(reflection, null, 2))
      .replace('{{projectContext}}', contextInfo);
    
    const finalResponse = await executeThinkingStep(model, finalPrompt, false);
    
    console.log('[Conversational] Thinking loop completed, final response ready');
    
    return {
      ...state,
      response: finalResponse.trim(),
      phase: 'completed'
    };
    
  } catch (error) {
    console.error('[Conversational] Thinking loop failed:', error);
    throw error;
  }
}
