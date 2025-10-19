#!/bin/bash

echo "🔨 Compilando extensão..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Falha na compilação"
  exit 1
fi

echo ""
echo "✅ Compilação completa!"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1. Pressione F5 no VS Code para iniciar a extensão em modo debug"
echo "2. Na janela de extensão, abra o Command Palette (Cmd+Shift+P)"
echo "3. Execute: 'Cappy: Reset Database'"
echo "4. Aguarde a conclusão"
echo "5. Observe os logs no Debug Console"
echo "6. Depois execute: node diagnose-graph-db.js"
echo ""
echo "🔍 Procure por estas mensagens nos logs:"
echo "   - '📦 Extracted N chunks from...'"
echo "   - '🕸️ Extracting AST relationships for...'"
echo "   - '🔗 Extracted N relationships'"
echo "   - '📊 SQLite: Creating N relationships...'"
echo ""
echo "Se essas mensagens NÃO aparecerem, o problema está identificado!"
echo ""
