/**
 * Teste direto do processamento de documentos CappyRAG
 * Simula o que eu (como LLM) faria ao chamar a ferramenta MCP
 */

import { CappyRAGDocumentProcessor } from "../core/simplecappyragProcessor";
import { DocumentMetadata, ProcessingOptions } from "../models/cappyragTypes";

async function testCappyRAGProcessing() {
    console.log("🧪 Testando processamento CappyRAG...");
    
    const processor = new CappyRAGDocumentProcessor();
    
    // Simular documento para processamento
    const filePath = "d:\\projetos\\cappy-framework\\SPEC.md";
    const content = `
# CappyRAG System Specification

Este documento especifica a arquitetura do sistema CappyRAG para processamento de documentos
com extração de entidades e relacionamentos.

## Entidades Principais

- **CappyRAG**: Sistema de processamento de documentos
- **Entity Extraction**: Processo de identificação de entidades
- **Relationship Mapping**: Mapeamento de relacionamentos entre entidades
- **Vector Database**: Armazenamento vetorial para busca semântica

## Relacionamentos

- CappyRAG USES Entity Extraction
- CappyRAG USES Relationship Mapping  
- CappyRAG STORES_IN Vector Database
- Entity Extraction PRODUCES Entities
- Relationship Mapping PRODUCES Relationships

## Conceitos

O sistema implementa uma arquitetura dual-level para recuperação eficiente:
1. Low-level retrieval para entidades específicas
2. High-level retrieval para conceitos abstratos

## Tecnologias

- TypeScript para implementação
- LanceDB para armazenamento vetorial
- VS Code API para integração
- Model Context Protocol (MCP) para comunicação com LLMs
    `;
    
    const metadata: DocumentMetadata = {
        title: "SPEC.md - CappyRAG System Specification",
        filename: "SPEC.md",
        contentType: "text/markdown",
        size: content.length,
        uploadedAt: new Date().toISOString(),
        tags: ["specification", "CappyRAG", "system-design"],
        language: "pt-BR"
    };
    
    const options: ProcessingOptions = {
        chunkingStrategy: 'semantic',
        maxChunkSize: 500,
        minConfidence: 0.7,
        minWeight: 0.5,
        autoMerge: false,
        entityTypes: ['TECHNOLOGY', 'CONCEPT', 'PROCESS'],
        relationshipTypes: ['USES', 'PRODUCES', 'STORES_IN']
    };
    
    try {
        console.log("📄 Processando documento SPEC.md...");
        const startTime = Date.now();
        
        const result = await processor.processDocument(
            filePath,
            content,
            metadata,
            options
        );
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        console.log("✅ Processamento concluído!");
        console.log(`⏱️  Tempo: ${processingTime}ms`);
        console.log(`📊 Estatísticas:`);
        console.log(`   - Documento ID: ${result.document.id}`);
        console.log(`   - Entidades: ${result.entities.length}`);
        console.log(`   - Relacionamentos: ${result.relationships.length}`);
        console.log(`   - Key-Value Pairs: ${result.keyValues.length}`);
        console.log(`   - Chunks: ${result.chunks.length}`);
        
        console.log("\n🏷️  Entidades extraídas:");
        result.entities.forEach((entity, i) => {
            console.log(`   ${i + 1}. ${entity.name} (${entity.type}) - conf: ${entity.confidence.toFixed(2)}`);
        });
        
        console.log("\n🔗 Relacionamentos extraídos:");
        result.relationships.forEach((rel, i) => {
            const sourceEntity = result.entities.find(e => e.id === rel.source);
            const targetEntity = result.entities.find(e => e.id === rel.target);
            console.log(`   ${i + 1}. ${sourceEntity?.name || 'Unknown'} ${rel.type} ${targetEntity?.name || 'Unknown'} (peso: ${rel.weight.toFixed(2)})`);
        });
        
        console.log("\n💡 Key Insights:");
        result.keyValues.forEach((kv, i) => {
            console.log(`   ${i + 1}. ${kv.key}: ${kv.value.substring(0, 100)}...`);
        });
        
        console.log("\n📝 Chunks criados:");
        result.chunks.forEach((chunk, i) => {
            console.log(`   Chunk ${i + 1}: ${chunk.substring(0, 50)}...`);
        });
        
        console.log("\n🎉 Teste concluído com sucesso!");
        return result;
        
    } catch (error) {
        console.error("❌ Erro no processamento:", error);
        throw error;
    }
}

// Executar teste se chamado diretamente
if (require.main === module) {
    testCappyRAGProcessing()
        .then(() => process.exit(0))
        .catch(error => {
            console.error("Teste falhou:", error);
            process.exit(1);
        });
}

export { testCappyRAGProcessing };
