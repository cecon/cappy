src/
├── extension.ts
├── instructions/
│   ├── capybara-methodology.md  # Instruções principais do Capybara
│   ├── step-templates.md        # Templates dos arquivos STEP_XX
│   └── context-patterns.md      # Padrões específicos por contexto
├── commands/
│   ├── initCapybara.ts          # Cria .capy/config.json mínimo
│   ├── createStep.ts            # Injeta contexto + cria STEP
│   └── completeStep.ts          # Propaga regras automaticamente
└── utils/
    ├── contextManager.ts        # Injeta instruções no Copilot
    └── stepManager.ts           # Gerencia STEPs e acumulação
