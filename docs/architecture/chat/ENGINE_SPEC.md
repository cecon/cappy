# SPEC – Chat Engine (LangGraph)

## Workflow
- understand_request → plan_actions → execute_tools → synthesize_response

## Planejamento de Tools
- Classificar intenção: retrieve, code-edit, file-op, terminal-op
- Selecionar tool(s) com base em sinais (entidades, padrões, contexto)
- Paralelizar quando seguro (ex.: searchFiles + searchText)

## Streaming
- Produzir tokens parciais
- Intercalar progress events de tools longas

## Timeouts & Retries
- timeouts por categoria (I/O, LLM)
- retries exponenciais com jitter
- cancelamento cooperativo
