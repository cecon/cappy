# Script de instalação da extensão Cappy para Windows
# Este script compila, empacota e instala a extensão no VS Code

Write-Host '==================================' -ForegroundColor Cyan
Write-Host 'Cappy Framework - Instalação' -ForegroundColor Cyan
Write-Host '==================================' -ForegroundColor Cyan
Write-Host ''

# Verifica se o Node.js está instalado
Write-Host 'Verificando Node.js...' -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'ERRO: Node.js não está instalado!' -ForegroundColor Red
    Write-Host 'Por favor, instale o Node.js em https://nodejs.org' -ForegroundColor Red
    exit 1
}

# Verifica se o VS Code está instalado
Write-Host 'Verificando VS Code...' -ForegroundColor Yellow
if (-not (Get-Command code -ErrorAction SilentlyContinue)) {
    Write-Host 'ERRO: VS Code não está instalado ou não está no PATH!' -ForegroundColor Red
    Write-Host 'Por favor, instale o VS Code em https://code.visualstudio.com' -ForegroundColor Red
    exit 1
}

Write-Host '✓ Dependências OK' -ForegroundColor Green
Write-Host ''

# Clean previous build artifacts
Write-Host 'Limpando artefatos anteriores (out/, dist/)...' -ForegroundColor Yellow
if (Test-Path "out") { Remove-Item -Recurse -Force "out" }
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }

# Build UI and extension
Write-Host 'Compilando (tsc + vite)...' -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERRO: Falha no build (tsc/vite)!' -ForegroundColor Red
    exit 1
}

# Ensure extension entry is compiled (safety)
Write-Host 'Compilando entrada da extensão...' -ForegroundColor Yellow
npm run compile-extension
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERRO: Falha ao compilar a extensão!' -ForegroundColor Red
    exit 1
}
Write-Host '✓ Compilação concluída' -ForegroundColor Green
Write-Host ''

# Package para Windows
Write-Host 'Empacotando extensão para Windows...' -ForegroundColor Yellow
npm run package:win32
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERRO: Falha ao empacotar a extensão!' -ForegroundColor Red
    exit 1
}
Write-Host '✓ Empacotamento concluído' -ForegroundColor Green
Write-Host ''

# Encontra o arquivo .vsix gerado
$vsixFile = Get-ChildItem -Filter "cappy-*-win32.vsix" | Select-Object -First 1

if (-not $vsixFile) {
    Write-Host 'ERRO: Arquivo .vsix não encontrado!' -ForegroundColor Red
    exit 1
}

# Instala a extensão
Write-Host "Instalando extensão $($vsixFile.Name)..." -ForegroundColor Yellow
code --install-extension $vsixFile.FullName --force
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERRO: Falha ao instalar a extensão!' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '==================================' -ForegroundColor Green
Write-Host '✓ Instalação concluída com sucesso!' -ForegroundColor Green
Write-Host '==================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Reinicie o VS Code para ativar a extensão.' -ForegroundColor Cyan
