#!/bin/bash
echo "🔄 Recompiling extension..."
npm run compile-extension

echo ""
echo "✅ Extension recompiled!"
echo ""
echo "📌 Next steps:"
echo "   1. In VS Code, press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)"
echo "   2. Type: 'Developer: Reload Window'"
echo "   3. Press Enter"
echo ""
echo "Or if you're debugging (F5), stop and restart the debug session."
