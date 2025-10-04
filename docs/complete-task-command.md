# Complete Task Command

## Comando: `cappy.completeTask`

### Descrição
Este comando move uma tarefa ativa (arquivo `.ACTIVE.xml`) para o histórico, renomeando-a com a extensão `.DONE.xml` e atualizando suas referências internas.

### Funcionalidade

1. **Localiza tarefa ativa**: Busca por arquivos `.ACTIVE.xml` no diretório `.cappy/tasks/`
2. **Cria diretório de histórico**: Se não existir, cria `.cappy/history/`
3. **Renomeia arquivo**: Substitui `.ACTIVE.xml` por `.DONE.xml`
4. **Atualiza conteúdo**: Modifica referências internas no XML:
   - Nome do arquivo
   - Caminhos de arquivo
   - Status da tarefa (para "concluida")
   - Adiciona timestamp de conclusão
5. **Move para histórico**: Transfer o arquivo de `tasks/` para `history/`
6. **Remove original**: Deleta o arquivo original do diretório `tasks/`

### Exemplo de Uso

#### Antes da execução:
```
.cappy/
├── tasks/
│   └── TASK_20250814123456_.ACTIVE.xml
└── history/
```

#### Conteúdo do arquivo ativo:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<task>
    <metadata>
        <id>TASK_20250814123456</id>
        <file-name>TASK_20250814123456_.ACTIVE.xml</file-name>
        <status>em-andamento</status>
    </metadata>
    <description>Implementar nova funcionalidade</description>
</task>
```

#### Após execução do comando:
```
.cappy/
├── tasks/
└── history/
    └── TASK_20250814123456_.DONE.xml
```

#### Conteúdo do arquivo no histórico:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<task>
    <metadata>
        <id>TASK_20250814123456</id>
        <file-name>TASK_20250814123456_.DONE.xml</file-name>
        <status>concluida</status>
        <completed-at>2025-08-14T20:30:00.000Z</completed-at>
    </metadata>
    <description>Implementar nova funcionalidade</description>
</task>
```

### Retorno do Comando

O comando retorna uma mensagem de sucesso com:
- ✅ Indicador de sucesso
- 📁 Nome do novo arquivo
- 📍 Caminho completo do arquivo no histórico
- ⏰ Timestamp de conclusão

#### Exemplo de retorno:
```
✅ Tarefa movida para histórico com sucesso:
📁 Arquivo: TASK_20250814123456_.DONE.xml
📍 Novo caminho: .cappy/history/TASK_20250814123456_.DONE.xml
⏰ Concluída em: 2025-08-14T20:30:00.000Z
```

### Tratamento de Erros

#### Nenhum workspace aberto:
```
❌ Nenhum workspace aberto
```

#### Nenhuma tarefa ativa encontrada:
```
❌ Nenhuma tarefa ativa encontrada para completar
```

#### Erro durante execução:
```
❌ Erro ao mover tarefa para histórico: [detalhes do erro]
```

### Integração com Copilot

O comando está integrado às instruções do GitHub Copilot através do comando `cappy:taskcomplete`, que:

1. Executa `cappy.completeTask` via VS Code API
2. Lê a saída do arquivo `.cappy/output.txt`
3. Retorna o resultado formatado para o LLM

### Arquivos Relacionados

- **Implementação**: `src/commands/completeTask.ts`
- **Registro**: `src/extension.ts`
- **Testes**: `src/test/suite/completeTask.test.ts`
- **Configuração**: `package.json` (seção contributes.commands)
- **Instruções Copilot**: `.github/copilot-instructions.md`

### Notas Técnicas

- Usa a API nativa do VS Code (`vscode.workspace.fs`) para operações de arquivo
- Suporta múltiplas tarefas ativas (processa a primeira encontrada)
- Preserva a estrutura XML original, apenas atualizando campos específicos
- Cria automaticamente o diretório `history/` se não existir
- Thread-safe para operações de arquivo
