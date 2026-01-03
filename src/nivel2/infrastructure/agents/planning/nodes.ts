/**
 * @fileoverview Planning Agent Nodes - Each node handles a specific phase
 */

import * as vscode from 'vscode';
import type { PlanningState, TaskPlan, ScopeQuestion } from './state';
import { LLMSelector } from '../../services/llm-selector';

// ============================================================================
// Helper Functions
// ============================================================================

function getLastMessage(state: PlanningState): string {
  return state.messages[state.messages.length - 1]?.content || '';
}

async function readLLMResponse(response: vscode.LanguageModelChatResponse): Promise<string> {
  let result = '';
  for await (const chunk of response.text as AsyncIterable<unknown>) {
    if (typeof chunk === 'string') {
      result += chunk;
    } else if (chunk && typeof chunk === 'object' && 'value' in (chunk as any)) {
      result += (chunk as any).value;
    }
  }
  return result;
}

async function readFileContent(filePath: string): Promise<string | null> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return null;
    
    const uri = filePath.startsWith('/') 
      ? vscode.Uri.file(filePath)
      : vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString('utf8');
  } catch {
    return null;
  }
}

// ============================================================================
// Node: Collect Scope
// ============================================================================

export async function collectScope(state: PlanningState): Promise<Partial<PlanningState>> {
  state.progressCallback?.('🎯 Entendendo o escopo...');

  const lastMessage = getLastMessage(state);
  const model = await LLMSelector.selectBestModel();
  if (!model) throw new Error('No LLM available');

  // Check if this is first message or continuing conversation
  const questionCount = state.scopeQuestions?.length || 0;
  const existingPlan = state.taskPlan;

  // REGRA: Máximo 2 perguntas de clarificação, depois avança
  const forceAdvance = questionCount >= 2;

  const prompt = `Você é Cappy, um assistente de planejamento de tarefas de desenvolvimento.

SEU OBJETIVO: Criar um plano de task XML com as informações disponíveis.

⚠️ REGRA CRÍTICA DE DECISÃO:
- SÓ faça pergunta se sua confiança na decisão for < 55%
- Se você consegue inferir a resposta, NÃO pergunte
- ${forceAdvance ? 'VOCÊ JÁ FEZ PERGUNTAS SUFICIENTES. Avance com o que tem!' : 'Máximo 2 perguntas de clarificação no total'}
- Prefira ASSUMIR baseado no contexto do que perguntar
- Use seu conhecimento geral para preencher lacunas

CONTEXTO DO PROJETO:
- Projeto: ${state.workspaceContext?.projectName || 'Unknown'}
- Tipo: ${state.workspaceContext?.projectType || 'Unknown'}
- Linguagem: ${state.workspaceContext?.mainLanguage || 'Unknown'}
- Arquivos abertos: ${state.workspaceContext?.openFiles.slice(0, 5).join(', ') || 'none'}

${existingPlan ? `PLANO ATUAL EM CONSTRUÇÃO:
${JSON.stringify(existingPlan, null, 2)}` : ''}

PERGUNTAS JÁ FEITAS: ${questionCount}

MENSAGEM DO USUÁRIO: ${lastMessage}

HISTÓRICO:
${state.messages.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}

RESPONDA EM JSON:
{
  "understood": {
    "title": "título claro da tarefa",
    "category": "feature|bugfix|refactor|docs|test|chore",
    "description": "descrição do que precisa ser feito",
    "context": "por que essa tarefa é necessária"
  },
  "confidence": 0.0-1.0,
  "nextQuestion": "pergunta ÚNICA e ESSENCIAL (ou null se confiança > 55% ou já fez 2 perguntas)",
  "readyToAnalyze": boolean,
  "suggestedFiles": ["arquivos que provavelmente serão relevantes"]
}

${forceAdvance ? 'readyToAnalyze DEVE ser true. Não faça mais perguntas!' : 'Se confidence > 0.55 OU já fez 2+ perguntas, readyToAnalyze = true'}`;

  const response = await model.sendRequest([
    vscode.LanguageModelChatMessage.User(prompt)
  ], {});

  const raw = await readLLMResponse(response);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      response: 'Desculpe, não consegui processar. Pode me explicar novamente o que você quer desenvolver?'
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Update task plan with understood info
    const updatedPlan: Partial<TaskPlan> = {
      ...existingPlan,
      ...(parsed.understood?.title && { title: parsed.understood.title }),
      ...(parsed.understood?.category && { category: parsed.understood.category }),
      ...(parsed.understood?.description && { description: parsed.understood.description }),
      ...(parsed.understood?.context && { context: parsed.understood.context })
    };

    // Track questions asked
    const newQuestions: ScopeQuestion[] = parsed.nextQuestion ? [
      ...(state.scopeQuestions || []),
      {
        id: `q-${questionCount}`,
        question: parsed.nextQuestion,
        answered: false
      }
    ] : (state.scopeQuestions || []);

    // Confiança alta ou limite de perguntas atingido = avançar
    const confidence = parsed.confidence || 0.5;
    const shouldAdvance = parsed.readyToAnalyze || confidence > 0.55 || forceAdvance;

    if (shouldAdvance) {
      return {
        taskPlan: updatedPlan,
        scopeQuestions: newQuestions,
        phase: 'analyzing_codebase',
        codebaseInfo: {
          ...state.codebaseInfo,
          relevantFiles: parsed.suggestedFiles || []
        },
        response: `✅ Entendi! Vou analisar o código para criar um plano detalhado.\n\n**Tarefa:** ${updatedPlan.title}\n**Categoria:** ${updatedPlan.category}\n\nAnalisando arquivos relevantes...`
      };
    }

    // Só faz pergunta se realmente necessário
    return {
      taskPlan: updatedPlan,
      scopeQuestions: newQuestions,
      response: parsed.nextQuestion
    };

  } catch (e) {
    console.error('[CollectScope] Parse error:', e);
    return {
      response: 'Desculpe, tive um problema. Pode reformular o que você quer desenvolver?'
    };
  }
}

// ============================================================================
// Node: Analyze Codebase
// ============================================================================

export async function analyzeCodebase(state: PlanningState): Promise<Partial<PlanningState>> {
  state.progressCallback?.('🔍 Analisando código...');

  const relevantFiles = state.codebaseInfo?.relevantFiles || [];
  const codeSnippets: Record<string, string> = {};
  
  // Read content from relevant files
  for (const file of relevantFiles.slice(0, 5)) {
    const content = await readFileContent(file);
    if (content) {
      // Truncate to first 100 lines
      codeSnippets[file] = content.split('\n').slice(0, 100).join('\n');
    }
  }

  // Also check for README and package.json
  const readme = await readFileContent('README.md');
  const packageJson = await readFileContent('package.json');

  if (readme) codeSnippets['README.md'] = readme.slice(0, 2000);
  if (packageJson) codeSnippets['package.json'] = packageJson;

  return {
    codebaseInfo: {
      ...state.codebaseInfo,
      codeSnippets
    },
    phase: 'drafting_plan'
  };
}

// ============================================================================
// Node: Draft Plan
// ============================================================================

export async function draftPlan(state: PlanningState): Promise<Partial<PlanningState>> {
  state.progressCallback?.('📝 Criando plano...');

  const model = await LLMSelector.selectBestModel();
  if (!model) throw new Error('No LLM available');

  const codeContext = Object.entries(state.codebaseInfo?.codeSnippets || {})
    .map(([file, content]) => `### ${file}\n\`\`\`\n${content.slice(0, 1000)}\n\`\`\``)
    .join('\n\n');

  const prompt = `Você é um arquiteto de software experiente. Crie um plano de implementação detalhado.

TAREFA:
- Título: ${state.taskPlan?.title}
- Categoria: ${state.taskPlan?.category}
- Descrição: ${state.taskPlan?.description}
- Contexto: ${state.taskPlan?.context}

CÓDIGO DO PROJETO:
${codeContext || 'Nenhum código disponível'}

CRIE UM PLANO DETALHADO EM JSON:
{
  "title": "título refinado",
  "category": "${state.taskPlan?.category || 'feature'}",
  "description": "descrição completa",
  "context": "contexto detalhado",
  "acceptanceCriteria": [
    "critério 1 - específico e mensurável",
    "critério 2 - específico e mensurável"
  ],
  "steps": [
    {
      "id": "STEP-1",
      "title": "título do passo",
      "description": "o que fazer detalhadamente",
      "files": ["arquivo1.ts", "arquivo2.ts"],
      "validation": "como validar este passo"
    }
  ],
  "relatedFiles": ["arquivos relacionados"],
  "preventionRules": ["regras para evitar erros comuns"]
}

REGRAS:
- Máximo 5 passos principais
- Cada passo deve ser atômico e testável
- Referência arquivos específicos quando possível
- Critérios de aceitação devem ser verificáveis`;

  const response = await model.sendRequest([
    vscode.LanguageModelChatMessage.User(prompt)
  ], {});

  const raw = await readLLMResponse(response);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      response: 'Não consegui criar o plano. Vamos tentar novamente?',
      phase: 'collecting_scope'
    };
  }

  try {
    const plan = JSON.parse(jsonMatch[0]) as TaskPlan;
    
    // Format plan for user confirmation
    const planSummary = `## 📋 Plano de Task: ${plan.title}

**Categoria:** ${plan.category}

### Descrição
${plan.description}

### Contexto
${plan.context}

### Critérios de Aceitação
${plan.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### Passos de Implementação
${plan.steps.map(s => `
**${s.id}: ${s.title}**
- ${s.description}
- Arquivos: ${s.files?.join(', ') || 'N/A'}
- Validação: ${s.validation || 'N/A'}
`).join('\n')}

### Arquivos Relacionados
${plan.relatedFiles.map(f => `- ${f}`).join('\n')}

---
✅ **Confirma a criação do arquivo de task com este plano?** (sim/não/ajustar)`;

    return {
      taskPlan: plan,
      phase: 'confirming_plan',
      response: planSummary
    };

  } catch (e) {
    console.error('[DraftPlan] Parse error:', e);
    return {
      response: 'Erro ao processar o plano. Vamos tentar novamente?',
      phase: 'collecting_scope'
    };
  }
}

// ============================================================================
// Node: Confirm Plan
// ============================================================================

export async function confirmPlan(state: PlanningState): Promise<Partial<PlanningState>> {
  state.progressCallback?.('🤔 Aguardando confirmação...');

  const lastMessage = getLastMessage(state).toLowerCase();
  
  // Check for confirmation
  const isConfirmed = /^(sim|yes|ok|confirma|criar|gerar|s|y)/.test(lastMessage);
  const wantsAdjust = /^(ajust|modific|alter|mud|edit|não|no|n)/.test(lastMessage);

  if (isConfirmed) {
    return {
      phase: 'creating_task'
    };
  }

  if (wantsAdjust) {
    return {
      phase: 'collecting_scope',
      response: 'Ok! O que você gostaria de ajustar no plano?'
    };
  }

  // Not clear, ask again
  return {
    response: 'Por favor, confirme se o plano está ok:\n- **sim** para criar o arquivo de task\n- **não** ou descreva o que quer ajustar'
  };
}

// ============================================================================
// Node: Create Task File
// ============================================================================

export async function createTaskFile(state: PlanningState): Promise<Partial<PlanningState>> {
  state.progressCallback?.('📄 Criando arquivo de task...');

  const plan = state.taskPlan as TaskPlan;
  
  if (!plan.title || !plan.category) {
    return {
      phase: 'collecting_scope',
      response: 'Faltam informações essenciais. Vamos recomeçar?'
    };
  }

  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return {
        response: '❌ Nenhum workspace aberto. Abra uma pasta primeiro.'
      };
    }

    // Generate task ID and filename
    const timestamp = Date.now();
    const slug = plan.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    
    const taskId = `task_${new Date().toISOString().split('T')[0]}_${timestamp}_${slug}`;
    const fileName = `${taskId}.ACTIVE.xml`;

    // Create tasks directory
    const tasksDir = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'tasks');
    try {
      await vscode.workspace.fs.createDirectory(tasksDir);
    } catch { /* may exist */ }

    // Generate XML content
    const now = new Date().toISOString();
    const xmlContent = generateTaskXML(taskId, plan, now);

    // Write file
    const taskUri = vscode.Uri.joinPath(tasksDir, fileName);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(taskUri, encoder.encode(xmlContent));

    // Open the file
    const document = await vscode.workspace.openTextDocument(taskUri);
    await vscode.window.showTextDocument(document);

    return {
      taskCreated: true,
      phase: 'completed',
      response: `✅ **Task criada com sucesso!**

📄 Arquivo: \`.cappy/tasks/${fileName}\`

O arquivo foi aberto no editor. Você pode:
1. Revisar e ajustar os detalhes
2. Marcar como pronta removendo ".ACTIVE" do nome
3. Usar como referência para implementação

**Próximos passos:**
- Execute \`cappy.workOnCurrentTask\` quando quiser começar a implementar
- O agente vai usar este plano como guia`
    };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      response: `❌ Erro ao criar arquivo: ${errMsg}`
    };
  }
}

// ============================================================================
// Helper: Generate Task XML
// ============================================================================

function generateTaskXML(taskId: string, plan: TaskPlan, timestamp: string): string {
  const stepsXML = plan.steps.map(step => `
      <step id="${step.id}">
        <title>${escapeXML(step.title)}</title>
        <description>${escapeXML(step.description)}</description>
        <files>
          ${(step.files || []).map(f => `<file>${escapeXML(f)}</file>`).join('\n          ')}
        </files>
        <validation>${escapeXML(step.validation || '')}</validation>
      </step>`).join('\n');

  const criteriaXML = plan.acceptanceCriteria
    .map((c, i) => `      <criterion id="AC-${i + 1}">${escapeXML(c)}</criterion>`)
    .join('\n');

  const relatedFilesXML = plan.relatedFiles
    .map(f => `      <file path="${escapeXML(f)}" relevance="high" />`)
    .join('\n');

  const preventionXML = (plan.preventionRules || [])
    .map(r => `      <rule>${escapeXML(r)}</rule>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
╔══════════════════════════════════════════════════════════════════════════════╗
║                           CAPPY TASK FILE                                    ║
║  Generated by Cappy Planning Agent                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
-->
<task xmlns="http://cappy.dev/schemas/task/2.0">
  
  <metadata>
    <id>${taskId}</id>
    <category>${plan.category}</category>
    <title>${escapeXML(plan.title)}</title>
    <description>
      ${escapeXML(plan.description)}
    </description>
    <context>
      ${escapeXML(plan.context)}
    </context>
    <createdAt>${timestamp}</createdAt>
    <updatedAt>${timestamp}</updatedAt>
    <status>active</status>
  </metadata>

  <requirements>
    <acceptanceCriteria>
${criteriaXML}
    </acceptanceCriteria>
  </requirements>

  <implementation>
    <steps>
${stepsXML}
    </steps>
  </implementation>

  <context>
    <relatedFiles>
${relatedFilesXML}
    </relatedFiles>
    
    <preventionRules>
${preventionXML}
    </preventionRules>
  </context>

</task>
`;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
