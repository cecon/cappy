# 🔗 CappyChain - LangChain para VS Code

Sistema de pipelines de IA inteligentes que permite orquestrar múltiplas operações sequenciais no VS Code.

## 🎯 O que é o CappyChain?

O CappyChain é uma implementação inspirada no LangChain que permite criar **workflows inteligentes** dentro do VS Code, combinando:

- **LLM Calls** - Chamadas para modelos de IA (Copilot, etc.)
- **Tool Executions** - Execução de comandos Cappy 
- **Conditional Logic** - Lógica condicional para fluxos dinâmicos
- **Data Transformations** - Transformações de dados entre steps
- **Parallel Execution** - Execução paralela de operações

## 🚀 Como Usar

### 1. **Detecção Automática no Chat**

Simplesmente digite no chat do Cappy:

```
"Analyze this code and suggest improvements"
```

O CappyChain detecta automaticamente e executa a chain **Code Analysis** que:
1. Analisa qualidade do código selecionado
2. Verifica se há problemas
3. Se há problemas → Cria task de refatoração
4. Se não há → Gera feedback positivo

### 2. **Command Palette**

- `Ctrl+Shift+P` → `Cappy: Execute Chain`
- `Ctrl+Shift+P` → `Cappy: Execute Chain with Selection`

### 3. **Programmaticamente**

```typescript
import { ChainExecutor } from './core/langchain/chainExecutor';

const executor = ChainExecutor.getInstance();
const result = await executor.executeTemplate('code-analysis-chain', selectedCode);
```

## 🔧 Chains Disponíveis

### 📊 **Code Analysis Chain**
- **Trigger**: "analyze", "code quality", "refactor", "review"
- **Fluxo**: Análise → Verificação → Task/Feedback
- **Output**: Task de refatoração ou feedback positivo

### 🆕 **Feature Implementation Chain**  
- **Trigger**: "implement", "feature", "new functionality", "add"
- **Fluxo**: Análise de requisitos → Breakdown → Task principal → Testes
- **Output**: Tasks estruturadas para implementação completa

### 🐛 **Debug Chain**
- **Trigger**: "debug", "fix", "error", "bug", "problem"  
- **Fluxo**: Análise do problema → Busca código relacionado → Sugestão de fix → Task
- **Output**: Task de bugfix com solução específica

### 📝 **Documentation Chain**
- **Trigger**: "document", "docs", "documentation", "readme"
- **Fluxo**: Análise do código → Geração API docs → User guide → Formatação
- **Output**: Documentação completa

### ⚡ **Performance Optimization Chain**
- **Trigger**: "optimize", "performance", "slow", "speed up"
- **Fluxo**: Profile performance → Sugestões → Task de otimização
- **Output**: Task com melhorias específicas

## 🏗️ Arquitetura

### **Chain Nodes**

```typescript
// LLM Node - Chama modelo de IA
ChainNodeFactory.createLLMNode('analyze-code', 'Analyze Code', {
    model: 'copilot-gpt-4',
    prompt: 'Analyze this code: {{input}}',
    systemMessage: 'You are a code review expert'
});

// Tool Node - Executa comando VS Code/Cappy
ChainNodeFactory.createToolNode('create-task', 'Create Task', {
    toolName: 'cappy.createTaskFile',
    parameters: { title: '{{title}}', area: 'refactor' }
});

// Condition Node - Lógica condicional
ChainNodeFactory.createConditionNode('check-issues', 'Check Issues', {
    condition: '{{result}} contains "problems"',
    truePath: 'create-task',
    falsePath: 'good-code'
});
```

### **Context Variables**

Cada chain tem acesso a:
- `{{currentFile}}` - Arquivo atual
- `{{selection}}` - Texto selecionado  
- `{{workspace}}` - Path do workspace
- `{{input}}` - Input do usuário
- `{{step_result}}` - Resultado de steps anteriores

## 📊 Exemplo de Execução

```
🔗 Starting chain: Code Analysis & Refactoring
🔄 Executing node: Analyze Code Quality (llm)
✅ Node completed: Analyze Code Quality (1250ms)
🔄 Executing node: Check if Issues Found (condition)  
✅ Node completed: Check if Issues Found (15ms)
🔄 Executing node: Create Refactoring Task (tool)
✅ Node completed: Create Refactoring Task (340ms)
✅ Chain completed: Code Analysis & Refactoring
```

## 🎨 Criando Custom Chains

```typescript
import { ChainDefinition, ChainNodeFactory } from './core/langchain';

const customChain: ChainDefinition = {
    id: 'custom-workflow',
    name: 'My Custom Workflow',
    description: 'Custom workflow description',
    startNode: 'first-step',
    variables: { myVar: 'default' },
    nodes: [
        ChainNodeFactory.createLLMNode('first-step', 'First Step', {
            model: 'copilot-gpt-4',
            prompt: 'Process this: {{input}}'
        }),
        // ... more nodes
    ]
};

const executor = ChainExecutor.getInstance();
await executor.executeChain(customChain, userInput);
```

## 🔍 Debugging Chains

### **Output Channel**
- View → Output → "Cappy Chains"
- Logs detalhados de execução
- Timing de cada step
- Resultados intermediários

### **Results Webview**
- Mostra resultado final + histórico completo
- Timeline visual de execução
- Debug de steps que falharam

## ⚙️ Configuração

### **VS Code Settings**

```json
{
    "cappy.chains.autoDetect": true,
    "cappy.chains.showResults": true,
    "cappy.chains.defaultModel": "copilot-gpt-4"
}
```

### **Chain Variables**

Passe variáveis customizadas:

```typescript
await executor.executeTemplate('feature-implementation-chain', input, {
    complexity: 'high',
    deadline: '1 week'
});
```

## 🚀 Benefícios

### ✅ **Automação Inteligente**
- Workflows complexos executados com uma frase
- Detecção automática do workflow apropriado
- Orquestração de múltiplas ferramentas

### ✅ **Consistência**
- Processos padronizados para cenários comuns
- Sempre seguem best practices
- Reduzem erro humano

### ✅ **Eficiência**
- Múltiplas operações em uma execução
- Paralelização quando possível
- Cache e reutilização de resultados

### ✅ **Extensibilidade**
- Fácil criação de chains customizadas
- Reutilização de nodes existentes
- Integração com ferramentas Cappy

## 🎯 Casos de Uso

### **Code Review Automatizado**
```
"Review this pull request for security issues"
→ Code Analysis Chain → Security Task
```

### **Feature Development**
```
"Implement user authentication with JWT"
→ Feature Implementation Chain → Multiple Tasks
```

### **Bug Investigation**
```
"Debug this memory leak in the service"
→ Debug Chain → Investigation Task + Fix
```

### **Documentation Generation**
```
"Document this API endpoint"
→ Documentation Chain → API docs + Examples
```

## 🔮 Roadmap

- [ ] **Visual Chain Builder** - GUI para criar chains
- [ ] **Chain Templates Store** - Biblioteca de chains da comunidade
- [ ] **A/B Testing** - Teste diferentes versões de chains
- [ ] **Performance Analytics** - Métricas de eficiência
- [ ] **External Integrations** - GitHub, Jira, Slack, etc.
- [ ] **Chain Composition** - Chains que chamam outras chains

---

**🦫 CappyChain** - Transforme seu VS Code em uma plataforma de automação inteligente! 🚀