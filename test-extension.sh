#!/bin/bash
echo "Testing FORGE Extension v1.0.26"
echo "=================================="

# Start VS Code with a specific workspace and wait
echo "1. Starting VS Code with test workspace..."
cd test-forge
code . &
sleep 5

echo "2. Extension should show activation message"
echo "3. Try Ctrl+Shift+P and search for 'FORGE'"
echo "4. Execute the 'Test FORGE Extension' command"

echo ""
echo "Manual testing steps:"
echo "- Press Ctrl+Shift+P"
echo "- Type 'FORGE'"  
echo "- Select '🧪 Test FORGE Extension'"
echo "- Should see success messages"

echo ""
echo "If the command appears and executes, the extension is working!"
