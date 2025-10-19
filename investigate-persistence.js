#!/usr/bin/env node
/**
 * Script para investigar os dados persistentes
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function investigate() {
  console.log('🔍 INVESTIGANDO PERSISTÊNCIA DE DADOS\n');
  console.log('='.repeat(80));
  
  const dbPath = path.join(__dirname, '.cappy/data/file-metadata.db');
  
  if (!fs.existsSync(dbPath)) {
    console.log('✅ Banco de dados NÃO existe - está limpo!');
    return;
  }
  
  console.log(`\n📄 Banco encontrado: ${dbPath}`);
  console.log(`   Tamanho: ${fs.statSync(dbPath).size} bytes`);
  console.log(`   Modificado: ${fs.statSync(dbPath).mtime}`);
  
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  // 1. Schema
  console.log('\n\n📋 SCHEMA\n' + '='.repeat(80));
  const schema = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='file_metadata'");
  if (schema.length > 0 && schema[0].values.length > 0) {
    console.log(schema[0].values[0][0]);
  }
  
  // 2. Dados
  console.log('\n\n📊 DADOS\n' + '='.repeat(80));
  const count = db.exec('SELECT COUNT(*) FROM file_metadata');
  const total = count[0]?.values[0][0] || 0;
  console.log(`\nTotal de registros: ${total}`);
  
  if (total > 0) {
    const records = db.exec(`
      SELECT 
        id, 
        file_name, 
        file_path, 
        status, 
        file_size,
        created_at
      FROM file_metadata
    `);
    
    console.log('\nRegistros:');
    if (records.length > 0 && records[0].values.length > 0) {
      records[0].values.forEach(([id, name, path, status, size, created]) => {
        console.log(`\n  ID: ${id}`);
        console.log(`  Nome: ${name}`);
        console.log(`  Path: ${path}`);
        console.log(`  Status: ${status}`);
        console.log(`  Tamanho: ${size} bytes`);
        console.log(`  Criado: ${created}`);
      });
    }
    
    // 3. Verificar se tem file_content
    console.log('\n\n📦 CONTEÚDO EMBUTIDO\n' + '='.repeat(80));
    try {
      const contentCheck = db.exec(`
        SELECT 
          file_name,
          CASE 
            WHEN file_content IS NULL THEN 'NULL'
            WHEN file_content = '' THEN 'EMPTY'
            ELSE 'HAS CONTENT (' || LENGTH(file_content) || ' chars)'
          END as content_status
        FROM file_metadata
      `);
      
      if (contentCheck.length > 0 && contentCheck[0].values.length > 0) {
        console.log('\nStatus do conteúdo:');
        contentCheck[0].values.forEach(([name, status]) => {
          console.log(`  ${name}: ${status}`);
        });
      }
    } catch (error) {
      console.log('⚠️  Coluna file_content NÃO existe no schema atual');
      console.log('   Isso significa que o banco foi criado com a versão ANTIGA');
    }
  }
  
  // 4. Verificar se os arquivos fisicos existem
  console.log('\n\n💾 ARQUIVOS FÍSICOS\n' + '='.repeat(80));
  
  const paths = db.exec('SELECT DISTINCT file_path FROM file_metadata');
  if (paths.length > 0 && paths[0].values.length > 0) {
    paths[0].values.forEach(([filePath]) => {
      const exists = fs.existsSync(filePath);
      console.log(`  ${exists ? '✅' : '❌'} ${filePath}`);
    });
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('\n💡 DIAGNÓSTICO:');
  
  if (total > 0) {
    console.log(`\n🔴 O banco tem ${total} registros persistentes`);
    console.log('\n📍 POSSÍVEIS CAUSAS:');
    console.log('   1. A extensão está rodando e mantém o banco em memória (sql.js)');
    console.log('   2. Os dados foram salvos no disco antes de você deletar');
    console.log('   3. O banco foi recriado automaticamente ao abrir a UI');
    
    console.log('\n🔧 SOLUÇÃO:');
    console.log('   1. Feche COMPLETAMENTE o VS Code (não só recarregue)');
    console.log('   2. Delete o arquivo: rm -rf .cappy/data/file-metadata.db');
    console.log('   3. Delete também: rm -rf .cappy/data/graph-store.db');
    console.log('   4. Reabra o VS Code');
    console.log('   5. Faça novo upload\n');
  } else {
    console.log('\n✅ O banco está VAZIO - tudo certo!\n');
  }
  
  db.close();
}

investigate().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
