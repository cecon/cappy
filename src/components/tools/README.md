# Tool Confirmation System

Sistema modular para confirmação de execução de ferramentas no chat do Cappy.

## Estrutura de Arquivos

```
src/components/tools/
├── index.ts                    # Exportações centralizadas
├── types.ts                    # Tipos TypeScript compartilhados
├── actions.ts                  # Lógica de negócio (approve/deny)
└── ToolCallConfirmation.tsx    # Componente visual React
```

## Arquitetura

### 1. **types.ts** - Definições de Tipos

Define os contratos de dados:
- `PendingToolCall`: Representa uma ferramenta aguardando aprovação
- `ToolCallActions`: Interface para ações de aprovação/negação

### 2. **actions.ts** - Lógica de Negócio

Classe `ToolCallActionHandler` que gerencia:
- Aprovação de ferramentas (`approveToolCall`)
- Negação de ferramentas (`denyToolCall`)
- Adição de ferramentas pendentes (`addPendingTool`)
- Consulta de ferramentas pendentes (`getPendingTool`)
- Contagem de ferramentas pendentes (`getPendingCount`)

### 3. **ToolCallConfirmation.tsx** - Componente Visual

Componente React que renderiza:
- Nome da ferramenta com emoji 🔧
- Pergunta de confirmação
- Parâmetros da ferramenta (expansível)
- Botões de Allow/Deny com ícones

## Uso

### Importação

```typescript
import { 
  ToolCallConfirmation, 
  type PendingToolCall 
} from "./tools";
```

### Exemplo de Uso

```tsx
const pendingTool: PendingToolCall = {
  messageId: "prompt_123",
  toolName: "create_file",
  args: { path: "test.txt", content: "Hello" },
  question: "Execute create_file?",
  resolver: (approved: boolean) => { /* ... */ }
};

const actions = {
  approveToolCall: (id: string) => adapter.approveToolCall(id),
  denyToolCall: (id: string) => adapter.denyToolCall(id)
};

<ToolCallConfirmation 
  pendingTool={pendingTool} 
  actions={actions} 
/>
```

## Fluxo de Dados

1. **Backend** detecta tool call e envia `__PROMPT_REQUEST__`
2. **ChatViewProvider** recebe e envia `promptRequest` para o webview
3. **ChatView** cria `PendingToolCall` e adiciona ao Map
4. **ToolCallConfirmation** renderiza UI de confirmação
5. **Usuário** clica Allow/Deny
6. **actions** chama `approveToolCall` ou `denyToolCall`
7. **Resolver** resolve a Promise com true/false
8. **Backend** continua ou aborta a execução

## Benefícios da Modularização

- ✅ **Separação de concerns**: Lógica vs. Visual
- ✅ **Reutilizável**: Pode ser usado em outros contextos
- ✅ **Testável**: Cada módulo pode ser testado isoladamente
- ✅ **Manutenível**: Mudanças localizadas em arquivos específicos
- ✅ **Type-safe**: Tipos compartilhados garantem consistência

## Estilos

Usa Tailwind CSS com classes utilitárias:
- `border-primary/30`: Borda com cor primária e 30% de opacidade
- `bg-primary/5`: Background com cor primária e 5% de opacidade
- `hover:bg-primary/90`: Hover effect com 90% de opacidade

## Ícones

Usa `lucide-react`:
- `CheckIcon`: Botão Allow
- `XIcon`: Botão Deny
