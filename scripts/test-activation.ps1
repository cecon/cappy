# Teste Direto de Ativação do Cappy
# Este script força o reload do VS Code e mostra status da extensão

Write-Host "🦫 Teste de Ativação do Cappy" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Gray

# 1. Verificar se está instalado
Write-Host "`n1️⃣ Verificando instalação..." -ForegroundColor Yellow
$installed = code --list-extensions | Select-String "eduardocecon.cappy"

if ($installed) {
    Write-Host "✅ Cappy está instalado: $installed" -ForegroundColor Green
} else {
    Write-Host "❌ Cappy NÃO está instalado!" -ForegroundColor Red
    exit 1
}

# 2. Verificar package.json
Write-Host "`n2️⃣ Verificando package.json da extensão..." -ForegroundColor Yellow
$extPath = "$env:USERPROFILE\.vscode\extensions"
$cappyDir = Get-ChildItem $extPath -Directory | Where-Object { $_.Name -like "eduardocecon.cappy*" } | Select-Object -First 1

if ($cappyDir) {
    Write-Host "✅ Pasta da extensão: $($cappyDir.FullName)" -ForegroundColor Green
    
    $packageJson = Join-Path $cappyDir.FullName "package.json"
    if (Test-Path $packageJson) {
        $pkg = Get-Content $packageJson | ConvertFrom-Json
        Write-Host "📦 Nome: $($pkg.name)" -ForegroundColor White
        Write-Host "📦 Versão: $($pkg.version)" -ForegroundColor White
        Write-Host "📦 Main: $($pkg.main)" -ForegroundColor White
        Write-Host "📦 Activation Events: $($pkg.activationEvents -join ', ')" -ForegroundColor White
        
        # Verificar se o arquivo main existe
        $mainFile = Join-Path $cappyDir.FullName $pkg.main
        if (Test-Path $mainFile) {
            Write-Host "✅ Arquivo main existe: $mainFile" -ForegroundColor Green
        } else {
            Write-Host "❌ Arquivo main NÃO existe: $mainFile" -ForegroundColor Red
        }
        
        # Verificar comandos
        Write-Host "`n📋 Comandos registrados no package.json:" -ForegroundColor Cyan
        $pkg.contributes.commands | ForEach-Object {
            Write-Host "   - $($_.command): $($_.title)" -ForegroundColor White
        }
    }
} else {
    Write-Host "❌ Pasta da extensão não encontrada em $extPath" -ForegroundColor Red
    exit 1
}

# 3. Instruções para teste manual
Write-Host "`n" + ("=" * 60) -ForegroundColor Gray
Write-Host "`n3️⃣ PRÓXIMO PASSO: Teste Manual" -ForegroundColor Yellow
Write-Host "`nPara testar se os comandos funcionam:" -ForegroundColor White
Write-Host "1. Abra o VS Code (se já estiver aberto, feche e abra novamente)" -ForegroundColor Cyan
Write-Host "2. Pressione Ctrl+Shift+P" -ForegroundColor Cyan
Write-Host "3. Digite: Developer: Show Running Extensions" -ForegroundColor Cyan
Write-Host "4. Procure por 'Cappy' na lista" -ForegroundColor Cyan
Write-Host "5. Se estiver na lista, veja o status (ativado/erro)" -ForegroundColor Cyan
Write-Host "`nSe o Cappy aparecer como ATIVADO:" -ForegroundColor Green
Write-Host "   - Pressione Ctrl+Shift+P novamente" -ForegroundColor Cyan
Write-Host "   - Digite: Cappy: Get Version" -ForegroundColor Cyan
Write-Host "   - Deve mostrar a versão sem erro" -ForegroundColor Cyan

Write-Host "`n💡 ALTERNATIVA: Abrir Developer Tools" -ForegroundColor Yellow
Write-Host "1. No VS Code, pressione Ctrl+Shift+I" -ForegroundColor Cyan
Write-Host "2. Vá na aba 'Console'" -ForegroundColor Cyan
Write-Host "3. Procure por mensagens com 🦫 ou 'Cappy'" -ForegroundColor Cyan
Write-Host "4. Veja se há erros em vermelho" -ForegroundColor Cyan

Write-Host "`n✅ Script de verificação concluído!" -ForegroundColor Green