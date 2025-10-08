# 🤖 Cappy Chat - Sistema de Detecção Dinâmica de LLMs

## 📋 Visão Geral

O Cappy Chat agora detecta automaticamente os modelos de linguagem (LLMs) disponíveis no seu ambiente VS Code, permitindo que você escolha qual agente usar para suas conversas.

## 🔍 Fontes de Detecção

### 1. **VS Code Language Model API** (Oficial)
```typescript
vscode.lm.selectChatModels()
```
- Detecta modelos registrados via API oficial do VS Code
- Suporta extensões que implementam a interface `vscode.lm`
- Inclui vendor/provider/family metadata

### 2. **GitHub Copilot**
- Detecta se `github.copilot` ou `github.copilot-chat` estão instalados e ativos
- Oferece:
  - GPT-4 (modelo mais capaz)
  - GPT-3.5 Turbo (rápido e eficiente)

### 3. **Modelos Personalizados** (Configuração do Usuário)
```json
{
  "cappy.chat.customModels": [
    {
      "id": "my-gpt4",
      "name": "My GPT-4 Instance",
      "provider": "openai",
      "apiKey": "sk-...",
      "endpoint": "https://api.openai.com/v1",
      "available": true
    }
  ]
}
```

### 4. **Ollama** (Modelos Locais)
- Detecta se a extensão `continue.continue` está instalada
- Lê modelos configurados em `cappy.chat.ollama.models`
- Exemplos: `llama2`, `codellama`, `mistral`, `deepseek-coder`

```json
{
  "cappy.chat.ollama.models": [
    "llama2",
    "codellama",
    "mistral",
    "deepseek-coder"
  ]
}
```

## 🎨 Interface do Usuário

### Dropdown de Modelos
O dropdown exibe modelos agrupados por provedor com ícones distintos:

- 🧠 **OpenAI** - GPT-4, GPT-3.5 Turbo
- 🎭 **Anthropic** - Claude 3 Opus, Claude 3 Sonnet
- ☁️ **Azure** - Azure OpenAI Service
- 🦙 **Local** - Ollama, LM Studio, etc.

### Estados de Disponibilidade
- ✅ **Disponível** - Modelo pronto para uso
- ⚙️ **Configure API Key** - Requer configuração

## ⚙️ Configuração

### Adicionar Modelo Personalizado

1. Abra as configurações do VS Code (`Ctrl+,`)
2. Procure por "Cappy Chat"
3. Adicione um modelo em `Custom Models`:

```json
{
  "cappy.chat.customModels": [
    {
      "id": "claude-3-opus",
      "name": "Claude 3 Opus",
      "provider": "anthropic",
      "apiKey": "sk-ant-...",
      "available": true
    }
  ]
}
```

### Configurar Ollama

1. Instale Ollama: https://ollama.ai
2. Baixe modelos: `ollama pull llama2`
3. Configure no VS Code:

```json
{
  "cappy.chat.ollama.models": [
    "llama2",
    "codellama:13b",
    "mistral:7b-instruct"
  ]
}
```

## 🔧 Arquitetura Técnica

### Fluxo de Detecção

```typescript
getAvailableModels()
  ├─ VS Code Language Model API
  │  └─ vscode.lm.selectChatModels()
  ├─ GitHub Copilot
  │  └─ vscode.extensions.getExtension('github.copilot')
  ├─ Custom Models
  │  └─ vscode.workspace.getConfiguration('cappy.chat')
  └─ Ollama
     └─ Check 'continue.continue' extension
```

### Provider Detection

```typescript
detectProvider(vendor: string): 'openai' | 'anthropic' | 'local' | 'azure'
```

Analisa metadata do modelo para determinar o provedor:
- `openai`, `gpt` → OpenAI
- `anthropic`, `claude` → Anthropic
- `azure` → Azure
- Outros → Local

## 📡 Comunicação Webview

### Mensagem: `modelsList`

Enviada quando o webview solicita modelos disponíveis:

```typescript
{
  type: 'modelsList',
  models: [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      available: true
    },
    // ...
  ]
}
```

### JavaScript: `updateModelsList(models)`

Atualiza o dropdown dinamicamente com os modelos recebidos:

```javascript
function updateModelsList(models) {
  const modelDropdown = document.getElementById('modelDropdown');
  modelDropdown.innerHTML = '';
  
  models.forEach(model => {
    // Criar opção para cada modelo
    const option = createModelOption(model);
    modelDropdown.appendChild(option);
  });
}
```

## 🎯 Uso no Chat

1. **Abrir Cappy Chat**: Sidebar esquerda ou `Ctrl+Shift+P` → "Cappy: Open Chat"
2. **Clicar no modelo atual** (ex: "GPT-4") para abrir dropdown
3. **Selecionar novo modelo** da lista
4. **Digitar prompt** e enviar
5. O agente selecionado processará a requisição

## 🔮 Modelos Suportados

### OpenAI
- GPT-4, GPT-4 Turbo
- GPT-3.5 Turbo
- Custom deployments

### Anthropic
- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku

### Local (Ollama)
- Llama 2, 3
- CodeLlama
- Mistral
- DeepSeek Coder
- Phi-2, Phi-3

### Azure
- Azure OpenAI Service
- Custom endpoints

## 📊 Debug

Para ver os modelos detectados, abra o console do desenvolvedor:

```javascript
console.log('🤖 Available LLM models:', models);
```

Ou verifique os logs da extensão:
- `Ctrl+Shift+P` → "Developer: Show Extension Host"
- Procure por logs `ChatProvider`

## 🚀 Próximos Passos

- [ ] Integração real com APIs dos provedores
- [ ] Cache de respostas
- [ ] Streaming de respostas
- [ ] Multi-turn conversations com contexto
- [ ] Fine-tuning de modelos locais
- [ ] Métricas de custo por modelo

## 📝 Exemplos de Uso

### Usar GPT-4 para explicação de código
```
Modelo: GPT-4
Prompt: "Explain this React component"
```

### Usar Claude 3 para refatoração
```
Modelo: Claude 3 Opus
Prompt: "Refactor this function to be more maintainable"
```

### Usar Llama local para testes
```
Modelo: Ollama: llama2
Prompt: "Generate unit tests for this class"
```

## 🦫 Filosofia Cappy

> **Escolha seu agente, mantenha seu contexto**

O Cappy Chat permite que você escolha o melhor modelo para cada tarefa, mantendo todo o contexto e ferramentas do Cappy disponíveis independente do modelo selecionado.
