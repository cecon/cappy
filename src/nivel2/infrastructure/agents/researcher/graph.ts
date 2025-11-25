/**
 * @fileoverview Researcher Agent Graph
 * @module agents/researcher/graph
 */

import * as vscode from 'vscode';
import type { ResearcherState } from './state';
import type { ProgressCallback } from '../common/types';
import { createProgressEvent } from '../types/progress-events';
import { getProjectContext } from '../common/utils';

const RESEARCHER_PROMPT = `You are a code researcher. You MUST use the available tools to search the workspace.

Current Project Context:
{{projectContext}}

CRITICAL: You MUST call at least ONE tool before responding. DO NOT respond without using tools.

YOUR PRIMARY JOB:
1. UNDERSTAND the project structure first (what language? where are tests? what frameworks?)
2. SEARCH for files related to the user's request
3. READ relevant files to understand existing patterns
4. Report findings clearly with file paths and code snippets

Available tools:
1. cappy_retrieve_context - Semantic search (use for concepts, patterns, "how to do X")
2. cappy_grep_search - Text search (use for exact strings, function names, imports)
3. cappy_workspace_search - File search (use for "find files matching *.ts")
4. cappy_symbol_search - Symbol search (use for "find class X", "find function Y")
5. cappy_read_file - Read file (use after finding files)

SEARCH STRATEGY:
- User asks about JWT → search for "auth", "jwt", "token", check middleware folder
- User asks about entry point → search for "main", "index", "app", "server", check package.json
- User asks about tests → search for "test", "spec", check /test folder
- User asks about specific class → use cappy_symbol_search first

MANDATORY BEHAVIOR:
- ALWAYS use at least TWO tools (search + read or multiple searches)
- If you find relevant files, READ them to get code context
- Report file paths, not just existence
- Include code snippets in your findings

After tool results, respond with JSON:
[
  {"source": "code", "content": "Found entry point in src/extension.ts - exports activate() function", "relevance": 0.95, "filePath": "src/extension.ts"},
  {"source": "code", "content": "Tests located in /test directory using vitest framework", "relevance": 0.9, "filePath": "test/"}
]`;

/**
 * Searches code, documentation and context using LLM with cappy_retrieve_context tool
 */
export async function runResearcherAgent(
  state: ResearcherState,
  progressCallback?: ProgressCallback
): Promise<ResearcherState> {
  // Send start event
  progressCallback?.(createProgressEvent(
    'researcher',
    'started',
    'Iniciando pesquisa no código...'
  ));
  
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      progressCallback?.(createProgressEvent(
        'researcher',
        'failed',
        'Modelo LLM não disponível'
      ));
      throw new Error('[Researcher] No LLM models available');
    }
    
    const model = models[0];
    const userRequest = state.messages[state.messages.length - 1]?.content || '';
    
    // Get project context
    const projectContext = await getProjectContext();

    // Get cappy tools
    const cappyTools = vscode.lm.tools.filter(tool => tool.name.startsWith('cappy_'));
    
    progressCallback?.(createProgressEvent(
      'researcher',
      'thinking',
      'Analisando melhor estratégia de busca...',
      { toolsAvailable: cappyTools.length }
    ));
    
    const prompt = RESEARCHER_PROMPT.replace('{{projectContext}}', projectContext);

    const messages = [
      vscode.LanguageModelChatMessage.User(prompt),
      vscode.LanguageModelChatMessage.User(`User request: "${userRequest}"\n\nYou MUST use tools to answer. Use cappy_grep_search or cappy_retrieve_context or other relevant tools. DO NOT respond without calling tools first.`)
    ];
    
    // Send with tools available
    const response = await model.sendRequest(messages, { tools: cappyTools });
    
    let fullText = '';
    const toolCalls: Array<{ name: string; input: unknown; callId: string }> = [];
    
    // Process response stream
    for await (const chunk of response.stream) {
      if (chunk instanceof vscode.LanguageModelTextPart) {
        fullText += chunk.value;
      } else if (chunk instanceof vscode.LanguageModelToolCallPart) {
        toolCalls.push({
          name: chunk.name,
          input: chunk.input,
          callId: chunk.callId
        });
      }
    }
    
    // If LLM requested tool calls, execute them
    if (toolCalls.length > 0) {
      progressCallback?.(createProgressEvent(
        'researcher',
        'searching',
        `Executando ${toolCalls.length} ferramenta(s) de busca...`,
        { toolsCount: toolCalls.length }
      ));
      
      for (const toolCall of toolCalls) {
        progressCallback?.(createProgressEvent(
          'researcher',
          'searching',
          `Usando ${toolCall.name}...`,
          { toolUsed: toolCall.name, searchQuery: JSON.stringify(toolCall.input) }
        ));
        try {
          const toolResult = await vscode.lm.invokeTool(
            toolCall.name,
            toolCall.input as vscode.LanguageModelToolInvocationOptions<object>,
            new vscode.CancellationTokenSource().token
          );
          
          // Add tool result to conversation
          messages.push(
            vscode.LanguageModelChatMessage.Assistant([
              new vscode.LanguageModelToolCallPart(toolCall.callId, toolCall.name, toolCall.input as object)
            ])
          );
          messages.push(
            vscode.LanguageModelChatMessage.User([
              new vscode.LanguageModelToolResultPart(toolCall.callId, toolResult.content)
            ])
          );
        } catch (toolError) {
          console.error(`Error invoking tool ${toolCall.name}:`, toolError);
        }
      }
      
      // Get final response after tool execution
      progressCallback?.(createProgressEvent(
        'researcher',
        'analyzing',
        'Analisando resultados da busca...'
      ));
      
      const finalResponse = await model.sendRequest(messages, {});
      fullText = '';
      for await (const chunk of finalResponse.text) {
        fullText += chunk;
      }
    }
    
    // Parse JSON findings (allow extra text before/after the array)
    let parsedText = fullText;
    let findings = parseFindingsArray(parsedText);

    const maxParseAttempts = 2;
    let attempt = 1;

    while (!findings && attempt < maxParseAttempts) {
      const snippet = parsedText.trim().slice(0, 400).replace(/\s+/g, ' ');
      progressCallback?.(createProgressEvent(
        'researcher',
        'thinking',
        'Solicitando resposta no formato esperado...'
      ));

      messages.push(vscode.LanguageModelChatMessage.User(
        `Your previous response could not be parsed as the required JSON array of findings. ` +
        `Respond again using ONLY a JSON array (no prose) with objects like {"source": "code", "content": "...", ` +
        `"relevance": 0.9, "filePath": "path"}. Previous response snippet: ${snippet}`
      ));

      const retryResponse = await model.sendRequest(messages, {});
      parsedText = '';
      for await (const chunk of retryResponse.text) {
        parsedText += chunk;
      }

      findings = parseFindingsArray(parsedText);
      attempt++;
    }

    if (!findings) {
      const snippet = parsedText.trim().slice(0, 400).replace(/\s+/g, ' ');
      progressCallback?.(createProgressEvent(
        'researcher',
        'failed',
        'Não foi possível parsear findings do LLM'
      ));
      console.error('[Researcher] Could not parse LLM findings. Response snippet:', snippet);
      return {
        ...state,
        findings: createFallbackFindings('Response could not be parsed', snippet),
        phase: 'summarize'
      };
    }
    
    progressCallback?.(createProgressEvent(
      'researcher',
      'completed',
      'Pesquisa concluída!',
      { findingsCount: findings.length }
    ));
    
    return {
      ...state,
      findings,
      phase: 'summarize'
    };
  } catch (error) {
    console.error('Researcher LLM error:', error);
    
    const reason = error instanceof Error ? error.message : String(error);
    progressCallback?.(createProgressEvent(
      'researcher',
      'failed',
      `Erro na pesquisa: ${reason}`
    ));
    
    return {
      ...state,
      findings: createFallbackFindings(reason),
      phase: 'summarize'
    };
  }
}

function parseFindingsArray(text: string): ResearcherState['findings'] | null {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (parseError) {
      console.error('[Researcher] JSON parse failed:', parseError);
      return null;
    }
  }

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (parseError) {
      console.error('[Researcher] JSON parse failed on trimmed text:', parseError);
    }
  }

  return null;
}

function createFallbackFindings(reason: string, snippet?: string): ResearcherState['findings'] {
  const details = snippet ? `${snippet}` : 'sem resposta estruturada';
  return [
    {
      source: 'researcher',
      content: `LLM response could not be parsed (${reason}). ${details}`,
      relevance: 0.5
    }
  ];
}
