# Release Notes - Cappy v2.9.46

## 🎯 Overview

This release fixes critical CappyRAG document processing issues and adds Language Model Tools support for Copilot Chat integration.

---

## ✅ Fixed Issues

### 1. LanceDB Schema Error
**Issue:** Document processing failed with error:
```
Error: Found field not in schema: processingResults.entities at row 0
```

**Root Cause:** The documents table schema was missing the `processingResults` field that tracks processing statistics.

**Fix:** 
- Added `processingResults` field as nullable Struct in schema
- Fields: `entities` (Int32), `relationships` (Int32), `chunks` (Int32), `processingTime` (Utf8)
- Created migration script to update existing databases

**File Modified:** `src/store/cappyragLanceDb.ts`

---

### 2. Missing Dependencies in VSIX
**Issue:** Extension failed to activate with error:
```
Cannot find module '@lancedb/lancedb'
```

**Root Cause:** Extension was packaged without node_modules dependencies.

**Fix:** 
- Repackaged extension with all dependencies included
- Package size: 124.17 MB (includes 9,028 node_modules files)
- All required packages now bundled: @lancedb/lancedb, apache-arrow, etc.

---

## 🆕 New Features

### Language Model Tools for Copilot

Added 5 CappyRAG tools that are now visible in Copilot Chat:

#### 1. `cappyrag_add_document`
Add documents to the knowledge base for AI analysis.

**Usage:**
```
@workspace use cappyrag_add_document with path /absolute/path/to/doc.md
```

**Parameters:**
- `filePath` (required): Absolute path to document
- `title` (optional): Custom title
- `author` (optional): Author name
- `tags` (optional): Array of tags
- `language` (optional): Language code (en, pt, es)

---

#### 2. `cappyrag_query_knowledge_base`
Query the knowledge base using hybrid search (vector + keyword).

**Usage:**
```
@workspace use cappyrag_query_knowledge_base to search for "TypeScript async patterns"
```

**Parameters:**
- `query` (required): Natural language search query
- `limit` (optional): Max results (default: 10)

**Returns:** Relevant entities, relationships, and document chunks with similarity scores.

---

#### 3. `cappyrag_get_stats`
Get knowledge base statistics.

**Usage:**
```
@workspace use cappyrag_get_stats
```

**Returns:**
- Total documents indexed
- Total entities extracted
- Total relationships mapped
- Total chunks processed

---

#### 4. `cappyrag_get_supported_formats`
List supported document formats.

**Usage:**
```
@workspace use cappyrag_get_supported_formats
```

**Returns:** File extensions, descriptions, and processing capabilities.

---

#### 5. `cappyrag_estimate_processing_time`
Estimate processing time for a document.

**Usage:**
```
@workspace use cappyrag_estimate_processing_time for /path/to/doc.pdf
```

**Parameters:**
- `filePath` (required): Absolute path to document

**Returns:** Breakdown of processing steps and estimated duration.

---

## 🔧 Migration Required

If upgrading from a previous version, you need to migrate your database schema:

### Quick Migration

```bash
node migrate-cappyrag-schema.js
```

Then reload VS Code:
- Press `Ctrl+Shift+P`
- Type "Developer: Reload Window"

### What Happens

1. ✅ Backs up existing documents table
2. ✅ Deletes old table with old schema
3. ✅ Extension recreates table with new schema on first use

### After Migration

Re-upload your documents. Entities, relationships, and chunks are preserved.

**Backup Location:** `.cappy/cappyrag-data/documents.lance.backup-{timestamp}/`

**Full Migration Guide:** See `docs/CAPPYRAG_SCHEMA_MIGRATION.md`

---

## 📦 Files Changed

- `src/store/cappyragLanceDb.ts` - Added processingResults to schema
- `src/utils/languageModelTools.ts` - Registered 5 CappyRAG tools
- `package.json` - Version bump to 2.9.46
- `migrate-cappyrag-schema.js` - New migration script
- `docs/CAPPYRAG_SCHEMA_MIGRATION.md` - Migration documentation

---

## 🧪 Testing Instructions

### 1. Test Document Processing

1. Open CappyRAG Dashboard:
   - `Ctrl+Shift+P` → "CappyRAG: Dashboard"

2. Upload a document:
   - Click "Upload Document"
   - Select a .txt, .md, or .pdf file
   - Wait for processing to complete

3. Verify:
   - ✅ No schema errors in Output panel
   - ✅ Processing results shown (entities, relationships, chunks)
   - ✅ Document appears in list with status "completed"

---

### 2. Test Copilot Integration

1. Open Copilot Chat (`Ctrl+Shift+P` → "Copilot Chat: Open")

2. Type `@workspace` and look for CappyRAG tools in suggestions

3. Test each tool:
   ```
   @workspace use cappyrag_get_stats
   @workspace use cappyrag_get_supported_formats
   @workspace use cappyrag_query_knowledge_base to find "architecture patterns"
   ```

4. Verify:
   - ✅ Tools appear in autocomplete
   - ✅ Tools execute successfully
   - ✅ Results are properly formatted

---

### 3. Test Multiple Uploads

1. Upload first document
2. Wait for processing
3. Click "Upload Document" again
4. Verify modal opens (not blocked)
5. Upload second document
6. Verify both process successfully

---

## 🐛 Known Issues

### Upload Modal Issue (In Investigation)

**Status:** Under investigation  
**Description:** Some users report that the upload modal doesn't open when processing queue has items.  
**Workaround:** Refresh the dashboard or reload VS Code window.

---

## 📊 Package Stats

- **Version:** 2.9.46
- **Package Size:** 124.17 MB
- **Total Files:** 11,785
- **Dependencies:** 9,028 files (360.69 MB)
- **Source Files:** 57 compiled TypeScript files

---

## 🔗 Resources

- **Migration Guide:** `docs/CAPPYRAG_SCHEMA_MIGRATION.md`
- **Migration Script:** `migrate-cappyrag-schema.js`
- **Backup Location:** `.cappy/cappyrag-data/documents.lance.backup-*`

---

## 🆘 Support

If you encounter issues:

1. Check VS Code Output panel → "Cappy" channel
2. Check Developer Console: `Ctrl+Shift+I` → Console tab
3. Review migration guide: `docs/CAPPYRAG_SCHEMA_MIGRATION.md`
4. Report issues on GitHub

---

**Release Date:** October 5, 2025  
**Build:** 2.9.46  
**Status:** ✅ Ready for Testing
