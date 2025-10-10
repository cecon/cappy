# Instala e testa a extensão Cappy localmente
# 1. Build React/Vite
# 2. Cria pacote VSIX
# 3. Instala no VS Code

Write-Host "[Cappy] Buildando React/Vite..."
npm run build

Write-Host "[Cappy] Gerando pacote VSIX..."
npm run package

$vsix = Get-ChildItem -Path . -Filter "cappy-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($vsix) {
    Write-Host "[Cappy] Instalando pacote $($vsix.Name) no VS Code..."
    code --install-extension $vsix.FullName
    Write-Host "[Cappy] Instalação concluída!"
} else {
    Write-Error "[Cappy] Pacote VSIX não encontrado."
}
