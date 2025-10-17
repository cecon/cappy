#!/bin/bash

echo "🧪 Running DocumentsViewProvider Tests"
echo "======================================"
echo ""
echo "This test will:"
echo "  1. Create a temporary workspace"
echo "  2. Mock VS Code APIs"
echo "  3. Test upload button functionality"
echo "  4. Verify file selection dialog"
echo "  5. Verify command execution"
echo ""
echo "Expected duration: ~5-10 seconds"
echo ""

npx vitest run src/adapters/primary/vscode/documents/__tests__/DocumentsViewProvider.test.ts --reporter=verbose

echo ""
echo "======================================"
echo "Test completed!"
