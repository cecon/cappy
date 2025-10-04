# Teste Final do Cappy
Write-Host "🦫 Teste Final - Cappy v2.9.11" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Gray

Write-Host "`n📋 INSTRUCOES:" -ForegroundColor Yellow
Write-Host "1. Feche TODAS as janelas do VS Code" -ForegroundColor White
Write-Host "2. Abra o VS Code novamente: code ." -ForegroundColor White
Write-Host "3. Aguarde 5 segundos para a extensao ativar" -ForegroundColor White
Write-Host "4. Pressione: Ctrl + Shift + P" -ForegroundColor Cyan
Write-Host "5. Digite: Cappy: Get Version" -ForegroundColor Cyan
Write-Host "6. Pressione Enter" -ForegroundColor Cyan

Write-Host "`n✅ RESULTADO ESPERADO:" -ForegroundColor Green
Write-Host "- Deve mostrar '2.9.11' na barra de status" -ForegroundColor White
Write-Host "- Nenhum erro deve aparecer" -ForegroundColor White

Write-Host "`n❌ SE DER ERRO:" -ForegroundColor Red
Write-Host "1. Abra Developer Tools:" -ForegroundColor White
Write-Host "   - Menu: Help > Toggle Developer Tools" -ForegroundColor Cyan
Write-Host "2. Va na aba Console" -ForegroundColor White
Write-Host "3. Procure por mensagens do Cappy (🦫)" -ForegroundColor White
Write-Host "4. Copie qualquer erro que aparecer" -ForegroundColor White

Write-Host "`n🔍 VERIFICACAO ALTERNATIVA:" -ForegroundColor Yellow
Write-Host "Pressione Ctrl + Shift + P e digite:" -ForegroundColor White
Write-Host "   Developer: Show Running Extensions" -ForegroundColor Cyan
Write-Host "Procure por 'Cappy' e veja o status" -ForegroundColor White

Write-Host "`n" + ("=" * 60) -ForegroundColor Gray

$choice = Read-Host "`nDeseja que eu abra o VS Code agora? (S/N)"
if ($choice -eq "S" -or $choice -eq "s") {
    Write-Host "`nAbrindo VS Code..." -ForegroundColor Green
    code .
    Start-Sleep -Seconds 2
    Write-Host "`nVS Code aberto! Aguarde alguns segundos e teste o comando." -ForegroundColor Green
}

Write-Host "`n✅ Script concluido!" -ForegroundColor Green