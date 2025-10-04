# Teste Simples dos Comandos Cappy
param()

Write-Host "Testando comandos Cappy instalados..." -ForegroundColor Cyan

# Verificar estrutura Cappy
Write-Host "`nVerificando estrutura Cappy..." -ForegroundColor Yellow

$cappyFiles = @(
    ".cappy\config.yaml",
    ".cappy\stack.md", 
    ".cappy\output.txt",
    ".github\copilot-instructions.md"
)

foreach ($file in $cappyFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "OK: $file ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "FALHA: $file nao encontrado" -ForegroundColor Red
    }
}

# Verificar se a extensão está instalada
Write-Host "`nVerificando extensao instalada..." -ForegroundColor Yellow
$extensions = code --list-extensions
if ($extensions -contains "eduardocecon.cappy") {
    Write-Host "OK: Extensao Cappy esta instalada" -ForegroundColor Green
} else {
    Write-Host "FALHA: Extensao Cappy nao encontrada" -ForegroundColor Red
}

# Instruções para teste manual
Write-Host "`nPara testar manualmente os comandos:" -ForegroundColor Cyan
Write-Host "1. Abra VS Code: code ." -ForegroundColor White
Write-Host "2. Pressione Ctrl+Shift+P" -ForegroundColor White
Write-Host "3. Digite 'Cappy:' para ver comandos" -ForegroundColor White
Write-Host "4. Execute: Cappy: Get Version" -ForegroundColor White
Write-Host "5. Verifique .cappy\output.txt" -ForegroundColor White

# Verificar conteúdo do output.txt se existir
if (Test-Path ".cappy\output.txt") {
    $content = Get-Content ".cappy\output.txt" -Raw
    if ($content) {
        Write-Host "`nConteudo atual do output.txt:" -ForegroundColor Yellow
        Write-Host $content -ForegroundColor White
    } else {
        Write-Host "`noutput.txt esta vazio" -ForegroundColor Yellow
    }
}

Write-Host "`nTeste concluido!" -ForegroundColor Green