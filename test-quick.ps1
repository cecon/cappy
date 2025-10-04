Write-Host "🦫 Teste Simples de Funcionamento do Cappy" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Gray

Write-Host "`n1. Verificando instalacao..." -ForegroundColor Yellow
$installed = code --list-extensions 2>$null | Select-String "eduardocecon.cappy"

if ($installed) {
    Write-Host "✅ Cappy instalado: $installed" -ForegroundColor Green
} else {
    Write-Host "❌ Cappy NAO instalado" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Verificando estrutura de arquivos..." -ForegroundColor Yellow
$extPath = Get-ChildItem "$env:USERPROFILE\.vscode\extensions" -Directory | Where-Object { $_.Name -like "eduardocecon.cappy*" } | Select-Object -First 1

if ($extPath) {
    Write-Host "✅ Pasta: $($extPath.FullName)" -ForegroundColor Green
    
    $mainFile = Join-Path $extPath.FullName "out\extension.js"
    if (Test-Path $mainFile) {
        $size = (Get-Item $mainFile).Length
        Write-Host "✅ Arquivo principal existe: extension.js ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "❌ Arquivo principal NAO encontrado!" -ForegroundColor Red
    }
    
    $commands = Join-Path $extPath.FullName "out\commands"
    if (Test-Path $commands) {
        $cmdFiles = Get-ChildItem $commands -Filter "*.js" | Measure-Object
        Write-Host "✅ Pasta commands existe: $($cmdFiles.Count) arquivos" -ForegroundColor Green
    } else {
        Write-Host "❌ Pasta commands NAO encontrada!" -ForegroundColor Red
    }
}

Write-Host "`n" + ("=" * 60) -ForegroundColor Gray
Write-Host "`n🎯 PROXIMO PASSO (IMPORTANTE!):" -ForegroundColor Yellow
Write-Host "`n1. Abra o VS Code" -ForegroundColor White
Write-Host "2. Pressione: Ctrl + Shift + P" -ForegroundColor Cyan
Write-Host "3. Digite: Developer: Show Running Extensions" -ForegroundColor Cyan
Write-Host "4. Pressione Enter" -ForegroundColor Cyan
Write-Host "`n5. Na lista que abrir, procure por 'Cappy'" -ForegroundColor White
Write-Host "   ✅ Se aparecer 'Activated' = FUNCIONANDO!" -ForegroundColor Green
Write-Host "   ❌ Se NAO aparecer ou tiver erro = PROBLEMA!" -ForegroundColor Red

Write-Host "`n" + ("=" * 60) -ForegroundColor Gray
Write-Host "`n🧪 TESTE ALTERNATIVO:" -ForegroundColor Yellow
Write-Host "`n1. Pressione: Ctrl + Shift + P" -ForegroundColor Cyan
Write-Host "2. Digite: Cappy" -ForegroundColor Cyan
Write-Host "3. Veja se aparecem comandos do Cappy" -ForegroundColor Cyan
Write-Host "`nSe NAO aparecer nada, a extensao nao esta ativa!" -ForegroundColor Red

Write-Host "`n✅ Script concluido!" -ForegroundColor Green