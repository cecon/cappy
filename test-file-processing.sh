#!/bin/bash

# Script to run the file processing integration test
# This test creates a temporary workspace, processes a TypeScript file,
# and verifies that nodes, vectors, and relationships are correctly created

echo "🧪 Running File Processing Integration Test"
echo "=============================================="
echo ""
echo "This test will:"
echo "  1. Create a temporary workspace"
echo "  2. Generate a sample TypeScript file with TSDoc"
echo "  3. Initialize SQLite database, LanceDB, and Kuzu"
echo "  4. Process the file through the queue system"
echo "  5. Verify nodes and vectors are created"
echo "  6. Test hybrid search functionality"
echo ""
echo "Expected duration: ~30-60 seconds"
echo ""

# Run the test
npx vitest run src/services/__tests__/file-processing-integration.test.ts --reporter=verbose

echo ""
echo "=============================================="
echo "Test completed!"
