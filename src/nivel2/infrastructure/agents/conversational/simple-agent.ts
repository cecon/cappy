/**
 * Simple conversational agent - direct chat without complex thinking loops
 */

import * as vscode from 'vscode';
import type { ConversationalState } from './state';
import type { ProgressCallback } from '../common/types';
import { LLMSelector } from '../../services/llm-selector';

/**
 * Detection prompt - identifies if user is providing a task scope
 */
const SCOPE_DETECTION_PROMPT = `You are Cappy's scope analyzer. Determine if the user message contains a clear task/feature scope.

Conversation history:
{{history}}

Current user message: {{message}}

A valid scope includes:
- What needs to be built/fixed/changed
- Clear description of the work
- Enough detail to start planning

Examples of scopes:
✅ "Criar uma API REST para gerenciar usuários"
✅ "Fix the login button not working on mobile"
✅ "quero criar uma tool para que a llm possa fazer perguntas de clarificação"

Examples of NOT scopes (just greetings/questions):
❌ "olá"
❌ "oi, tudo bem?"

IMPORTANT: If this is a continuation of a previous greeting (history shows previous exchange), check if the NEW message adds scope details.

Respond with ONLY a JSON object:
{
  "hasScope": true/false,
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

/**
 * Greeting prompt - friendly response asking for scope
 */
const GREETING_PROMPT = `You are Cappy, a friendly AI assistant specialized in task planning.

Conversation so far:
{{history}}

Latest user message: {{message}}

IMPORTANT: 
- If this is the FIRST message (no history), greet warmly and ask for scope
- If user ALREADY GREETED you (check history), DON'T greet again - instead ask for more details about what they want to build

Respond in the SAME LANGUAGE as the user with:
1. Acknowledge their message naturally (greeting back if first time, or continuation if not)
2. Ask them to provide more details about what they want to build/fix/change
3. Keep it SHORT (2-3 sentences max)

Example responses:
- First time (PT): "Olá! 👋 Sou o Cappy, especialista em planejamento de tarefas. O que você precisa desenvolver?"
- Follow-up (PT): "Entendi! Me dá mais detalhes: qual é o objetivo dessa ferramenta? Como ela deve funcionar?"
- First time (EN): "Hi! 👋 I'm Cappy, your task planning assistant. What would you like to build?"
- Follow-up (EN): "Got it! Tell me more: what should this feature do?"`;

/**
 * Task creation prompt - generates task parameters
 */
const TASK_CREATION_PROMPT = `You are Cappy's task creation system. The user provided a scope. Extract task information.

User scope: {{message}}
Conversation context: {{conversation}}

Extract:
1. Title: Short, clear title (max 60 chars)
2. Category: feature | bugfix | refactor | docs | test | chore
3. Description: Detailed scope (2-3 sentences)

Respond with ONLY a JSON object:
{
  "title": "Clear task title",
  "category": "feature",
  "description": "Detailed description of what needs to be done"
}`;

/**
 * Task analysis prompt - analyzes project to generate implementation steps
 */
const TASK_ANALYSIS_PROMPT = `You are Cappy's implementation planner. Analyze the project context and generate detailed implementation steps.

Task: {{title}}
Description: {{description}}
Category: {{category}}

Project context:
{{projectContext}}

Generate a structured implementation plan with:
1. Acceptance criteria (2-4 specific, measurable criteria)
2. Implementation steps (3-5 main steps)
3. Files to create/modify
4. Validation steps

Respond with ONLY a JSON object:
{
  "acceptanceCriteria": [
    "Criterion 1",
    "Criterion 2"
  ],
  "implementationSteps": [
    {
      "title": "Step 1 title",
      "description": "What to do",
      "files": ["path/to/file.ts"],
      "validation": "How to verify"
    }
  ],
  "contextFiles": [
    "path/to/relevant/file.ts"
  ]
}`;

/**
 * Simple conversational agent with scope detection - PRIMARY entry point
 */
export async function runSimpleConversationalAgent(
  state: ConversationalState,
  progressCallback?: ProgressCallback
): Promise<ConversationalState> {
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';
  const conversationHistory = state.messages.slice(-5).map(m => 
    `${m.role}: ${m.content}`
  ).join('\n');

  try {
    const model = await LLMSelector.selectBestModel();
    if (!model) {
      throw new Error('[SimpleAgent] No LLM models available');
    }

    // PHASE 1: Detect if message contains a task scope
    progressCallback?.('🔍 Analisando mensagem...'
      .replace('{{history}}', conversationHistory)
      );
    
    const detectionPrompt = SCOPE_DETECTION_PROMPT.replace('{{message}}', lastMessage);
    const detectionResponse = await model.sendRequest([
      vscode.LanguageModelChatMessage.User(detectionPrompt)
    ], {});
    
    let detectionText = '';
    for await (const chunk of detectionResponse.text) {
      detectionText += chunk;
    }
    
    // Parse detection result
    const jsonMatch = detectionText.match(/\{[\s\S]*\}/);
    const detection = jsonMatch ? JSON.parse(jsonMatch[0]) : { hasScope: false };
    
    console.log('[SimpleAgent] Scope detection:', detection);

    // PHASE 2A: If NO scope → Friendly greeting, ask for scope
    if (!detection.hasScope || detection.confidence < 60) {
      progressCallback?.('💬 Respondendo...');
      
      const greetingPrompt = GREETING_PROMPT
        .replace('{{history}}', conversationHistory)
        .replace('{{message}}', lastMessage);
      const greetingResponse = await model.sendRequest([
        vscode.LanguageModelChatMessage.User(greetingPrompt)
      ], {});
      
      let greetingText = '';
      for await (const chunk of greetingResponse.text) {
        greetingText += chunk;
      }
      
      return {
        ...state,
        response: greetingText.trim(),
        phase: 'completed'
      };
    }

    // PHASE 2B: If HAS scope → Extract task params and create task file
    progressCallback?.('📋 Criando tarefa...');
    
    const taskPrompt = TASK_CREATION_PROMPT
      .replace('{{message}}', lastMessage)
      .replace('{{conversation}}', conversationHistory);
    
    const taskResponse = await model.sendRequest([
      vscode.LanguageModelChatMessage.User(taskPrompt)
    ], {});
    
    let taskText = '';
    for await (const chunk of taskResponse.text) {
      taskText += chunk;
    }
    
    // Parse task parameters
    const taskMatch = taskText.match(/\{[\s\S]*\}/);
    if (!taskMatch) {
      throw new Error('Failed to extract task parameters');
    }
    
    const taskParams = JSON.parse(taskMatch[0]);
    console.log('[SimpleAgent] Task params:', taskParams);

    // PHASE 3: Analyze project to understand implementation approach
    progressCallback?.('🔍 Analisando projeto...');
    
    // Search for similar tools or implementations
    let projectContext = '';
    try {
      const searchResult = await vscode.lm.invokeTool(
        'cappy_grep_search',
        {
          input: {
            query: 'LanguageModelTool|registerTool|invokeTool',
            isRegexp: true,
            includePattern: 'src/**/*.ts'
          }
        } as vscode.LanguageModelToolInvocationOptions<object>,
        new vscode.CancellationTokenSource().token
      );
      
      for (const part of searchResult.content) {
        if (part instanceof vscode.LanguageModelTextPart) {
          projectContext += part.value + '\n';
        }
      }
    } catch (error) {
      console.warn('[SimpleAgent] Could not search project:', error);
    }

    // Generate detailed implementation plan
    progressCallback?.('📝 Gerando plano de implementação...');
    
    const analysisPrompt = TASK_ANALYSIS_PROMPT
      .replace('{{title}}', taskParams.title)
      .replace('{{description}}', taskParams.description)
      .replace('{{category}}', taskParams.category)
      .replace('{{projectContext}}', projectContext.slice(0, 3000)); // Limit context size
    
    const analysisResponse = await model.sendRequest([
      vscode.LanguageModelChatMessage.User(analysisPrompt)
    ], {});
    
    let analysisText = '';
    for await (const chunk of analysisResponse.text) {
      analysisText += chunk;
    }
    
    const analysisMatch = analysisText.match(/\{[\s\S]*\}/);
    const analysis = analysisMatch ? JSON.parse(analysisMatch[0]) : null;

    // Create task file using the tool
    progressCallback?.('📄 Criando arquivo de tarefa...');
    
    const toolResult = await vscode.lm.invokeTool(
      'cappy_create_task_file',
      {
        input: {
          title: taskParams.title,
          category: taskParams.category,
          description: taskParams.description
        }
      } as vscode.LanguageModelToolInvocationOptions<object>,
      new vscode.CancellationTokenSource().token
    );

    // Extract tool result text
    let resultText = '';
    for (const part of toolResult.content) {
      if (part instanceof vscode.LanguageModelTextPart) {
        resultText += part.value;
      }
    }

    // Build final response with analysis
    let finalResponse = `✨ **Tarefa criada e analisada!**\n\n` +
      `📋 **${taskParams.title}**\n` +
      `🏷️ Categoria: ${taskParams.category}\n\n`;
    
    if (analysis) {
      finalResponse += `🎯 **Critérios de Aceitação:**\n`;
      analysis.acceptanceCriteria?.forEach((c: string, i: number) => {
        finalResponse += `${i + 1}. ${c}\n`;
      });
      
      finalResponse += `\n📝 **Passos de Implementação:**\n`;
      analysis.implementationSteps?.forEach((step: any, i: number) => {
        finalResponse += `${i + 1}. **${step.title}**\n`;
        finalResponse += `   - ${step.description}\n`;
        if (step.files?.length > 0) {
          finalResponse += `   - Arquivos: ${step.files.join(', ')}\n`;
        }
      });
      
      if (analysis.contextFiles?.length > 0) {
        finalResponse += `\n📚 **Arquivos de Referência:**\n`;
        analysis.contextFiles.forEach((file: string) => {
          finalResponse += `- ${file}\n`;
        });
      }
    }
    
    finalResponse += `\n${resultText}\n\n` +
      `💡 O arquivo foi preenchido com base na análise do projeto. Revise e ajuste conforme necessário!`;
    
    return {
      ...state,
      response: finalResponse,
      phase: 'completed'
    };
    
  } catch (error) {
    console.error('[SimpleAgent] Error:', error);
    
    // Fallback: friendly error message
    return {
      ...state,
      response: '❌ Ops! Algo deu errado ao processar sua mensagem. Pode tentar novamente?',
      phase: 'completed'
    };
  }
}
