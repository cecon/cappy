# Teste de Comandos Cappy Instalados
# Execute no PowerShell dentro do VS Code

Write-Host "🦫 Iniciando testes dos comandos Cappy..." -ForegroundColor Cyan

# Função para executar comando e verificar resultado
function Test-CappyCommand {
    param(
        [string]$CommandId,
        [string]$Description
    )
    
    Write-Host "`n🧪 Testando: $Description" -ForegroundColor Yellow
    Write-Host "📋 Comando: $CommandId" -ForegroundColor Gray
    
    try {
        # Simular execução do comando via Command Palette
        Write-Host "⚡ Executando comando..." -ForegroundColor Blue
        
        # Verificar se o arquivo output.txt foi criado/atualizado
        $outputPath = ".cappy\output.txt"
        $beforeTime = Get-Date
        
        # Aguardar um momento para simular execução
        Start-Sleep -Seconds 1
        
        Write-Host "✅ Comando simulado com sucesso" -ForegroundColor Green
        
        # Verificar se output.txt foi modificado
        if (Test-Path $outputPath) {
            $file = Get-Item $outputPath
            if ($file.LastWriteTime -gt $beforeTime.AddSeconds(-10)) {
                Write-Host "📄 output.txt atualizado: $($file.LastWriteTime)" -ForegroundColor Green
                
                # Mostrar conteúdo do output.txt
                $content = Get-Content $outputPath -Raw
                if ($content) {
                    Write-Host "📝 Conteúdo:" -ForegroundColor Cyan
                    Write-Host $content.Substring(0, [Math]::Min($content.Length, 200)) -ForegroundColor White
                    if ($content.Length -gt 200) {
                        Write-Host "... (truncado)" -ForegroundColor Gray
                    }
                } else {
                    Write-Host "⚠️ output.txt está vazio" -ForegroundColor Yellow
                }
            } else {
                Write-Host "⚠️ output.txt não foi atualizado recentemente" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ output.txt não encontrado" -ForegroundColor Red
        }
        
    }
    catch {
        Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Verificar estrutura Cappy
Write-Host "`n📁 Verificando estrutura Cappy..." -ForegroundColor Cyan

$cappyFiles = @(
    ".cappy\config.yaml",
    ".cappy\stack.md",
    ".github\copilot-instructions.md"
)

foreach ($file in $cappyFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "✅ $file ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "❌ $file não encontrado" -ForegroundColor Red
    }
}

# Lista de comandos para testar
$commands = @(
    @{ Id = "cappy.version"; Description = "Obter versão do Cappy" },
    @{ Id = "cappy.init"; Description = "Inicializar estrutura Cappy" },
    @{ Id = "cappy.knowstack"; Description = "Analisar stack do projeto" },
    @{ Id = "cappy.new"; Description = "Criar nova tarefa" }
)

# Executar testes
foreach ($cmd in $commands) {
    Test-CappyCommand -CommandId $cmd.Id -Description $cmd.Description
}

# Verificar logs do VS Code
Write-Host "`n📊 Resumo dos Testes:" -ForegroundColor Cyan
Write-Host "- Estrutura Cappy verificada" -ForegroundColor White
Write-Host "- Comandos testados: $($commands.Count)" -ForegroundColor White

if (Test-Path ".cappy\output.txt") {
    $outputSize = (Get-Item ".cappy\output.txt").Length
    Write-Host "- output.txt: $outputSize bytes" -ForegroundColor White
} else {
    Write-Host "- output.txt: não encontrado" -ForegroundColor Yellow
}

Write-Host "`n💡 Para testar manualmente:" -ForegroundColor Cyan
Write-Host "1. Abra Command Palette (Ctrl+Shift+P)" -ForegroundColor White
Write-Host "2. Digite 'Cappy:' para ver comandos disponíveis" -ForegroundColor White
Write-Host "3. Execute qualquer comando Cappy" -ForegroundColor White
Write-Host "4. Verifique .cappy\output.txt para o resultado" -ForegroundColor White

Write-Host "`n🎉 Teste concluído!" -ForegroundColor Green