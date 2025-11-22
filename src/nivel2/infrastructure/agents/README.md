# Agente Inteligente para Análise de Código e Planejamento de Desenvolvimento

## Arquitetura Multiagente com LangGraph (TypeScript)

Este projeto implementa um agente inteligente multi-etapas, capaz de:

-   analisar código existente,
-   ler documentação e contexto,
-   discutir alternativas,
-   gerar planos técnicos de desenvolvimento,
-   validar e refinar planos,
-   executar entregáveis (código, docs, patches).

A arquitetura é baseada no LangGraph, organizada em agentes
especialistas coordenados por um Supervisor.

## Visão Geral

    supervisor
       ├ intention
       ├ refinement
       ├ brain
       │    ├ researcher
       │    ├ summarizer
       │    └ debater
       ├ planner
       ├ critic
       ├ refiner
       └ executor

Cada agente possui seu próprio `graph.ts`, `state.ts` e `tools/`.

## Estrutura

    /src
      /agents
        /supervisor
        /intention
        /refinement
        /brain
          /tools
          /agents
            /researcher
            /summarizer
            /debater
        /planner
        /critic
        /refiner
        /executor

      /context
      /common

      index.ts

## Como Rodar

    npm install
    npm run dev

## Criando Tools

    /agents/<agente>/tools

## Criando Subagentes

    /agents/brain/agents/<novoAgente>
