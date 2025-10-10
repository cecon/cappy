<#
Instala/atualiza a extensão Cappy localmente
1) Build React/Vite
2) Empacota VSIX (sem prompts)
3) Desinstala versão anterior (se existir)
4) Instala o VSIX gerado com --force

Observação: Execute este script em um PowerShell EXTERNO (fora do VS Code),
pois ele pode encerrar processos do VS Code durante a instalação.
#>

function Stop-VSCodeIfRunning {
    try {
        $procs = Get-Process -Name "Code" -ErrorAction SilentlyContinue
        if ($procs) {
            Write-Host "[Cappy] Encerrando VS Code para prosseguir com a instalação..."
            $procs | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    } catch {}
}

function Install-Vsix {
    param(
        [Parameter(Mandatory=$true)][string]$VsixPath
    )
    Write-Host "[Cappy] Instalando pacote $([System.IO.Path]::GetFileName($VsixPath)) no VS Code..."
    code --install-extension $VsixPath --force 2>$null
    Write-Host "[Cappy] Verificando instalação..."
    try { code --list-extensions --show-versions 2>$null | Select-String 'eduardocecon.cappy' } catch {}
}

Write-Host "[Cappy] Buildando React/Vite..."
npm run build

Write-Host "[Cappy] Gerando pacote VSIX..."
npm run compile-extension
# Forçar uso de npm (sem yarn) e pular reinstalação de deps para agilizar
npx vsce package --allow-missing-repository --no-yarn --no-dependencies

$vsix = Get-ChildItem -Path . -Filter "cappy-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $vsix) {
    Write-Error "[Cappy] Pacote VSIX não encontrado."
    exit 1
}

# Se o script estiver rodando dentro do terminal integrado do VS Code,
# execute a instalação em um processo separado e finalize este script
# (o VS Code será fechado pelo processo em background).
$insideVSCode = [bool]$env:VSCODE_PID
if ($insideVSCode) {
    Write-Host "[Cappy] Detectado terminal do VS Code. Iniciando instalação em background e fechando este VS Code." -ForegroundColor Yellow
    $bgScript = @"
param([string]
    [Parameter(Mandatory=
        `$true)]
    `$VsixPath)
Write-Host '[Cappy] (background) Iniciando instalação...'
try { } catch {}
Start-Sleep -Seconds 1
try {
  `$procs = Get-Process -Name 'Code' -ErrorAction SilentlyContinue
  if (`$procs) { `$procs | Stop-Process -Force -ErrorAction SilentlyContinue }
} catch {}
Start-Sleep -Seconds 1
& code --install-extension "`$VsixPath" --force 2>$null
Write-Host '[Cappy] (background) Verificando instalação...'
try { & code --list-extensions --show-versions 2>$null | Select-String 'eduardocecon.cappy' } catch {}
Write-Host '[Cappy] (background) Instalação concluída.'
"@
    $temp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "cappy-install-$(Get-Date -UFormat %s).ps1")
    $bgScript | Out-File -FilePath $temp -Encoding UTF8 -Force
    Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$temp`"",'-VsixPath',"`"$($vsix.FullName)`"") -WindowStyle Hidden | Out-Null
    # Encerrar VS Code (este terminal será fechado junto)
    Stop-VSCodeIfRunning
    exit 0
} else {
    Write-Host "[Cappy] Instalando pacote $($vsix.Name) no VS Code..."
    code --install-extension $vsix.FullName --force 2>$null
    Write-Host "[Cappy] Verificando instalação..."
    try { code --list-extensions --show-versions 2>$null | Select-String 'eduardocecon.cappy' } catch {}
    Write-Host "[Cappy] Concluído. Se o ícone da Cappy não aparecer ainda, use 'Developer: Reload Window' no VS Code." -ForegroundColor Yellow
}
