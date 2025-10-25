# Entity Filter Pipeline - Hexagonal Architecture

## 📐 Arquitetura

Pipeline de filtragem refatorado seguindo **Arquitetura Hexagonal**, com separação clara de responsabilidades e alta testabilidade.

## 🏗️ Estrutura

```
entity-filtering/
├── core/
│   └── EntityFilterPipeline.ts        # Orquestrador (~100 linhas)
├── types/
│   └── FilterTypes.ts                 # Tipos e interfaces
├── filters/                            # Filtros especializados
│   ├── RelevanceFilter.ts             # Remove ruído
│   ├── DeduplicationFilter.ts         # Mescla duplicatas
│   ├── NormalizationFilter.ts         # Padroniza dados
│   └── EnrichmentFilter.ts            # Adiciona metadados
├── enrichers/                          # Enriquecedores específicos
│   ├── ConfidenceEnricher.ts
│   ├── RelationshipInferrer.ts
│   └── DocumentationExtractor.ts
├── resolvers/                          # Resolvers externos
│   ├── PackageInfoResolver.ts
│   └── PackageManagerDetector.ts
└── discovery/
    └── EntityDiscoveryService.ts
```

## 🔄 Fluxo

```
RawEntity[] → RelevanceFilter → DeduplicationFilter → NormalizationFilter → EnrichmentFilter → EnrichedEntity[]
```

## ✅ Benefícios

**Antes**: 1 arquivo monolítico com 570+ linhas
**Depois**: 11 arquivos modulares com ~465 linhas totais

- 🧪 **Testabilidade**: Cada módulo testável isoladamente
- 🔧 **Manutenibilidade**: Mudanças localizadas
- 🚀 **Extensibilidade**: Adicionar novos filtros/enrichers sem modificar código existente
- 📖 **Legibilidade**: Cada arquivo <100 linhas com responsabilidade clara
