#!/usr/bin/env node
/**
 * Script de diagnóstico rápido do banco de dados de grafo
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function diagnose() {
  console.log('🔍 Analisando banco de dados de grafo...\n');

  const dbPath = path.join(__dirname, '.cappy', 'data', 'graph-store.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Banco de dados não encontrado em:', dbPath);
    return;
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // 1. Estatísticas gerais
  console.log('📊 ESTATÍSTICAS GERAIS\n' + '='.repeat(50));
  
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('\n📋 Tabelas encontradas:');
  if (tables.length > 0) {
    tables[0].values.forEach(([name]) => console.log(`  - ${name}`));
  }

  // 2. Nodes
  console.log('\n\n📦 NODES\n' + '='.repeat(50));
  
  const nodeCount = db.exec('SELECT COUNT(*) as count FROM nodes');
  const totalNodes = nodeCount[0]?.values[0][0] || 0;
  console.log(`Total de nodes: ${totalNodes}`);

  const nodesByType = db.exec(`
    SELECT type, COUNT(*) as count 
    FROM nodes 
    GROUP BY type 
    ORDER BY count DESC
  `);
  
  if (nodesByType.length > 0) {
    console.log('\nNodes por tipo:');
    nodesByType[0].values.forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  // 3. Relationships (edges)
  console.log('\n\n🔗 RELATIONSHIPS (EDGES)\n' + '='.repeat(50));
  
  const relCount = db.exec('SELECT COUNT(*) as count FROM edges');
  const totalRels = relCount[0]?.values[0][0] || 0;
  console.log(`Total de edges: ${totalRels}`);

  const relsByType = db.exec(`
    SELECT type, COUNT(*) as count 
    FROM edges 
    GROUP BY type 
    ORDER BY count DESC
  `);
  
  if (relsByType.length > 0) {
    console.log('\nEdges por tipo:');
    relsByType[0].values.forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  // 4. Análise de profundidade
  console.log('\n\n📏 ANÁLISE DE PROFUNDIDADE\n' + '='.repeat(50));
  
  // Files
  const fileNodes = db.exec(`
    SELECT id, properties 
    FROM nodes 
    WHERE type = 'file' 
    LIMIT 5
  `);
  
  if (fileNodes.length > 0 && fileNodes[0].values.length > 0) {
    console.log('\n📄 Amostra de arquivos (primeiros 5):');
    fileNodes[0].values.forEach(([id, properties]) => {
      const parsed = properties ? JSON.parse(properties) : {};
      console.log(`  ${id}: ${parsed.path || parsed.relativePath || 'sem path'}`);
      
      // Verificar chunks deste arquivo
      const chunks = db.exec(`
        SELECT COUNT(*) 
        FROM edges 
        WHERE from_id = ? AND type = 'contains'
      `, [id]);
      
      const chunkCount = chunks[0]?.values[0][0] || 0;
      console.log(`    └─ Chunks: ${chunkCount}`);
      
      // Verificar relacionamentos dos chunks
      if (chunkCount > 0) {
        const chunkRels = db.exec(`
          SELECT e2.type, COUNT(*) as count
          FROM edges e1
          JOIN edges e2 ON e1.to_id = e2.from_id
          WHERE e1.from_id = ? AND e1.type = 'contains'
          GROUP BY e2.type
        `, [id]);
        
        if (chunkRels.length > 0 && chunkRels[0].values.length > 0) {
          console.log(`    └─ Relacionamentos dos chunks:`);
          chunkRels[0].values.forEach(([type, count]) => {
            console.log(`       - ${type}: ${count}`);
          });
        } else {
          console.log(`    └─ ⚠️  Chunks SEM relacionamentos!`);
        }
      }
    });
  }

  // 5. Chunks órfãos (sem relacionamentos)
  console.log('\n\n⚠️  PROBLEMAS DETECTADOS\n' + '='.repeat(50));
  
  const orphanChunks = db.exec(`
    SELECT n.id, n.properties
    FROM nodes n
    WHERE n.type = 'chunk'
    AND n.id NOT IN (SELECT from_id FROM edges WHERE from_id = n.id)
    LIMIT 10
  `);
  
  const orphanCount = orphanChunks.length > 0 ? orphanChunks[0].values.length : 0;
  
  if (orphanCount > 0) {
    console.log(`\n🚨 ${orphanCount} chunks órfãos (sem relacionamentos de saída)`);
    console.log('   Primeiros 10:');
    orphanChunks[0].values.forEach(([id, properties]) => {
      const parsed = properties ? JSON.parse(properties) : {};
      console.log(`   - ${id}: ${parsed.type || 'unknown'} (${parsed.content?.substring(0, 50) || 'no content'}...)`);
    });
  } else {
    console.log('\n✅ Nenhum chunk órfão encontrado');
  }

  // 6. Arquivos sem chunks
  const filesWithoutChunks = db.exec(`
    SELECT n.id, n.properties
    FROM nodes n
    WHERE n.type = 'file'
    AND n.id NOT IN (SELECT from_id FROM edges WHERE type = 'contains')
    LIMIT 10
  `);
  
  const filesNoChunksCount = filesWithoutChunks.length > 0 ? filesWithoutChunks[0].values.length : 0;
  
  if (filesNoChunksCount > 0) {
    console.log(`\n🚨 ${filesNoChunksCount} arquivos SEM chunks`);
    console.log('   Primeiros 10:');
    filesWithoutChunks[0].values.forEach(([id, properties]) => {
      const parsed = properties ? JSON.parse(properties) : {};
      console.log(`   - ${id}: ${parsed.path || parsed.relativePath || 'sem path'}`);
    });
  } else {
    console.log('\n✅ Todos os arquivos têm chunks');
  }

  // 7. Tipos de relacionamentos entre chunks
  console.log('\n\n🔍 RELACIONAMENTOS ENTRE CHUNKS\n' + '='.repeat(50));
  
  const chunkRelationships = db.exec(`
    SELECT e.type, COUNT(*) as count
    FROM edges e
    JOIN nodes n1 ON e.from_id = n1.id
    JOIN nodes n2 ON e.to_id = n2.id
    WHERE n1.type = 'chunk' AND n2.type = 'chunk'
    GROUP BY e.type
    ORDER BY count DESC
  `);
  
  if (chunkRelationships.length > 0 && chunkRelationships[0].values.length > 0) {
    console.log('\nRelacionamentos chunk-to-chunk:');
    chunkRelationships[0].values.forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  } else {
    console.log('\n⚠️  NENHUM relacionamento chunk-to-chunk encontrado!');
    console.log('   Isso indica que os dados estão RASOS - chunks não estão conectados entre si');
  }

  // 8. Exemplo de caminho completo
  console.log('\n\n🌲 EXEMPLO DE CAMINHO (profundidade)\n' + '='.repeat(50));
  
  const samplePath = db.exec(`
    SELECT 
      n1.type as n1_type,
      n1.id as n1_id,
      e1.type as rel_type,
      n2.type as n2_type,
      n2.id as n2_id,
      n2.properties as n2_data
    FROM edges e1
    JOIN nodes n1 ON e1.from_id = n1.id
    JOIN nodes n2 ON e1.to_id = n2.id
    WHERE n1.type = 'file'
    LIMIT 5
  `);
  
  if (samplePath.length > 0 && samplePath[0].values.length > 0) {
    samplePath[0].values.forEach(([n1Type, n1Id, relType, n2Type, n2Id, n2Data]) => {
      console.log(`\n${n1Type}[${n1Id}] --[${relType}]--> ${n2Type}[${n2Id}]`);
      
      // Buscar próximo nível
      const nextLevel = db.exec(`
        SELECT e.type, n.type, n.id
        FROM edges e
        JOIN nodes n ON e.to_id = n.id
        WHERE e.from_id = ?
        LIMIT 3
      `, [n2Id]);
      
      if (nextLevel.length > 0 && nextLevel[0].values.length > 0) {
        nextLevel[0].values.forEach(([relType2, nType2, nId2]) => {
          console.log(`  └─> --[${relType2}]--> ${nType2}[${nId2}]`);
        });
      } else {
        console.log(`  └─> ⚠️  SEM próximo nível (dados rasos!)`);
      }
    });
  }

  console.log('\n\n' + '='.repeat(50));
  console.log('✅ Diagnóstico completo!\n');

  db.close();
}

diagnose().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
