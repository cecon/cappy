/**
 * Script para executar limpeza de órfãos diretamente
 * Run via VS Code Developer Console (Ctrl+Shift+I)
 */

async function runCleanup() {
    console.log('🧹 Iniciando limpeza de chunks e entidades órfãos...\n');
    
    try {
        // Executar comando de limpeza
        await vscode.commands.executeCommand('cappy.CappyRAG.cleanOrphanedData');
        console.log('✅ Comando de limpeza executado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao executar limpeza:', error);
    }
}

// Para executar no Developer Console:
// 1. Pressione Ctrl+Shift+I (Developer Tools)
// 2. Vá para a aba Console
// 3. Cole este código e pressione Enter
// 4. Execute: runCleanup()

console.log('Script carregado. Execute: runCleanup()');
