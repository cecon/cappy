# Tools - Ferramentas MCP/LM Tools para LLMs

## Propósito
Expor operações do Mini-LightRAG como ferramentas para Copilot/Cursor via MCP e VS Code LM Tools API.

## Responsabilidades

### Tools Principais (Step 12)
- `rag.search(query, topK, filtros)` → itens + subgrafo resumido
- `graph.expand(nodeId, hops=1, edgeTypes[])` → subgrafo expandido
- `symbols.lookup(name)` → assinatura + documentação
- `cite.open(path, startLine, endLine)` → ação no editor VS Code
- `index.status()` / `index.update(scope)` → gestão de índices

### MCP Integration
- Servidor MCP próprio da extensão
- Descrições otimizadas para LLMs
- Parâmetros com enums e defaults
- Respostas concisas e estruturadas

### VS Code LM Tools API
- Integração nativa com Copilot
- Tools registration no activation
- Handlers assíncronos otimizados
- Error handling pedagógico

### Regras de Design
- **Idempotentes**: Múltiplas chamadas = mesmo resultado
- **Seguras**: Timeouts, payload pequeno
- **Pedagógicas**: Erros explicativos para LLMs
- **Rápidas**: < 2s para operações comuns

## Arquivos Futuros
- `mcpServer.ts` - Servidor MCP da extensão
- `lmToolsRegistry.ts` - Registro VS Code LM Tools
- `toolHandlers.ts` - Implementação das ferramentas
- `responseFormatter.ts` - Formatação para LLMs
