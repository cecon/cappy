# CappyRAG Schema Migration (v2.9.46)

## 🔄 What Changed

Version 2.9.46 adds a new `processingResults` field to the documents table schema to track processing statistics (entities, relationships, chunks, and processing time).

## ⚠️ Important: Schema Migration Required

If you upgraded from a previous version, you need to migrate your database schema.

### Automatic Migration

Run the migration script:

```bash
node migrate-cappyrag-schema.js
```

This script will:
1. ✅ Create a backup of your existing documents table
2. ✅ Delete the old table with the old schema
3. ✅ The extension will recreate the table with the new schema on next use

### After Migration

1. **Reload VS Code:**
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
   - Type "Developer: Reload Window" and press Enter

2. **Upload documents:**
   - Your documents were backed up but need to be re-uploaded
   - The new schema will be created automatically on first upload

### Backup Location

Your old data is backed up at:
```
.cappy/cappyrag-data/documents.lance.backup-{timestamp}/
```

### New Schema Structure

```typescript
{
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  filePath: string;
  fileName: string;
  fileSize: number;
  content: string;
  status: 'processing' | 'completed' | 'failed';
  processingResults?: {        // ⭐ NEW FIELD
    entities: number;
    relationships: number;
    chunks: number;
    processingTime: string;
  };
  created: string;
  updated: string;
}
```

## 🐛 Troubleshooting

### Error: "Found field not in schema: processingResults.entities"

This means you need to run the migration script. Follow the steps above.

### Migration Script Fails

If the script fails with "EBUSY" or similar error:

1. Close VS Code completely
2. Run the migration script again
3. Reopen VS Code

### Manual Migration

If the automatic script doesn't work, you can manually delete the old table:

1. Close VS Code
2. Delete: `.cappy/cappyrag-data/documents.lance/`
3. Reopen VS Code
4. Upload a document to recreate the table

## 📊 What Gets Reset

- ❌ Document list (needs re-upload)
- ✅ Entities (preserved)
- ✅ Relationships (preserved)
- ✅ Chunks (preserved)

Only the documents table is affected. All extracted entities, relationships, and chunks remain intact.

## 🆘 Need Help?

If you encounter issues, check:
- VS Code Output panel → "Cappy" channel
- Developer Console: `Ctrl+Shift+I` → Console tab

---

**Version:** 2.9.46  
**Date:** October 5, 2025
