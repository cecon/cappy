# Chat Tools

Sistema de ferramentas para o chat do Cappy.

## Uso

```typescript
import { registerAllTools } from "./domains/chat/tools/setup"
export function activate(context: vscode.ExtensionContext) {
  registerAllTools(context)
}
```

## Ferramentas

- **cappy_create_file**: Cria arquivos no workspace
- **cappy_fetch_web**: Busca conteúdo de URLs
