/**
 * Script to clear all files from the metadata database
 * Now using workspace .cappy/data directory
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function clearDatabase() {
  try {
    // Database is now in workspace .cappy/data folder
    const workspaceRoot = process.cwd();
    const dbPath = path.join(workspaceRoot, '.cappy', 'data', 'file-metadata.db');

    console.log('🔍 Looking for database at:', dbPath);

    if (!fs.existsSync(dbPath)) {
      console.log('❌ Database file not found at:', dbPath);
      console.log('\n💡 Make sure:');
      console.log('   1. You are running this from the workspace root');
      console.log('   2. The Cappy extension has been initialized');
      console.log('   3. The file processing system has created the database');
      return;
    }

    console.log('✅ Found database file');

    // Initialize sql.js
    const SQL = await initSqlJs();
    
    // Load database
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Count records before clearing
    const countBefore = db.exec('SELECT COUNT(*) as count FROM file_metadata');
    const recordsBefore = countBefore[0]?.values[0]?.[0] || 0;
    
    console.log(`📊 Records before clearing: ${recordsBefore}`);

    if (recordsBefore === 0) {
      console.log('✅ Database is already empty');
      db.close();
      return;
    }

    // Clear the table
    db.run('DELETE FROM file_metadata');
    
    // Count records after clearing
    const countAfter = db.exec('SELECT COUNT(*) as count FROM file_metadata');
    const recordsAfter = countAfter[0]?.values[0]?.[0] || 0;

    console.log(`📊 Records after clearing: ${recordsAfter}`);

    // Save database
    const data = db.export();
    fs.writeFileSync(dbPath, data);
    
    console.log('✅ Database cleared successfully!');
    console.log(`🗑️  Removed ${recordsBefore} record(s)`);

    db.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

clearDatabase();
