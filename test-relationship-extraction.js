#!/usr/bin/env node
/**
 * Script de teste direto para verificar extração de relacionamentos
 */

const path = require('path');
const fs = require('fs');

// Import dynamically to avoid compilation issues
async function testRelationshipExtraction() {
  console.log('🧪 TESTE DE EXTRAÇÃO DE RELACIONAMENTOS\n');
  console.log('='.repeat(80));
  
  const testFile = path.join(__dirname, 'src/services/config-service.ts');
  
  if (!fs.existsSync(testFile)) {
    console.error(`❌ Arquivo não encontrado: ${testFile}`);
    process.exit(1);
  }
  
  console.log(`\n📄 Testando arquivo: ${testFile}\n`);
  
  try {
    // Simulate what workspace-scanner does
    console.log('1️⃣ Lendo conteúdo do arquivo...');
    const content = fs.readFileSync(testFile, 'utf-8');
    console.log(`   ✅ ${content.length} bytes lidos\n`);
    
    console.log('2️⃣ Verificando imports no arquivo...');
    const importRegex = /import\s+(?:{[^}]+}|[\w]+)(?:\s*,\s*{[^}]+})?\s+from\s+['"]([^'"]+)['"]/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    console.log(`   ✅ Encontrados ${imports.length} imports:`);
    imports.forEach(imp => console.log(`      - ${imp}`));
    
    console.log('\n3️⃣ Verificando exports no arquivo...');
    const exportRegex = /export\s+(?:async\s+)?(?:function|class|interface|type|const|let|var)\s+(\w+)/g;
    const exports = [];
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    console.log(`   ✅ Encontrados ${exports.length} exports:`);
    exports.forEach(exp => console.log(`      - ${exp}`));
    
    console.log('\n4️⃣ Analisando chamadas de função...');
    const callRegex = /(?:await\s+)?(\w+)\s*\(/g;
    const calls = new Set();
    
    while ((match = callRegex.exec(content)) !== null) {
      // Filter out common keywords
      const name = match[1];
      if (!['if', 'while', 'for', 'switch', 'catch', 'return', 'new', 'typeof', 'instanceof'].includes(name)) {
        calls.add(name);
      }
    }
    
    console.log(`   ✅ Encontradas ${calls.size} chamadas de função (amostra):`);
    Array.from(calls).slice(0, 10).forEach(call => console.log(`      - ${call}()`));
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ ANÁLISE COMPLETA\n');
    
    console.log(`📊 Resumo:`);
    console.log(`   - ${imports.length} imports detectados`);
    console.log(`   - ${exports.length} exports detectados`);
    console.log(`   - ${calls.size} chamadas de função detectadas`);
    
    console.log(`\n💡 Se esses dados não estão aparecendo no banco de dados,`);
    console.log(`   o problema está em uma das seguintes etapas:`);
    console.log(`   1. ASTRelationshipExtractor não está sendo chamado`);
    console.log(`   2. Os relacionamentos não estão sendo criados corretamente`);
    console.log(`   3. Os relacionamentos não estão sendo salvos no banco`);
    
    console.log(`\n📝 Próximo passo: Verificar logs da extensão VS Code`);
    console.log(`   durante a indexação do workspace\n`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

testRelationshipExtraction();
