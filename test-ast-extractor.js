#!/usr/bin/env node
/**
 * Teste direto do AST Relationship Extractor
 */

const path = require('path');
const fs = require('fs');

async function testExtractor() {
  console.log('🧪 TESTE DO AST RELATIONSHIP EXTRACTOR\n');
  console.log('='.repeat(80));
  
  const testFile = path.join(__dirname, '.cappy/temp/CalculateMetricsUseCase.ts');
  
  if (!fs.existsSync(testFile)) {
    console.error(`❌ Arquivo não encontrado: ${testFile}`);
    process.exit(1);
  }
  
  console.log(`\n📄 Arquivo de teste: ${testFile}\n`);
  
  try {
    // Importar dinamicamente
    const { parse } = require('@typescript-eslint/parser');
    
    const content = fs.readFileSync(testFile, 'utf-8');
    
    console.log('1️⃣ Parsing AST...');
    const ast = parse(content, {
      loc: true,
      range: true,
      comment: true,
      tokens: false,
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    });
    
    console.log('   ✅ AST parsed successfully\n');
    
    // Extrair imports manualmente
    console.log('2️⃣ Extraindo imports...');
    const imports = [];
    
    function visit(node) {
      if (!node) return;
      
      if (node.type === 'ImportDeclaration') {
        const source = node.source?.value;
        const specifiers = [];
        
        if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (spec.imported?.name) {
              specifiers.push(spec.imported.name);
            } else if (spec.local?.name) {
              specifiers.push(spec.local.name);
            }
          }
        }
        
        if (source) {
          imports.push({ source, specifiers });
        }
      }
      
      // Recursively visit children
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            for (const child of node[key]) {
              visit(child);
            }
          } else {
            visit(node[key]);
          }
        }
      }
    }
    
    visit(ast);
    
    console.log(`   ✅ Encontrados ${imports.length} imports:\n`);
    imports.forEach((imp, i) => {
      console.log(`   ${i + 1}. ${imp.source}`);
      if (imp.specifiers.length > 0) {
        console.log(`      Specifiers: ${imp.specifiers.join(', ')}`);
      }
    });
    
    console.log('\n3️⃣ Extraindo exports...');
    const exports = [];
    
    function visitExports(node) {
      if (!node) return;
      
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (node.declaration.type === 'TSInterfaceDeclaration') {
            exports.push({ type: 'interface', name: node.declaration.id?.name });
          } else if (node.declaration.type === 'ClassDeclaration') {
            exports.push({ type: 'class', name: node.declaration.id?.name });
          } else if (node.declaration.type === 'FunctionDeclaration') {
            exports.push({ type: 'function', name: node.declaration.id?.name });
          } else if (node.declaration.type === 'VariableDeclaration') {
            for (const decl of node.declaration.declarations) {
              exports.push({ type: 'variable', name: decl.id?.name });
            }
          }
        }
      }
      
      // Recursively visit children
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            for (const child of node[key]) {
              visitExports(child);
            }
          } else {
            visitExports(node[key]);
          }
        }
      }
    }
    
    visitExports(ast);
    
    console.log(`   ✅ Encontrados ${exports.length} exports:\n`);
    exports.forEach((exp, i) => {
      console.log(`   ${i + 1}. ${exp.type}: ${exp.name}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ ANÁLISE COMPLETA\n');
    
    console.log(`📊 Resumo:`);
    console.log(`   - ${imports.length} imports encontrados`);
    console.log(`   - ${exports.length} exports encontrados`);
    
    console.log(`\n💡 ESPERADO NO BANCO DE DADOS:`);
    console.log(`   - ${imports.length} relacionamentos IMPORTS (file -> external ou internal)`);
    console.log(`   - Relacionamentos REFERENCES entre chunks (baseado em uso dos símbolos)`);
    
    console.log(`\n🚨 PROBLEMA IDENTIFICADO:`);
    console.log(`   O ASTRelationshipExtractor.extract() provavelmente:`);
    console.log(`   1. NÃO está sendo chamado durante o upload`);
    console.log(`   2. OU está falhando silenciosamente`);
    console.log(`   3. OU os relacionamentos não estão sendo salvos`);
    
    console.log(`\n📝 PRÓXIMO PASSO:`);
    console.log(`   Verificar os logs do VS Code Output Channel > Cappy`);
    console.log(`   Procurar por mensagens dos novos logs que adicionamos:\n`);
    console.log(`   - "🕸️ Extracting AST relationships for..."`);
    console.log(`   - "🔗 Extracted N relationships"`);
    console.log(`   - "📊 SQLite: Creating N relationships..."\n`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

testExtractor();
