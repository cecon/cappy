/**
 * @fileoverview Conversational Agent Graph - Primary entry point for all interactions
 * @module agents/conversational/graph
 */

import * as vscode from 'vscode';
import type { ConversationalState } from './state';
import type { ProgressCallback } from '../common/types';
import { getProjectContext } from '../common/utils';

/**
 * Conversational Agent System Prompt
 * 
 * Primary entry point - handles all initial interactions and decides escalation
 */
const CONVERSATIONAL_PROMPT = `You are Cappy, a friendly AI assistant for software development.

You are the FIRST agent the user interacts with. Your role is to:
1. Engage in friendly conversation when appropriate
2. Answer questions about the project using available tools
3. Detect when technical work requires deeper code analysis
4. Signal when to escalate to research/planning agents

Current Project Context (basic detection):
{{projectContext}}

User message: {{message}}
Conversation history: {{history}}

Your personality:
- Friendly and direct
- Informative and helpful
- Professional but approachable
- Eager to help with technical work

**IMPORTANT: You have access to tools!**
- cappy_read_file: Read file contents. ALWAYS use absolute paths like "/Users/eduardomendonca/projetos/cappy/README.md"
- cappy_grep_search: Search for text patterns in files
- cappy_retrieve_context: Semantic search across project

**CRITICAL: For cappy_read_file, you MUST provide the FULL absolute path:**
Example: {"filePath": "/Users/eduardomendonca/projetos/cappy/README.md", "startLine": 1, "endLine": 50}

Response rules:
- Greetings (olá, hi, bom dia) → Greet back and ask what they want to work on
- Thanks (obrigado, thanks) → Accept graciously
- Goodbyes (tchau, bye) → Wish them well
**CRITICAL: You have access to tools. Use them DIRECTLY without announcing first.**

**Tool Usage Decision Tree:**

1. **Questions ABOUT the project** (what is it, purpose, features, benefits):
   → IMMEDIATELY call cappy_read_file(filePath: "README.md", startLine: 1, endLine: 100)
   → Use absolute path: {{workspacePath}}/README.md
   → After tool returns, respond in natural language with the information

2. **Questions about WHERE specific code/files are:**
   → Respond in JSON to escalate (needs workspace search)

3. **Questions about HOW specific implementation works:**
   → Respond in JSON to escalate (needs code analysis)

4. **Requests to build/create/implement:**
   → Respond in JSON to escalate immediately

5. **General chat/greetings:**
   → Respond naturally without tools or escalation

**Response Format Rules:**

- When you USE a tool → Respond in NATURAL LANGUAGE after the tool returns
- When you DON'T use a tool → Respond in JSON format:

{
  "response": "your message",
  "shouldEscalate": true | false,
  "escalationReason": "reason (if escalating)"
}

Set shouldEscalate=true when:
- User wants to build, create, implement, or modify code
- User asks WHERE specific code/files are located (needs workspace search)
- User asks HOW specific implementation works (needs code analysis)
- User needs planning or detailed technical analysis

Set shouldEscalate=false when:
- Pure greetings, thanks, goodbyes
- Questions about what the project IS (use tools to read README)
- Questions about project purpose, features, benefits (use tools to read README)
- Casual chat without work intent
- Simple clarifications you can answer with tools

Respond in the same language as the user's message.`;

/**
 * Conversational agent - PRIMARY entry point for all interactions
 */
export async function runConversationalAgent(
  state: ConversationalState,
  progressCallback?: ProgressCallback
): Promise<ConversationalState> {
  progressCallback?.('Conversando...');
  
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';
  const conversationHistory = state.messages.slice(-5).map(m => 
    `${m.role}: ${m.content}`
  ).join('\n');
  
  // Get project context (lightweight - just name and stack detection)
  const projectContext = await getProjectContext();
  
  // Get workspace path for tool usage
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

  try {
    // Get available LLM models
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      console.warn('[Conversational] No LLM models available');
      throw new Error('[Conversational] No LLM models available');
    }
    
    const model = models[0];
    
    // Get Cappy tools (read_file, grep_search, retrieve_context)
    const cappyTools = vscode.lm.tools.filter(tool => 
      tool.name.startsWith('cappy_') && 
      (tool.name.includes('read_file') || tool.name.includes('grep') || tool.name.includes('retrieve'))
    );
    
    console.log(`[Conversational] Available tools: ${cappyTools.map(t => t.name).join(', ')}`);
    
    // Prepare prompt with workspace path
    const prompt = CONVERSATIONAL_PROMPT
      .replace('{{message}}', lastMessage)
      .replace('{{history}}', conversationHistory)
      .replace('{{projectContext}}', `${projectContext}\n\nWorkspace Path: ${workspacePath}\nREADME Path: ${workspacePath}/README.md`)
      .replace(/\{\{workspacePath\}\}/g, workspacePath);
    
    // Call LLM with tools
    const messages = [
      vscode.LanguageModelChatMessage.User(prompt)
    ];
    
    const response = await model.sendRequest(messages, { tools: cappyTools });
    
    // Collect response and handle tool calls
    let fullResponse = '';
    const toolCalls: Array<{ name: string; input: unknown; callId: string }> = [];
    
    for await (const chunk of response.stream) {
      if (chunk instanceof vscode.LanguageModelTextPart) {
        fullResponse += chunk.value;
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
      console.log(`[Conversational] Executing ${toolCalls.length} tool call(s)`);
      
      for (const toolCall of toolCalls) {
        console.log(`[Conversational] 🔧 Tool Call Details:`);
        console.log(`  - Name: ${toolCall.name}`);
        console.log(`  - Input:`, JSON.stringify(toolCall.input, null, 2));
        console.log(`  - Call ID: ${toolCall.callId}`);
        
        try {
          const toolResult = await vscode.lm.invokeTool(
            toolCall.name,
            { input: toolCall.input } as vscode.LanguageModelToolInvocationOptions<object>,
            new vscode.CancellationTokenSource().token
          );
          
          console.log(`[Conversational] ✅ Tool ${toolCall.name} executed successfully`);
          console.log(`[Conversational] Result content length: ${toolResult.content.length} parts`);
          
          // Log what we're sending back to the LLM
          if (toolResult.content.length > 0 && toolResult.content[0] instanceof vscode.LanguageModelTextPart) {
            const textContent = (toolResult.content[0] as vscode.LanguageModelTextPart).value;
            console.log(`[Conversational] Tool result preview: ${textContent.substring(0, 200)}...`);
          }
          
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
          console.error(`[Conversational] ❌ Tool ${toolCall.name} failed:`, error);
          console.error(`[Conversational] Failed with input:`, JSON.stringify(toolCall.input, null, 2));
          
          // Add error to conversation so LLM knows the tool failed
          messages.push(
            vscode.LanguageModelChatMessage.Assistant([
              new vscode.LanguageModelToolCallPart(toolCall.callId, toolCall.name, toolCall.input as object)
            ]),
            vscode.LanguageModelChatMessage.User([
              new vscode.LanguageModelToolResultPart(toolCall.callId, [
                new vscode.LanguageModelTextPart(`Error: Tool failed - ${error instanceof Error ? error.message : String(error)}`)
              ])
            ])
          );
        }
      }
      
      // Get final response after tools
      const finalResponse = await model.sendRequest(messages, {});
      fullResponse = '';
      for await (const chunk of finalResponse.text) {
        fullResponse += chunk;
      }
      
      console.log(`[Conversational] Final response after tools: ${fullResponse.substring(0, 200)}...`);
    }
    
    // Parse JSON response (if available)
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Conversational] Could not parse JSON, using raw response');
      
      // If we used tools, the response is likely natural language, not JSON
      if (toolCalls.length > 0) {
        console.log('[Conversational] Tools were used, treating response as natural language');
        return {
          ...state,
          response: fullResponse.trim(),
          phase: 'completed'
        };
      }
      
      return {
        ...state,
        response: fullResponse.trim(),
        phase: 'completed'
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      ...state,
      response: parsed.response || fullResponse.trim(),
      phase: parsed.shouldEscalate ? 'research' : 'completed',
      metadata: {
        ...state.metadata,
        shouldEscalate: parsed.shouldEscalate || false,
        escalationReason: parsed.escalationReason
      }
    };
    
  } catch (error) {
    console.error('[Conversational] LLM call failed:', error);
    throw error;
  }
}
