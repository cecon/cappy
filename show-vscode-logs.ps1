# Script para encontrar e mostrar os logs do VS Code
# Execute: .\show-vscode-logs.ps1

Write-Host "🔍 Procurando logs do VS Code..." -ForegroundColor Cyan

# Encontrar a pasta de logs mais recente
$logsPath = "$env:APPDATA\Code\logs"

if (Test-Path $logsPath) {
    Write-Host "✅ Pasta de logs encontrada: $logsPath" -ForegroundColor Green
    
    # Listar pastas de log ordenadas por data (mais recente primeiro)
    $logFolders = Get-ChildItem $logsPath | Sort-Object LastWriteTime -Descending
    
    if ($logFolders.Count -gt 0) {
        $latestLogFolder = $logFolders[0].FullName
        Write-Host "`n📁 Pasta de log mais recente: $($logFolders[0].Name)" -ForegroundColor Yellow
        
        # Procurar por arquivos de log de extensão
        $extHostLogs = Get-ChildItem -Path $latestLogFolder -Recurse -Filter "*.log" | 
                       Where-Object { $_.Name -like "*exthost*" -or $_.Name -like "*extension*" }
        
        if ($extHostLogs.Count -gt 0) {
            Write-Host "`n📄 Arquivos de log encontrados:" -ForegroundColor Cyan
            foreach ($log in $extHostLogs) {
                Write-Host "  - $($log.FullName)" -ForegroundColor White
            }
            
            # Mostrar conteúdo dos logs filtrando por "cappy"
            Write-Host "`n🦫 Procurando mensagens do Cappy nos logs..." -ForegroundColor Yellow
            Write-Host ("=" * 80) -ForegroundColor Gray
            
            $cappyFound = $false
            foreach ($log in $extHostLogs) {
                $content = Get-Content $log.FullName -Raw -ErrorAction SilentlyContinue
                if ($content -and ($content -match "(?i)cappy")) {
                    $cappyFound = $true
                    Write-Host "`n📝 Encontrado em: $($log.Name)" -ForegroundColor Green
                    
                    # Filtrar linhas que contêm "cappy"
                    $cappyLines = Get-Content $log.FullName | Select-String -Pattern "cappy" -CaseSensitive:$false
                    
                    if ($cappyLines.Count -gt 0) {
                        Write-Host "Total de linhas com 'cappy': $($cappyLines.Count)" -ForegroundColor Cyan
                        Write-Host "`nÚltimas 30 linhas:" -ForegroundColor Yellow
                        $cappyLines | Select-Object -Last 30 | ForEach-Object {
                            Write-Host $_.Line -ForegroundColor White
                        }
                    }
                }
            }
            
            if (-not $cappyFound) {
                Write-Host "`n⚠️ Nenhuma mensagem do Cappy encontrada nos logs!" -ForegroundColor Red
                Write-Host "Isso pode indicar que a extensão não está sendo ativada." -ForegroundColor Yellow
                
                Write-Host "`n📋 Mostrando últimas 50 linhas do log geral:" -ForegroundColor Cyan
                $mainLog = $extHostLogs | Select-Object -First 1
                Get-Content $mainLog.FullName -Tail 50 | ForEach-Object {
                    Write-Host $_ -ForegroundColor Gray
                }
            }
            
        } else {
            Write-Host "`n⚠️ Nenhum arquivo de log de extensões encontrado" -ForegroundColor Yellow
        }
        
        # Oferecer abrir a pasta de logs
        Write-Host "`n" + ("=" * 80) -ForegroundColor Gray
        Write-Host "`n💡 Para ver todos os logs, abra a pasta:" -ForegroundColor Cyan
        Write-Host "   $latestLogFolder" -ForegroundColor White
        
        $openFolder = Read-Host "`nDeseja abrir a pasta de logs? (S/N)"
        if ($openFolder -eq "S" -or $openFolder -eq "s") {
            explorer $latestLogFolder
        }
        
    } else {
        Write-Host "❌ Nenhuma pasta de log encontrada" -ForegroundColor Red
    }
    
} else {
    Write-Host "❌ Pasta de logs não existe: $logsPath" -ForegroundColor Red
}

Write-Host "`n✅ Script concluído!" -ForegroundColor Green
Write-Host "`n💡 Dica: Recarregue o VS Code (Ctrl+Shift+P > Developer: Reload Window)" -ForegroundColor Cyan
Write-Host "   e execute este script novamente para ver logs frescos." -ForegroundColor Cyan