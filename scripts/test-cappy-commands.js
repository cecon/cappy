#!/usr/bin/env node

/**
 * Script para testar comandos Cappy via VS Code CLI
 * Execute: node test-cappy-commands.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🦫 Testando Comandos Cappy via CLI...\n');

// Lista de comandos para testar
const commands = [
    { id: 'cappy.version', name: 'Get Version', description: 'Obter versão do Cappy' },
    { id: 'cappy.init', name: 'Initialize', description: 'Inicializar estrutura Cappy' },
    { id: 'cappy.knowstack', name: 'KnowStack', description: 'Analisar stack do projeto' },
    { id: 'cappy.new', name: 'New Task', description: 'Criar nova tarefa' }
];

// Função para executar comando via VS Code CLI
function executeVSCodeCommand(commandId) {
    return new Promise((resolve, reject) => {
        const cmd = `code --command ${commandId}`;
        console.log(`🔄 Executando: ${cmd}`);
        
        exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// Função para verificar arquivos criados
function checkCappyFiles() {
    console.log('\n📁 Verificando arquivos criados...');
    
    const filesToCheck = [
        '.cappy/config.yaml',
        '.cappy/output.txt',
        '.cappy/stack.md',
        '.github/copilot-instructions.md'
    ];
    
    filesToCheck.forEach(file => {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            console.log(`✅ ${file} - ${stats.size} bytes`);
        } else {
            console.log(`❌ ${file} - não encontrado`);
        }
    });
}

// Função principal de teste
async function runTests() {
    console.log('📍 Diretório de trabalho:', process.cwd());
    console.log('📦 Testando extensão Cappy instalada...\n');
    
    for (const command of commands) {
        try {
            console.log(`\n🧪 Teste: ${command.name} (${command.id})`);
            console.log(`📝 ${command.description}`);
            
            const result = await executeVSCodeCommand(command.id);
            
            if (result.stdout) {
                console.log('📤 Saída:', result.stdout.trim());
            }
            
            if (result.stderr) {
                console.log('⚠️ Stderr:', result.stderr.trim());
            }
            
            console.log('✅ Comando executado com sucesso');
            
            // Aguardar um pouco entre comandos
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (err) {
            console.log('❌ Erro ao executar comando:');
            console.log('  Error:', err.error?.message || 'Erro desconhecido');
            if (err.stderr) {
                console.log('  Stderr:', err.stderr.trim());
            }
        }
    }
    
    // Verificar arquivos criados
    checkCappyFiles();
    
    // Verificar conteúdo do output.txt se existir
    const outputPath = path.join(process.cwd(), '.cappy', 'output.txt');
    if (fs.existsSync(outputPath)) {
        console.log('\n📄 Conteúdo do .cappy/output.txt:');
        console.log('=' * 50);
        const content = fs.readFileSync(outputPath, 'utf8');
        console.log(content || '(arquivo vazio)');
        console.log('=' * 50);
    }
    
    console.log('\n🎉 Testes concluídos!');
}

// Executar testes
runTests().catch(console.error);