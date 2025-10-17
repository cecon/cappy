# SPEC – Adapters Primários e Secundários

## Sumário
- [Objetivo](#objetivo)
- [Escopo](#escopo)
- [Contexto](#contexto)
- [Definições](#definições)
- [Responsabilidades](#responsabilidades)
- [Regras de Dependência](#regras-de-dependência)
- [Guidelines de Implementação](#guidelines-de-implementação)
- [Testabilidade](#testabilidade)
- [Roadmap](#roadmap)
- [Referências](#referências)

## Objetivo
Documentar a distinção entre adapters primários e secundários na arquitetura hexagonal do CappyRAG, garantindo que novos componentes respeitem as regras de isolamento do domínio.

## Escopo
Este SPEC cobre módulos em `src/adapters/primary` e `src/adapters/secondary`, descrevendo seu propósito, contratos e interações com `src/domains` e `src/shared`.

## Contexto
A arquitetura hexagonal estabelece o domínio como núcleo independente de frameworks. 
Adapters conectam esse núcleo a interfaces de entrada (UI, comandos) e a serviços externos (banco, filesystem, motores de visualização). A separação facilita testes, substituição tecnológica e evolução paralela das camadas.

## Definições
- **Adapter Primário**: Componente que inicia fluxos de uso. Ex.: UI React, WebView VS Code, comandos CLI.
- **Adapter Secundário**: Implementação de serviços consumidos pelo domínio. Ex.: SQLite (com sqlite-vec), filesystem, renderizadores.
- **Port**: Interface TypeScript definida no domínio (`src/domains/**/ports`).
- **Use Case**: Serviço de aplicação que expõe operações do domínio.

## Responsabilidades
### Primários (`src/adapters/primary`)
- Converter eventos externos (cliques, comandos) em chamadas de casos de uso.
- Mapear DTOs de UI para tipos do domínio.
- Orquestrar estados de UI e lidar com feedback do usuário.
- Não conter lógica de negócio; delegar decisões ao domínio.

### Secundários (`src/adapters/secondary`)
- Implementar ports de saída definidos no domínio.
- Encapsular dependências externas (SDKs, APIs, drivers).
- Tratar erros de infraestrutura e convertê-los para erros entendíveis pelo domínio.
- Manter responsabilidade única por recurso externo (banco, filesystem, renderizador, etc.).

## Regras de Dependência
- Primários podem depender de `src/domains`, `src/shared` e serviços registrados na infraestrutura.
- Secundários podem depender de bibliotecas externas, `src/shared` e tipos do domínio estritamente necessários para cumprir os ports.
- Nenhum adapter pode importar diretamente outro adapter de categoria diferente (ex.: primário → secundário). A comunicação ocorre via injeção de dependência nos casos de uso.
- O domínio não importa adapters. Apenas recebe interfaces (ports) como parâmetros ou via DI.

## Guidelines de Implementação
1. **Criação de Port**: definir a interface em `src/domains/<domínio>/ports` antes de implementar um adapter secundário.
2. **Factory/DI**: registrar adapters em `infrastructure/di` com bindings explícitos para cada port.
3. **DTO Mapping**: usar conversores dedicados em `src/shared/utils` quando o mapeamento entre camadas exigir transformação.
4. **Side Effects**: manter side effects visíveis e centralizados; documentar contratos assíncronos (promessas, streams).
5. **Error Handling**: normalizar erros externos em objetos de erro reconhecidos pelo domínio (ex.: `DomainError` subclasses).

## Testabilidade
- Adapters primários devem possuir testes de integração simulando interações de usuário (React Testing Library) e mocks para casos de uso.
- Adapters secundários devem ter testes com mocks/stubs das dependências externas e contratos verificados contra os ports.
- Contratos críticos podem usar pactos ou snapshots para garantir compatibilidade entre primários e secundários.

## Roadmap
1. Documentar adapters existentes (`react`, `database`, `visualization`) com diagramas de fluxo específicos.
2. Introduzir checklist de compliance no pipeline (lint rule ou script) para garantir que adapters obedeçam às regras de importação.
3. Adicionar exemplos de referência para novos dominios/adapters.

## Referências
- `docs/architecture/hexagonal-graph-design.md`
- `src/domains/**/ports`
- `src/infrastructure/di`
