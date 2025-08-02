const { spawn } = require('child_process');
const path = require('path');

// Script para executar especificamente o teste de criação de estrutura de pastas
async function runFolderStructureTest() {
    console.log('🧪 Executando teste de estrutura de pastas...');
    
    // Caminho para o executável do VS Code test
    const testScript = path.join(__dirname, 'out', 'test', 'runTest.js');
    
    // Executar o teste
    const testProcess = spawn('node', [testScript], {
        stdio: 'inherit',
        env: {
            ...process.env,
            TEST_PATTERN: 'createTaskFolderStructure.test.js'
        }
    });
    
    testProcess.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Teste de estrutura de pastas passou!');
        } else {
            console.log('❌ Teste de estrutura de pastas falhou com código:', code);
        }
    });
}

runFolderStructureTest();
