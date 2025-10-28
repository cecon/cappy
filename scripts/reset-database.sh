#!/bin/bash

# Script para resetar o banco de dados do Cappy
# Isso força a recriação com o schema atualizado

echo "🔄 Resetando banco de dados do Cappy..."

# Encontra e remove bancos no workspace
if [ -f ".cappy/file-metadata.db" ]; then
  echo "  Removendo .cappy/file-metadata.db"
  rm .cappy/file-metadata.db
fi

if [ -f ".cappy/data/file-metadata.db" ]; then
  echo "  Removendo .cappy/data/file-metadata.db"
  rm .cappy/data/file-metadata.db
fi

# Remove backups antigos se existirem
if [ -f ".cappy/file-metadata.db-backup" ]; then
  echo "  Removendo backup antigo"
  rm .cappy/file-metadata.db-backup
fi

if [ -f ".cappy/data/file-metadata.db-backup" ]; then
  echo "  Removendo backup antigo"
  rm .cappy/data/file-metadata.db-backup
fi

echo ""
echo "✅ Banco de dados resetado!"
echo ""
echo "📦 Próximos passos:"
echo "   1. Instale a nova versão da extensão:"
echo "      - Abra VS Code"
echo "      - Cmd+Shift+P → 'Extensions: Install from VSIX...'"
echo "      - Selecione: cappy-3.0.8-darwin-arm64.vsix"
echo ""
echo "   2. Recarregue a janela:"
echo "      - Cmd+R ou Cmd+Shift+P → 'Developer: Reload Window'"
echo ""
echo "   3. Execute um novo scan:"
echo "      - Abra a view 'Cappy Documents'"
echo "      - Clique em 'Scan Workspace'"
echo ""
