/**
 * @fileoverview Exemplo prático do pipeline de filtragem de entidades
 * @module services/entity-filtering/examples
 * @author Cappy Team
 * @since 3.2.0
 * 
 * Este arquivo demonstra o fluxo completo:
 * Código Fonte → AST → Entidades Brutas → Filtros → Banco de Dados
 */

import { EntityFilterPipeline, type RawEntity } from './entity-filter-pipeline';

/**
 * Código fonte de exemplo para demonstração
 */
const exampleCode = `
import { Router } from 'express';
import { Request, Response } from 'express';
import './styles.css';
import type { Database } from './database';

class UserService {
  private db: Database;
  private _cache: Map<string, User>;
  
  constructor(db: Database) {
    this.db = db;
    this._cache = new Map();
  }
  
  async getUser(id: string): Promise<User | null> {
    const temp = 'SELECT * FROM users WHERE id = ?';
    const result = await this.db.query(temp, [id]);
    return result;
  }
  
  private _updateCache(user: User): void {
    this._cache.set(user.id, user);
  }
}

export { UserService };
export type { User };
`;

/**
 * ETAPA 1: Entidades brutas extraídas do AST
 * 
 * Estas são TODAS as entidades encontradas no código,
 * sem nenhum filtro aplicado.
 */
const rawEntities: RawEntity[] = [
  // Imports
  {
    type: 'import',
    name: 'Router',
    source: 'express',
    specifiers: ['Router'],
    line: 1,
    scope: 'module'
  },
  {
    type: 'import',
    name: 'Request',
    source: 'express',
    specifiers: ['Request'],
    line: 2,
    scope: 'module'
  },
  {
    type: 'import',
    name: 'Response',
    source: 'express',
    specifiers: ['Response'],
    line: 2,
    scope: 'module'
  },
  {
    type: 'import',
    name: 'styles.css',
    source: './styles.css',
    specifiers: [],
    line: 3,
    scope: 'module'
  },
  {
    type: 'import',
    name: 'Database',
    source: './database',
    specifiers: ['Database'],
    line: 4,
    scope: 'module'
  },
  // Classes
  {
    type: 'class',
    name: 'UserService',
    line: 6,
    scope: 'module'
  },
  // Propriedades
  {
    type: 'variable',
    name: 'db',
    line: 7,
    scope: 'module',
    isPrivate: true
  },
  {
    type: 'variable',
    name: '_cache',
    line: 8,
    scope: 'module',
    isPrivate: true
  },
  // Tipos primitivos
  {
    type: 'typeRef',
    name: 'string',
    line: 15,
    scope: 'local'
  },
  {
    type: 'typeRef',
    name: 'Promise',
    line: 15,
    scope: 'global'
  },
  {
    type: 'typeRef',
    name: 'User',
    line: 15,
    scope: 'module'
  },
  {
    type: 'typeRef',
    name: 'null',
    line: 15,
    scope: 'global'
  },
  // Variável local temporária
  {
    type: 'variable',
    name: 'temp',
    line: 16,
    scope: 'local'
  },
  {
    type: 'variable',
    name: 'result',
    line: 17,
    scope: 'local'
  },
  // Métodos
  {
    type: 'function',
    name: 'getUser',
    line: 15,
    scope: 'module'
  },
  {
    type: 'function',
    name: '_updateCache',
    line: 21,
    scope: 'module',
    isPrivate: true
  },
  // Chamadas de função
  {
    type: 'call',
    name: 'query',
    line: 17,
    scope: 'local'
  },
  {
    type: 'call',
    name: 'set',
    line: 22,
    scope: 'local'
  },
  // Exports
  {
    type: 'export',
    name: 'UserService',
    line: 26,
    scope: 'module'
  },
  {
    type: 'export',
    name: 'User',
    line: 27,
    scope: 'module'
  }
];

/**
 * Demonstra o fluxo completo do pipeline
 */
async function demonstratePipeline() {
  console.log('═'.repeat(80));
  console.log('🎯 DEMONSTRAÇÃO: Pipeline de Filtragem de Entidades');
  console.log('═'.repeat(80));
  
  // Mostra código fonte
  console.log('\n📝 CÓDIGO FONTE:');
  console.log('─'.repeat(80));
  console.log(exampleCode);
  
  // Mostra entidades brutas
  console.log('\n📊 ETAPA 1: ENTIDADES BRUTAS (Extraídas do AST)');
  console.log('─'.repeat(80));
  console.log(`Total: ${rawEntities.length} entidades`);
  console.log('\nDetalhamento:');
  
  const byType = rawEntities.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  • ${type}: ${count}`);
  });
  
  // Cria pipeline com configuração padrão
  const pipeline = new EntityFilterPipeline({
    skipLocalVariables: true,
    skipPrimitiveTypes: true,
    skipAssetImports: true,
    skipPrivateMembers: false, // Mantém mas reduz score
    mergeIdenticalEntities: true,
    resolvePackageInfo: true,
    inferRelationships: true
  });
  
  // Processa entidades
  const result = await pipeline.process(rawEntities, '/workspace/src/services/user-service.ts');
  
  // Mostra resultados de cada etapa
  console.log('\n📊 ETAPA 2: APÓS FILTRO DE RELEVÂNCIA');
  console.log('─'.repeat(80));
  console.log(`Mantidas: ${result.filtered.length} entidades`);
  console.log(`Descartadas: ${result.stats.discardedCount} entidades`);
  console.log('\n🗑️  Entidades descartadas:');
  
  const discarded = result.original.filter(
    orig => !result.filtered.find(f => f.name === orig.name && f.type === orig.type)
  );
  
  discarded.forEach(entity => {
    const reason = entity.type === 'variable' && entity.scope === 'local' 
      ? 'Variável local (detalhe de implementação)'
      : entity.type === 'typeRef' && ['string', 'null', 'Promise'].includes(entity.name)
      ? 'Tipo primitivo (ruído)'
      : entity.type === 'import' && entity.source?.includes('.css')
      ? 'Import de asset (não é dependência de código)'
      : 'Outro motivo';
    
    console.log(`  ❌ ${entity.type}: ${entity.name} - ${reason}`);
  });
  
  console.log('\n✅ Entidades mantidas:');
  result.filtered.forEach(entity => {
    const score = entity.relevanceScore.toFixed(2);
    const indicator = entity.relevanceScore >= 0.8 ? '🟢' : entity.relevanceScore >= 0.5 ? '🟡' : '🔴';
    console.log(`  ${indicator} ${entity.type}: ${entity.name} (score: ${score})`);
  });
  
  console.log('\n📊 ETAPA 3: APÓS DEDUPLICAÇÃO');
  console.log('─'.repeat(80));
  console.log(`Entidades únicas: ${result.deduplicated.length}`);
  console.log(`Mescladas: ${result.stats.deduplicatedCount}`);
  
  // Mostra exemplos de mesclagem (imports do express)
  const expressImport = result.deduplicated.find(e => e.source === 'express');
  if (expressImport) {
    console.log('\n🔗 Exemplo de mesclagem:');
    console.log(`  Pacote: ${expressImport.source}`);
    console.log(`  Specifiers combinados: ${expressImport.specifiers?.join(', ')}`);
    console.log(`  Ocorrências: ${expressImport.occurrences}`);
    console.log(`  Mesclado de: ${expressImport.mergedFrom?.join(', ')}`);
  }
  
  console.log('\n📊 ETAPA 4: APÓS NORMALIZAÇÃO');
  console.log('─'.repeat(80));
  console.log(`Entidades normalizadas: ${result.normalized.length}`);
  
  // Agrupa por categoria
  const byCategory = result.normalized.reduce((acc, e) => {
    acc[e.category] = acc[e.category] || [];
    acc[e.category].push(e);
    return acc;
  }, {} as Record<string, typeof result.normalized>);
  
  Object.entries(byCategory).forEach(([category, entities]) => {
    console.log(`\n${category.toUpperCase()}:`);
    entities.forEach(entity => {
      if (entity.type === 'import') {
        const pkg = entity.packageInfo 
          ? ` (${entity.packageInfo.name}@${entity.packageInfo.version || 'unknown'})` 
          : '';
        console.log(`  • ${entity.name} ← ${entity.source}${pkg}`);
      } else {
        console.log(`  • ${entity.type}: ${entity.name}`);
      }
    });
  });
  
  console.log('\n📊 ETAPA 5: APÓS ENRIQUECIMENTO (Pronto para banco)');
  console.log('─'.repeat(80));
  console.log(`Entidades enriquecidas: ${result.enriched.length}`);
  
  console.log('\n🔗 Relacionamentos inferidos:');
  result.enriched.forEach(entity => {
    if (entity.relationships.length > 0) {
      console.log(`\n  ${entity.name}:`);
      entity.relationships.forEach(rel => {
        console.log(`    → ${rel.type.toUpperCase()}: ${rel.target} (confidence: ${rel.confidence.toFixed(2)})`);
      });
    }
  });
  
  // Estatísticas finais
  console.log('\n📈 ESTATÍSTICAS FINAIS');
  console.log('─'.repeat(80));
  console.log(`Total de entidades brutas:     ${result.stats.totalRaw}`);
  console.log(`Após filtro de relevância:     ${result.stats.totalFiltered} (-${result.stats.discardedCount})`);
  console.log(`Após deduplicação:             ${result.deduplicated.length} (-${result.stats.deduplicatedCount})`);
  console.log(`Entidades finais no banco:     ${result.stats.finalCount}`);
  console.log(`Tempo de processamento:        ${result.stats.processingTimeMs}ms`);
  console.log(`Taxa de compressão:            ${((1 - result.stats.finalCount / result.stats.totalRaw) * 100).toFixed(1)}%`);
  
  console.log('\n✅ RESUMO: O QUE É SALVO NO BANCO');
  console.log('─'.repeat(80));
  console.log('✓ Imports de pacotes externos (com versão e metadata)');
  console.log('✓ Imports internos (dependências entre arquivos)');
  console.log('✓ Exports (interface pública do módulo)');
  console.log('✓ Classes e funções principais');
  console.log('✓ Tipos customizados (não primitivos)');
  console.log('✓ Relacionamentos entre entidades');
  console.log('\n✗ O QUE NÃO É SALVO');
  console.log('─'.repeat(80));
  console.log('✗ Variáveis locais/temporárias');
  console.log('✗ Tipos primitivos (string, number, etc)');
  console.log('✗ Imports de assets (CSS, imagens)');
  console.log('✗ Detalhes de implementação interna');
  console.log('✗ Comentários e whitespace');
  
  console.log('\n═'.repeat(80));
}

// Executa demonstração se rodado diretamente
if (require.main === module) {
  demonstratePipeline().catch(console.error);
}

export { demonstratePipeline, rawEntities, exampleCode };
