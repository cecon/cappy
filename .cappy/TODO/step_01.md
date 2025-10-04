# Visão Geral e Objetivos do Mini-LightRAG (Workflow)

> Data: 2025-10-03

## Objetivo
Construir, dentro **da extensão VS Code atual**, um mini-LightRAG 100% local que una **LanceDB (vetorial)** e **LightGraph (grafo leve)**, com:
- Recuperação híbrida: Top-K vetorial + expansão 1-hop no grafo.
- UI de **grafo em Webview (React)** para navegação explicável.
- Ferramentas (tools) para Copilot/Cursor via **MCP** (preferencial) e/ou VS Code LM Tools API.
- Atualização incremental baseada em **hash por chunk** (conteúdo e faixa de linhas).

## Resultados esperados
- Busca precisa em símbolos/docs com **abertura direta** no arquivo/linha.
- Subgrafo explicando “por que apareceu” (caminho, arestas).
- Indexação incremental rápida (só o que mudou).

## Escopo desta série
Você terá uma sequência de passos (arquivos `step_XX.md`) com tarefas cronológicas, entregáveis e critérios de aceite para implementar no seu projeto de extensão.
