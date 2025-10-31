# Context Enrichment - Enriquecimento de Contexto

## Visão Geral

O **Context Enrichment** é uma funcionalidade do `ContextRetrievalTool` que automaticamente enriquece contextos com pouca informação, lendo linhas adicionais de código ao redor da referência encontrada.

## Problema

Quando o retrieval retorna:
- Apenas uma linha de código
- Uma referência simples a um arquivo
- Snippets muito pequenos (< 150 caracteres)
- Fragmentos com menos de 5 linhas

O LLM não tem contexto suficiente para entender o código completamente.

## Solução

O sistema detecta automaticamente quando o contexto é minimal e:

1. **Verifica** se o contexto é de código (`source === 'code'`)
2. **Detecta** se o conteúdo é minimal:
   - Menos de 150 caracteres, OU
   - Menos de 5 linhas
3. **Lê o arquivo** completo do workspace
4. **Extrai** 5 linhas antes e 5 linhas depois do contexto original
5. **Retorna** o contexto enriquecido

## Exemplo

### Antes (Contexto Original)
```typescript
const result = graphService.loadGraph();
```

### Depois (Contexto Enriquecido)
```typescript
async initialize(): Promise<void> {
  try {
    // Load graph data if available
    if (this.graphService) {
      const result = await this.graphService.loadGraph();
      if (result.data) {
        this.retriever = new HybridRetriever(result.data);
      }
    }
    
    // If no graph service, create retriever without graph data
```

## Benefícios

1. **Contexto Completo**: O LLM vê o código ao redor, não apenas uma linha isolada
2. **Melhor Compreensão**: Entende variáveis, imports, e estrutura do código
3. **Automático**: Não requer configuração ou intervenção manual
4. **Seletivo**: Só enriquece quando realmente necessário
5. **Performático**: Evita ler arquivos quando o contexto já é suficiente

## Implementação

### Verificação de Conteúdo Minimal
```typescript
const isMinimalContent = ctx.content.length < 150 || 
                         ctx.content.split('\n').length < 5;
```

### Cálculo de Linhas Expandidas
```typescript
const contextLines = 5; // Add 5 lines before and after
const startLine = Math.max(0, (ctx.metadata.lineStart || 1) - contextLines - 1);
const endLine = Math.min(lines.length, (ctx.metadata.lineEnd || startLine + 1) + contextLines);
```

### Tratamento de Erros
- Se o arquivo não existir, retorna o contexto original
- Se houver erro de leitura, retorna o contexto original
- Se não houver workspace, retorna o contexto original

## Configuração

Atualmente não há configuração necessária. A funcionalidade é automática e ativa por padrão.

### Possíveis Configurações Futuras
- `enrichmentEnabled: boolean` - Ativar/desativar enriquecimento
- `contextLinesBefore: number` - Linhas antes do contexto (padrão: 5)
- `contextLinesAfter: number` - Linhas depois do contexto (padrão: 5)
- `minimalContentThreshold: number` - Threshold de caracteres (padrão: 150)
- `minimalLinesThreshold: number` - Threshold de linhas (padrão: 5)

## Indicadores na UI

Quando um contexto é enriquecido, o log mostra:
```
[ContextRetrievalTool] Enriched context for src/file.ts:42 from 28 to 345 chars
```

## Limitações

1. **Apenas Código**: Não enriquece documentação, rules ou tasks
2. **Requer File Path**: Precisa de `ctx.filePath` e `ctx.metadata.lineStart`
3. **Workspace Required**: Precisa que o arquivo esteja no workspace aberto
4. **Limite de Contexto**: Sempre adiciona exatamente 5 linhas antes/depois

## Performance

- **Leitura Assíncrona**: Usa `fs/promises` para não bloquear
- **Cache Natural**: O VS Code já cacheia arquivos em memória
- **Seletivo**: Só lê quando realmente necessário
- **Impacto**: ~1-5ms adicional por contexto enriquecido

## Casos de Uso

### Ideal Para
- ✅ Referências a funções isoladas
- ✅ Imports de módulos
- ✅ Declarações de variáveis
- ✅ Assinaturas de métodos
- ✅ Linhas únicas de código

### Não Necessário Para
- ❌ Documentação completa (já tem contexto)
- ❌ Classes completas (já tem contexto)
- ❌ Funções completas (já tem contexto)
- ❌ Arquivos de configuração completos

## Integração com HybridRetriever

O enriquecimento acontece **depois** do retrieval:

1. `HybridRetriever.retrieve()` retorna contextos
2. `ContextRetrievalTool` formata cada contexto
3. **Para cada contexto**, chama `enrichContext()`
4. Retorna resultado enriquecido ao LLM

## Testes

### Como Testar
```typescript
// No Copilot Chat
@workspace use cappy_retrieve_context to search for "loadGraph"
```

### Verificar Logs
```
[ContextRetrievalTool] Enriched context for src/extension.ts:42 from 28 to 345 chars
```

### Verificar Output
O contexto deve mostrar mais linhas do que o original.

## Troubleshooting

### Contexto Não Foi Enriquecido
- ✅ Verificar se `source === 'code'`
- ✅ Verificar se tem `filePath` e `lineStart`
- ✅ Verificar se conteúdo é realmente minimal
- ✅ Verificar se arquivo existe no workspace

### Erro ao Ler Arquivo
- ✅ Verificar permissões do arquivo
- ✅ Verificar se arquivo não foi deletado
- ✅ Verificar se path é correto
- ✅ Ver logs de erro no console

## Próximos Passos

1. **Configuração Dinâmica**: Permitir configurar thresholds
2. **Smart Context**: Detectar blocos completos (função, classe)
3. **Cache**: Cachear arquivos lidos para evitar re-leitura
4. **Sintaxe Aware**: Usar AST para detectar blocos completos
5. **UI Feedback**: Mostrar indicador visual quando enriquecido
