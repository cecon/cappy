# Exemplo: Geração Automática de STEP IDs com Unix Timestamp

## Como a LLM deve gerar os IDs automaticamente:

```javascript
// Timestamp base (simulando Date.now())
const baseTimestamp = 1722873600; // 4 de Agosto, 2025

// Geração automática de steps para uma task:
const steps = [
    {
        id: `STEP_${baseTimestamp}`,        // STEP_1722873600
        title: "Install dependencies"
    },
    {
        id: `STEP_${baseTimestamp + 60}`,   // STEP_1722873660  
        title: "Configure environment"
    },
    {
        id: `STEP_${baseTimestamp + 120}`,  // STEP_1722873720
        title: "Create client configuration"
    },
    {
        id: `STEP_${baseTimestamp + 180}`,  // STEP_1722873780
        title: "Setup authentication"
    },
    {
        id: `STEP_${baseTimestamp + 240}`,  // STEP_1722873840
        title: "Create custom hook"
    }
];
```

## Vantagens do sistema:

✅ **Ordem cronológica automática**: Steps sempre ficam em ordem temporal  
✅ **IDs únicos garantidos**: Nunca haverá conflito entre timestamps  
✅ **Formato compacto**: `STEP_1722873600` vs `step001`  
✅ **Sem esforço manual**: LLM gera automaticamente  
✅ **Compatível com JWT**: Mesmo conceito do campo `exp`  
✅ **Escalável**: Funciona para qualquer quantidade de steps  

## Exemplo de depends-on:

```xml
<step id="STEP_1722873600" order="1" completed="false" required="true">
    <!-- Primeiro step - sem dependência -->
</step>

<step id="STEP_1722873660" order="2" completed="false" required="true" depends-on="STEP_1722873600">
    <!-- Segundo step - depende do primeiro -->
</step>

<step id="STEP_1722873720" order="3" completed="false" required="true" depends-on="STEP_1722873660">
    <!-- Terceiro step - depende do segundo -->
</step>
```

## Implementação prática na LLM:

A LLM deve **sempre**:
1. Calcular timestamp base atual (simulação de Date.now())
2. Para cada step, adicionar 60 segundos ao anterior
3. Usar o formato `STEP_[timestamp]` consistentemente
4. Referenciar IDs anteriores no `depends-on`

**Resultado**: Steps organizados cronologicamente de forma automática! 🎯
