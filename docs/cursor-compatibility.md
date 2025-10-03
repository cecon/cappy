# Compatibilidade com Cursor

## Visão Geral

O CAPPY é totalmente compatível com o [Cursor](https://cursor.sh/), o editor de código com IA integrada. Todas as funcionalidades do CAPPY funcionam perfeitamente no Cursor, aproveitando sua poderosa integração com IA.

## Instalação no Cursor

### Método 1: Via VSIX (Recomendado)

1. Baixe o arquivo `.vsix` mais recente da extensão
2. No Cursor, abra a paleta de comandos (`Ctrl+Shift+P` ou `Cmd+Shift+P`)
3. Digite "Extensions: Install from VSIX..."
4. Selecione o arquivo `.vsix` baixado

### Método 2: Via Marketplace do VS Code

Como o Cursor é compatível com extensões do VS Code, você pode instalar diretamente:

```bash
# Via linha de comando
cursor --install-extension eduardocecon.cappy
```

Ou use a interface de extensões do Cursor:
1. Abra a aba de extensões (ícone de blocos ou `Ctrl+Shift+X`)
2. Pesquise por "Cappy"
3. Clique em "Install"

## Configuração Inicial

Após a instalação, inicialize o CAPPY no seu projeto:

1. Abra a paleta de comandos (`Ctrl+Shift+P`)
2. Digite "Cappy: Initialize Project"
3. Siga as instruções na tela

O CAPPY criará a estrutura de diretórios `.cappy` no seu projeto:

```
.cappy/
├── schemas/          # Schemas XSD para validação
├── tasks/           # Tarefas ativas
├── history/         # Histórico de tarefas completadas
└── stack.md         # Conhecimento da arquitetura do projeto
```

## Funcionalidades no Cursor

### Integração com IA do Cursor

O CAPPY funciona perfeitamente com os recursos de IA do Cursor:

- **Composer**: Use o CAPPY para gerenciar tarefas enquanto o Composer gera código
- **Chat**: Consulte tarefas ativas via comandos CAPPY durante conversas com a IA
- **Inline Edits**: Prevention Rules do CAPPY ajudam a guiar edições inline

### Comandos Disponíveis

Todos os comandos do CAPPY estão disponíveis no Cursor via paleta de comandos:

| Comando | Descrição |
|---------|-----------|
| `🦫 Initialize Cappy` | Inicializa o CAPPY no projeto |
| `🧠 Cappy: KnowStack` | Carrega o contexto do projeto |
| `🧩 Cappy: New Task` | Cria uma nova tarefa |
| `📄 Cappy: Get Active Task` | Obtém a tarefa ativa |
| `✅ Cappy: Complete Task` | Marca tarefa como concluída |
| `🔄 Cappy: Change Task Status` | Altera status da tarefa |
| `🎯 Cappy: Work on Current Task` | Trabalha na tarefa atual |
| `➕ Cappy: Add Prevention Rule` | Adiciona regra de prevenção |
| `➖ Cappy: Remove Prevention Rule` | Remove regra de prevenção |
| `🔄 Cappy: Reindex Files` | Reconstrói índices semânticos |

### Workflow Recomendado no Cursor

1. **Inicialize o projeto**:
   ```
   Ctrl+Shift+P > Cappy: Initialize Project
   ```

2. **Mapeie sua arquitetura**:
   - Use o Composer ou Chat do Cursor para analisar sua estrutura
   - Execute `Cappy: KnowStack` para capturar o contexto

3. **Crie tarefas inteligentes**:
   - Use `Cappy: New Task` ou peça ao Chat do Cursor:
     ```
     "Crie uma nova tarefa para adicionar autenticação JWT"
     ```

4. **Trabalhe com contexto**:
   - Execute `Cappy: Work on Current Task`
   - O CAPPY fornecerá contexto relevante automaticamente

5. **Aprenda com erros**:
   - Adicione Prevention Rules quando encontrar problemas
   - Use `Cappy: Add Prevention Rule` para documentar soluções

## Detecção Automática de Ambiente

O CAPPY detecta automaticamente se está rodando no Cursor e ajusta suas mensagens:

```typescript
// O CAPPY identifica o ambiente
"🦫 Cappy Memory: Activating in Cursor..."
```

## Diferenças e Considerações

### API Compatível

O CAPPY usa a API padrão do VS Code, que é totalmente suportada pelo Cursor:
- `vscode.window` - Funciona perfeitamente
- `vscode.commands` - Totalmente compatível
- `vscode.workspace` - Sem problemas
- `vscode.extensions` - Suportado

### Recursos Específicos do Cursor

Enquanto o CAPPY funciona igualmente bem em ambos editores, você pode combinar com recursos exclusivos do Cursor:

- **Cursor Rules**: Use Prevention Rules do CAPPY como base para `.cursorrules`
- **Codebase Indexing**: Combine com o indexing do CAPPY para melhor contexto
- **AI Features**: O contexto do CAPPY melhora as respostas da IA do Cursor

## Exemplo de Integração

### Usando CAPPY com Cursor Composer

```typescript
// 1. Inicialize o CAPPY
// Paleta: Cappy: Initialize Project

// 2. Crie uma tarefa via Composer
// No Composer do Cursor:
"Preciso implementar um sistema de cache Redis.
Por favor, use o CAPPY para criar e gerenciar esta tarefa."

// 3. O CAPPY organizará:
// - Contexto da arquitetura
// - Prevention rules relevantes
// - Estrutura da tarefa em XML

// 4. Trabalhe com contexto automático
// Paleta: Cappy: Work on Current Task
```

## Configurações

As mesmas configurações do VS Code funcionam no Cursor:

```json
{
  "cappy.autoUpdateCopilotContext": true,
  "cappy.maxPreventionRules": 50,
  "cappy.taskTimeEstimation": true,
  "cappy.showNotifications": true
}
```

Acesse via `Ctrl+,` (Preferências) e busque por "Cappy".

## Troubleshooting

### Extensão não aparece

1. Verifique se o arquivo `.vsix` foi instalado corretamente
2. Reinicie o Cursor
3. Verifique a aba de extensões

### Comandos não funcionam

1. Certifique-se de que inicializou o projeto (`Cappy: Initialize Project`)
2. Verifique se está em um workspace válido
3. Consulte o Output do Cappy (`View > Output > Cappy`)

### Problemas de Detecção

Se o CAPPY não detectar o Cursor corretamente:

1. Verifique a versão do Cursor (requer ≥0.1.0)
2. Reporte o problema no [GitHub Issues](https://github.com/cecon/cappy/issues)

## Performance

O CAPPY foi otimizado para ambos os ambientes:
- ✅ Ativação instantânea
- ✅ Índices semânticos eficientes
- ✅ Sem impacto no desempenho do editor

## Suporte

Para questões específicas do Cursor:
- [GitHub Issues](https://github.com/cecon/cappy/issues)
- [Discord Community](https://discord.gg/cappy)

## Próximos Passos

1. [Quick Start Guide](../README.md#quick-start)
2. [Como funciona o Context Orchestration](../README.md#how-it-works)
3. [Prevention Rules System](./prevention-rules-system.md)

---

**CAPPY + Cursor = Desenvolvimento Inteligente com IA Integrada** 🦫🚀



