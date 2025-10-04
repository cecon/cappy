# Script para Reinstalar o Cappy - Desenvolvimento Rápido
# Uso: .\reinstall-cappy.ps1

Write-Host "🔄 Reinstalando Cappy..." -ForegroundColor Cyan

# 1. Desinstalar versão atual
Write-Host "`n📦 Desinstalando versão anterior..." -ForegroundColor Yellow
code --uninstall-extension eduardocecon.cappy

# 2. Compilar TypeScript
Write-Host "`n🔨 Compilando TypeScript..." -ForegroundColor Yellow
npm run compile

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Erro na compilação!" -ForegroundColor Red
    exit 1
}

# 3. Empacotar extensão
Write-Host "`n📦 Empacotando extensão..." -ForegroundColor Yellow
npm run package

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Erro ao empacotar!" -ForegroundColor Red
    exit 1
}

# 4. Obter a versão do package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version
$vsixFile = "cappy-$version.vsix"

# 5. Instalar nova versão
Write-Host "`n📥 Instalando versão $version..." -ForegroundColor Yellow
code --install-extension $vsixFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Erro ao instalar!" -ForegroundColor Red
    exit 1
}

# 6. Sucesso
Write-Host "`n✅ Cappy v$version instalado com sucesso!" -ForegroundColor Green
Write-Host "📝 Arquivo: $vsixFile" -ForegroundColor Gray

# 7. Instruções finais
Write-Host "`n📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. Recarregue o VS Code (Ctrl+Shift+P → 'Developer: Reload Window')" -ForegroundColor White
Write-Host "   2. Ou feche e reabra o VS Code" -ForegroundColor White
Write-Host "   3. Teste o comando: Ctrl+Shift+P → 'Mini-LightRAG: Open Graph'" -ForegroundColor White

Write-Host "`n🎉 Pronto para testar!" -ForegroundColor Green
