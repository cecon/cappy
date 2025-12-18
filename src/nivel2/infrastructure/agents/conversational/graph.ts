/**
 * @fileoverview Conversational Agent Graph - Primary entry point for all interactions
 * @module agents/conversational/graph
 */

import * as vscode from 'vscode';
import type { ConversationalState } from './state';
import type { ProgressCallback } from '../common/types';
import { getProjectContext } from '../common/utils';
import { TaskFileLoader } from '../common/task-file-loader';
import { LLMSelector } from '../../services/llm-selector';

/**
 * System Prompts for the Thinking Loop
 */

// Step 1: Analysis prompt
const ANALYSIS_PROMPT = `You are Cappy's analysis system. Carefully analyze this user message and conversation context.

User message: {{message}}
Conversation history: {{history}}
Project context: {{projectContext}}

Your task is to analyze:
1. Intent: What does the user really want?
2. Complexity: Is this simple (greeting, thanks) or complex (technical question, implementation request)?
3. Information needed: What information might be required to answer properly?
4. Tools required: Which tools (cappy_read_file, cappy_grep_search, cappy_retrieve_context) might be useful?

Respond with a JSON object:
{
  "intent": "brief description of user intent",
  "complexity": "simple" | "medium" | "complex",
  "needsProjectInfo": boolean,
  "needsCodeAnalysis": boolean,
  "suggestedTools": ["tool1", "tool2"],
  "reasoning": "brief explanation of your analysis"
}`;

// Step 2: Planning prompt
const PLANNING_PROMPT = `You are Cappy's planning system. Based on the analysis, create a plan to respond to the user.

Analysis: {{analysis}}
Available tools: {{tools}}

Create a step-by-step plan:
1. What information to gather first?
2. Which tools to use and in what order?
3. How to structure the final response?

Respond with a JSON object:
{
  "steps": [
    {
      "step": 1,
      "action": "gather_info" | "use_tool" | "respond",
      "tool": "tool_name" | null,
      "query": "what to search/read",
      "reasoning": "why this step"
    }
  ],
  "responseStrategy": "how to structure the final answer"
}`;

// Step 3: Reflection prompt
const REFLECTION_PROMPT = `You are Cappy's reflection system. Review the gathered information and plan the final response.

Original user question: {{message}}
Information gathered: {{gatheredInfo}}
Tool results: {{toolResults}}

Reflect on:
1. Do we have enough information to answer well?
2. What are the key points to include?
3. What tone/style should the response have?
4. Are there any gaps or follow-up questions needed?

Respond with a JSON object:
{
  "hasEnoughInfo": boolean,
  "keyPoints": ["point1", "point2"],
  "responseTone": "friendly" | "technical" | "helpful" | "conversational",
  "missingInfo": ["what's missing"],
  "shouldAskFollowUp": boolean,
  "followUpQuestions": ["question1"]
}`;

// Step 4: Final response prompt
const RESPONSE_PROMPT = `You are Cappy, a friendly AI assistant for software development. 

Based on your internal thinking and research, provide a natural, helpful response.

User message: {{message}}
Your analysis: {{analysis}}
Information gathered: {{gatheredInfo}}
Your reflection: {{reflection}}

Respond naturally in the same language as the user. Be:
- Friendly and direct
- Informative and helpful  
- Professional but approachable
- Eager to help with technical work

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
  
  // Get project context and workspace path
  const projectContext = await getProjectContext();
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

  // Check for active task context
  let activeTaskContext = '';
  if (state.messages.length <= 2) {
    const taskSummary = await TaskFileLoader.getActiveTaskSummary();
    if (taskSummary) {
      activeTaskContext = `\n\n${taskSummary}\n`;
    }
  }

  try {
    // Get best available LLM model (Claude Sonnet 4.5, GPT-4o, etc)
    const model = await LLMSelector.selectBestModel();
    
    if (!model) {
      throw new Error('[Conversational] No LLM models available');
    }
    
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
    
    if (plan.steps && Array.isArray(plan.steps)) {
      for (const step of plan.steps) {
        if (step.action === 'use_tool' && step.tool) {
          progressCallback?.(`🔧 Usando ${step.tool}...`);
          
          // Create tool input based on the tool type
          let toolInput: any = {};
          if (step.tool.includes('read_file')) {
            // For read_file, try to construct a reasonable path
            if (step.query?.toLowerCase().includes('readme')) {
              toolInput = { filePath: `${workspacePath}/README.md` };
            } else {
              toolInput = { filePath: step.query || `${workspacePath}/README.md` };
            }
          } else if (step.tool.includes('retrieve_context')) {
            toolInput = { query: step.query || lastMessage };
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
    const finalPrompt = RESPONSE_PROMPT
      .replace('{{message}}', lastMessage)
      .replace('{{analysis}}', JSON.stringify(analysis, null, 2))
      .replace('{{gatheredInfo}}', gatheredInfo)
      .replace('{{reflection}}', JSON.stringify(reflection, null, 2))
      .replace('{{projectContext}}', `${projectContext}\n\nWorkspace Path: ${workspacePath}${activeTaskContext}`);
    
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
