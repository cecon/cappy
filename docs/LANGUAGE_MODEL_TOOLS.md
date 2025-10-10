# 🛠️ Language Model Tools - Teste

A extensão Cappy agora tem **Language Model Tools** integradas! O chat pode criar arquivos, executar comandos e muito mais.

## ✅ Ferramenta Implementada

### 1. Create File Tool (`cappy_create_file`)

**O que faz:** Cria novos arquivos no workspace com conteúdo especificado

**Como testar:**

1. Abra o chat (ícone do robô na sidebar)
2. Digite: **"crie um arquivo todo.md com uma lista de tarefas"**
3. O modelo deve:
   - Detectar que precisa criar um arquivo
   - Chamar a ferramenta `cappy_create_file`
   - VS Code mostrará um dialog de confirmação
   - Arquivo será criado e aberto automaticamente

**Exemplos de comandos:**

```
"crie um arquivo hello.txt com o texto Hello World"
"gere um README.md para este projeto"
"crie um componente React em src/components/Button.tsx"
"faça um arquivo .gitignore com as regras padrão para Node.js"
```

## 🔧 Como Funciona

### 1. Registro no package.json

```json
"languageModelTools": [
  {
    "name": "cappy_create_file",
    "displayName": "Create File",
    "modelDescription": "Creates a new file in the workspace...",
    "inputSchema": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "content": { "type": "string" }
      },
      "required": ["path", "content"]
    }
  }
]
```

### 2. Implementação da Tool

`src/adapters/secondary/tools/create-file-tool.ts`

```typescript
export class CreateFileTool implements vscode.LanguageModelTool<CreateFileInput> {
  async invoke(options, token): Promise<LanguageModelToolResult> {
    // 1. Valida workspace
    // 2. Cria arquivo com fs.writeFile
    // 3. Abre arquivo no editor
    // 4. Retorna resultado
  }

  async prepareInvocation(options, token): Promise<PreparedToolInvocation> {
    // Mostra mensagem de confirmação ao usuário
    return {
      invocationMessage: `Creating file: ${path}`,
      confirmationMessages: {
        title: 'Create File',
        message: `Create file ${path}?`
      }
    }
  }
}
```

### 3. Registro no extension.ts

```typescript
const createFileTool = vscode.lm.registerTool('cappy_create_file', new CreateFileTool());
context.subscriptions.push(createFileTool);
```

## 🎯 Fluxo de Execução

```
Usuário: "crie um arquivo todo.md"
    ↓
Copilot detecta necessidade de ferramenta
    ↓
Chama cappy_create_file com:
{
  path: "todo.md",
  content: "# TODO\n\n- [ ] Task 1\n- [ ] Task 2"
}
    ↓
VS Code mostra dialog de confirmação
    ↓
Usuário clica "Allow"
    ↓
CreateFileTool.invoke() executa
    ↓
Arquivo criado e aberto
    ↓
Tool retorna sucesso
    ↓
Copilot responde: "✅ File created successfully: todo.md"
```

## 🔐 Segurança

### Confirmação do Usuário

- Toda criação de arquivo requer confirmação
- Implementado em `prepareInvocation()`
- Dialog mostra caminho do arquivo que será criado

### Validações

- ✅ Verifica se workspace está aberto
- ✅ Verifica se arquivo já existe (não sobrescreve)
- ✅ Usa caminhos relativos ao workspace
- ✅ Tratamento de erros com mensagens claras

## 📊 Debug

### Ver Tool Calls no Console

1. Abra Developer Tools: **Help > Toggle Developer Tools**
2. Vá para aba **Console**
3. Procure por: `✅ Registered Language Model Tool: cappy_create_file`

### Logs da Ferramenta

Durante a execução, você verá:
```
Creating file: todo.md
✅ File created successfully: todo.md
```

Ou em caso de erro:
```
❌ No workspace folder open
❌ File already exists: todo.md
❌ Error creating file: [error message]
```

## 🚀 Próximas Ferramentas

Planejadas para implementação:

1. **Read File Tool** - Ler conteúdo de arquivos
2. **Edit File Tool** - Modificar arquivos existentes
3. **Search Files Tool** - Buscar arquivos por nome/padrão
4. **Search Text Tool** - Buscar texto no workspace
5. **Execute Terminal Tool** - Executar comandos
6. **Create Directory Tool** - Criar pastas
7. **Rename/Move Tool** - Renomear/mover arquivos
8. **Delete Tool** - Deletar arquivos (com confirmação)

## 🔄 Fluxo Completo com Tool Invocation

```typescript
// 1. Enviar mensagens com tools disponíveis
const tools = vscode.lm.tools.filter(t => t.name.startsWith('cappy_'))
const response = await model.sendRequest(messages, { tools }, token)

// 2. Processar stream - detectar tool calls
for await (const part of response.stream) {
  if (part instanceof vscode.LanguageModelToolCallPart) {
    // 3. Invocar a tool
    const result = await vscode.lm.invokeTool(part.name, {
      input: part.input,
      toolInvocationToken: undefined
    }, token)
    
    // 4. Adicionar resultado à conversa
    messages.push(vscode.LanguageModelChatMessage.Assistant([part]))
    messages.push(vscode.LanguageModelChatMessage.User([
      new vscode.LanguageModelToolResultPart(part.callId, result.content)
    ]))
    
    // 5. Continuar conversa com resultado
    const followUp = await model.sendRequest(messages, { tools }, token)
  }
}
```

## ❓ Troubleshooting

### Tool não é chamada

**Causa Corrigida:** O código anterior não passava `tools` no `sendRequest`

**Solução Implementada:**
- Agora pegamos ferramentas com `vscode.lm.tools`
- Filtramos ferramentas Cappy (`cappy_*`)
- Passamos no `options: { tools: cappyTools }`

**Se ainda não funcionar:**
- Tente ser mais específico: "use a ferramenta de criar arquivo para..."
- Verifique console: `🛠️ Available Cappy tools: cappy_create_file`

### Confirmação não aparece

**Solução:**
- Verifique se `prepareInvocation()` está implementado
- Dialog pode estar atrás de outras janelas

### Erro "No workspace folder open"

**Solução:**
- Abra uma pasta no VS Code: **File > Open Folder**
- Ferramentas só funcionam com workspace aberto

### Arquivo não é criado

**Debug:**
1. Verifique console (Developer Tools)
2. Veja se há erros de permissão
3. Confirme que caminho é válido

## 📚 Referências

- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [Language Model Tools](https://code.visualstudio.com/api/references/vscode-api#LanguageModelTool)
- [Tool Invocation](https://code.visualstudio.com/api/references/vscode-api#LanguageModelToolInvocationOptions)

## 🎉 Testando Agora

1. **Reinicie o VS Code** (importante para carregar a nova tool)
2. Abra uma pasta/workspace
3. Abra o chat Cappy (ícone do robô)
4. Digite: **"crie um arquivo test.txt com o texto teste"**
5. Confirme quando aparecer o dialog
6. Veja o arquivo sendo criado e aberto!

Se funcionar, parabéns! 🎊 A primeira ferramenta está operacional!
