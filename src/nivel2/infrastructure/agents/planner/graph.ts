/**
 * @fileoverview Planner Agent Graph
 * @module agents/planner/graph
 */

import * as vscode from 'vscode';
import type { PlanningState } from './state';
import type { ProgressCallback } from '../common/types';
import { createProgressEvent } from '../types/progress-events';

const PLANNER_PROMPT = `You are a technical planner creating actionable development plans in XML format.

**IMPORTANT - BEFORE PLANNING:**

1. **Use Tools First**: You have access to cappy_retrieve_context tool. Use it to gather information about:
   - Existing code structure
   - Similar implementations in the codebase
   - Related documentation
   - Project conventions

2. **Detect Environment**:
   - Terminal/Shell: {{shell}} ({{platform}})
   - Commands must be compatible with this shell
   - Windows (PowerShell): Use \`\` for multi-line, ';' for chaining
   - macOS/Linux (bash/zsh): Use '&&' for chaining, '\\' for multi-line

3. **Ask Questions When Needed**:
   If you need clarification about:
   - Specific requirements or constraints
   - Technology choices (frameworks, libraries)
   - Design preferences
   - Target audience or use case
   
   Ask the user BEFORE generating the plan. Format questions clearly:
   
   \`\`\`
   📋 **Preciso de mais informações:**
   
   1. [Specific question about X]?
   2. [Specific question about Y]?
   
   Por favor, responda para eu criar um plano mais preciso.
   \`\`\`

**PLAN GENERATION (after gathering context):**

Create a detailed, step-by-step plan in XML format with 5-6 steps maximum.

**XML Structure:**
\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<plan>
  <metadata>
    <title>Brief plan title</title>
    <description>What this plan accomplishes</description>
    <shell>{{shell}}</shell>
    <platform>{{platform}}</platform>
  </metadata>
  
  <steps>
    <step id="1" phase="preparation">
      <title>Step title</title>
      <description>What needs to be done</description>
      <actions>
        <action type="command">command to run</action>
        <action type="file-create">path/to/file.ts</action>
        <action type="file-edit">path/to/existing.ts</action>
      </actions>
      <validation>How to verify this step succeeded</validation>
    </step>
    
    <step id="2" phase="implementation">
      <!-- ... -->
    </step>
    
    <!-- 3-4 more steps -->
    
    <step id="5" phase="validation">
      <title>Final testing and validation</title>
      <description>Verify everything works</description>
      <actions>
        <action type="command">test command</action>
      </actions>
      <validation>Expected outcome</validation>
    </step>
  </steps>
</plan>
\`\`\`

**Guidelines:**
- **5-6 steps maximum** - keep it focused and actionable
- Each step should have clear validation criteria
- Commands must be shell-specific ({{shell}})
- Include file paths relative to workspace root
- Be specific about what code to write/modify
- Focus on incremental, testable progress

**Phases:**
- preparation: Setup, dependencies, structure
- implementation: Core development work
- validation: Testing and verification

Be practical and specific. User should be able to follow step-by-step.`;


/**
 * Creates development plan using LLM
 */
export async function runPlannerAgent(
  state: PlanningState,
  progressCallback?: ProgressCallback
): Promise<PlanningState> {
  progressCallback?.(createProgressEvent(
    'planner',
    'started',
    'Criando plano de desenvolvimento...'
  ));
  
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      progressCallback?.(createProgressEvent(
        'planner',
        'failed',
        'Modelo LLM não disponível'
      ));
      throw new Error('[Planner] No LLM models available');
    }
    
    progressCallback?.(createProgressEvent(
      'planner',
      'thinking',
      'Analisando contexto e estruturando plano...'
    ));
    
    const model = models[0];
    
    // Detect shell and platform
    const platform = process.platform === 'win32' ? 'windows' : 
                    process.platform === 'darwin' ? 'macos' : 'linux';
    const shell = process.env.SHELL?.split('/').pop() || 
                 (platform === 'windows' ? 'powershell' : 'bash');
    
    // Get Cappy tools (especially retrieve_context)
    const cappyTools = vscode.lm.tools.filter(tool => 
      tool.name.startsWith('cappy_') && 
      (tool.name.includes('retrieve_context') || tool.name.includes('grep') || tool.name.includes('read_file'))
    );
    
    console.log(`[Planner] Available tools: ${cappyTools.map(t => t.name).join(', ')}`);
    console.log(`[Planner] Detected shell: ${shell} on ${platform}`);
    
    const userRequest = state.messages[state.messages.length - 1]?.content || '';
    const recommendation = state.recommendation || 'Implementar solução';
    
    // Prepare prompt with environment variables
    const prompt = PLANNER_PROMPT
      .replace(/\{\{shell\}\}/g, shell)
      .replace(/\{\{platform\}\}/g, platform);
    
    const messages = [
      vscode.LanguageModelChatMessage.User(prompt),
      vscode.LanguageModelChatMessage.User(`User request: ${userRequest}\n\nRecommendation: ${recommendation}`)
    ];
    
    // First request: Allow tool usage for context gathering
    const response = await model.sendRequest(messages, { tools: cappyTools });
    
    let plan = '';
    const toolCalls: Array<{ name: string; input: unknown; callId: string }> = [];
    
    for await (const chunk of response.stream) {
      if (chunk instanceof vscode.LanguageModelTextPart) {
        plan += chunk.value;
      } else if (chunk instanceof vscode.LanguageModelToolCallPart) {
        toolCalls.push({
          name: chunk.name,
          input: chunk.input,
          callId: chunk.callId
        });
      }
    }
    
    // If LLM used tools, execute them and get final response
    if (toolCalls.length > 0) {
      console.log(`[Planner] Executing ${toolCalls.length} tool call(s) for context`);
      
      for (const toolCall of toolCalls) {
        console.log(`[Planner] 🔧 Tool: ${toolCall.name}`);
        
        try {
          const toolResult = await vscode.lm.invokeTool(
            toolCall.name,
            { input: toolCall.input } as vscode.LanguageModelToolInvocationOptions<object>,
            new vscode.CancellationTokenSource().token
          );
          
          // Add tool result to conversation
          messages.push(
            vscode.LanguageModelChatMessage.Assistant([
              new vscode.LanguageModelToolCallPart(toolCall.callId, toolCall.name, toolCall.input as object)
            ]),
            vscode.LanguageModelChatMessage.User([
              new vscode.LanguageModelToolResultPart(toolCall.callId, toolResult.content)
            ])
          );
        } catch (error) {
          console.error(`[Planner] ❌ Tool ${toolCall.name} failed:`, error);
        }
      }
      
      // Get final response after tools
      progressCallback?.(createProgressEvent(
        'planner',
        'thinking',
        'Gerando plano XML estruturado...'
      ));
      
      const finalResponse = await model.sendRequest(messages, {});
      plan = '';
      for await (const chunk of finalResponse.text) {
        plan += chunk;
      }
    }
    
    progressCallback?.(createProgressEvent(
      'planner',
      'completed',
      'Plano técnico criado com sucesso!'
    ));
    
    return {
      ...state,
      plan: plan.trim(),
      phase: 'critique'
    };
  } catch (error) {
    console.error('Planner LLM error:', error);
    
    progressCallback?.(createProgressEvent(
      'planner',
      'failed',
      `Erro ao criar plano: ${error instanceof Error ? error.message : String(error)}`
    ));
    
    throw error;
  }
}
