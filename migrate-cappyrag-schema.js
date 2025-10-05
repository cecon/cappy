/**
 * Migration Script: Update CappyRAG LanceDB Schema
 * 
 * This script deletes and recreates the documents table with the new schema
 * that includes the processingResults field.
 * 
 * Usage: node migrate-cappyrag-schema.js
 */

const fs = require('fs');
const path = require('path');

async function migrateSchema() {
    console.log('🔄 Starting CappyRAG schema migration...\n');

    // Find workspace folder
    const workspaceFolder = process.cwd();
    const cappyragDbPath = path.join(workspaceFolder, '.cappy', 'cappyrag-data');

    console.log(`📁 Workspace: ${workspaceFolder}`);
    console.log(`📊 Database path: ${cappyragDbPath}\n`);

    // Check if database exists
    if (!fs.existsSync(cappyragDbPath)) {
        console.log('✅ No existing database found. Schema will be created on first use.');
        return;
    }

    // Check if documents.lance exists
    const documentsTablePath = path.join(cappyragDbPath, 'documents.lance');
    if (!fs.existsSync(documentsTablePath)) {
        console.log('✅ No documents table found. Schema will be created on first use.');
        return;
    }

    console.log('⚠️  Found existing documents table with old schema.');
    console.log('📋 This will:');
    console.log('   1. Backup existing data');
    console.log('   2. Delete old table');
    console.log('   3. Let extension recreate with new schema\n');

    // Create backup
    const backupPath = path.join(cappyragDbPath, `documents.lance.backup-${Date.now()}`);
    console.log(`💾 Creating backup: ${path.basename(backupPath)}`);
    
    try {
        // Copy directory recursively
        copyDirectory(documentsTablePath, backupPath);
        console.log('✅ Backup created successfully\n');
    } catch (error) {
        console.error('❌ Failed to create backup:', error.message);
        process.exit(1);
    }

    // Delete old table
    console.log('🗑️  Deleting old documents table...');
    try {
        deleteDirectory(documentsTablePath);
        console.log('✅ Old table deleted\n');
    } catch (error) {
        console.error('❌ Failed to delete old table:', error.message);
        console.log('ℹ️  You may need to close VS Code and run this script again.');
        process.exit(1);
    }

    console.log('✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Reload VS Code window (Ctrl+Shift+P → "Developer: Reload Window")');
    console.log('   2. Upload a document to CappyRAG');
    console.log('   3. New schema will be created automatically\n');
    console.log('💡 Note: You will need to re-upload your documents.');
    console.log(`📦 Backup location: ${backupPath}\n`);
}

function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function deleteDirectory(dir) {
    if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                deleteDirectory(fullPath);
            } else {
                fs.unlinkSync(fullPath);
            }
        }

        fs.rmdirSync(dir);
    }
}

// Run migration
migrateSchema().catch(error => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
});
