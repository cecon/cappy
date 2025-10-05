# Migration Script - Use New Modular Structure

This guide helps you migrate from the old monolithic `documentUpload.ts` to the new modular structure.

## Step 1: Update Imports

### Find all imports of the old file:
```bash
# Search for imports
grep -r "from.*documentUpload" src/
```

### Replace with new import:
```typescript
// OLD ❌
import { openDocumentUploadUI } from './commands/documentUpload';

// NEW ✅
import { openDocumentUploadUI } from './commands/lightrag';
```

## Step 2: Update Extension.ts

```typescript
// src/extension.ts

// OLD ❌
import { openDocumentUploadUI } from './commands/documentUpload';

// NEW ✅
import { openDocumentUploadUI } from './commands/lightrag';
```

## Step 3: Test

1. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Open dashboard: `Ctrl+Shift+P` → "Cappy: Open LightRAG Dashboard"
3. Test all features:
   - ✅ Upload document
   - ✅ View graph
   - ✅ Delete document
   - ✅ Clear all

## Step 4: Remove Old File (Optional)

After confirming everything works:

```bash
# Rename old file
mv src/commands/documentUpload.ts src/commands/documentUpload.old.ts

# Or delete
rm src/commands/documentUpload.ts
```

## Rollback Plan

If something breaks:

```typescript
// Revert import
import { openDocumentUploadUI } from './commands/documentUpload';
```

The old file still exists and works!
