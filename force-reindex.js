#!/usr/bin/env node
/**
 * Script para forçar re-indexação com logs detalhados
 */

const vscode = require('vscode');
const path = require('path');

async function forceReindex() {
  console.log('🔄 Forçando re-indexação do workspace...\n');
  
  try {
    // Executar comando de reset do banco de dados
    console.log('1️⃣ Resetando banco de dados...');
    await vscode.commands.executeCommand('cappy.resetDatabase');
    
    console.log('\n2️⃣ Aguardando 2 segundos...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Executar re-análise de relacionamentos
    console.log('\n3️⃣ Re-analisando relacionamentos...');
    await vscode.commands.executeCommand('cappy.reanalyzeRelationships');
    
    console.log('\n✅ Re-indexação completa!');
    console.log('\nAgora execute: node diagnose-graph-db.js');
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

forceReindex();
