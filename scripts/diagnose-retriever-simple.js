/**
 * Simple diagnostic script for vector database
 */

const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const dbPath = path.join(workspaceRoot, '.cappy', 'data', 'graph-store.db');

console.log('🔍 Vector Database Diagnostic');
console.log('============================\n');
console.log(`Workspace: ${workspaceRoot}`);
console.log(`Database path: ${dbPath}\n`);

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.log('❌ Database file does not exist!');
  console.log('\n💡 To create the database:');
  console.log('  1. Open VS Code Command Palette (Ctrl+Shift+P)');
  console.log('  2. Run: Cappy: Initialize');
  console.log('  3. Run: Cappy: Scan Workspace');
  process.exit(1);
}

const stats = fs.statSync(dbPath);
console.log('✅ Database file exists');
console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Modified: ${stats.mtime.toLocaleString()}\n`);

// Check .cappy directory structure
console.log('📁 Cappy Directory Structure:');
const cappyDir = path.join(workspaceRoot, '.cappy');

function listDir(dir, prefix = '') {
  if (!fs.existsSync(dir)) {
    console.log(`${prefix}❌ Not found`);
    return;
  }
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const itemPath = path.join(dir, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      console.log(`${prefix}📁 ${item}/`);
      if (item !== 'node_modules' && prefix.length < 6) {
        listDir(itemPath, prefix + '  ');
      }
    } else {
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`${prefix}📄 ${item} (${sizeMB} MB)`);
    }
  });
}

listDir(cappyDir, '  ');

console.log('\n💡 To test retrieval functionality:');
console.log('  1. Make sure workspace is scanned (Cappy: Scan Workspace)');
console.log('  2. Open Output Channel "Cappy" to see logs');
console.log('  3. Try asking: "how to implement authentication"');
console.log('  4. Check if retrieval logs appear in Output');

console.log('\n✅ Diagnostic complete');
