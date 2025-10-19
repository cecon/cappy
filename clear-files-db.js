/**
 * Script to clear all files from the metadata database
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function clearDatabase() {
  try {
    // Find the database path (VS Code global storage)
    // Adjust this path if needed
    const vscodePath = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'eduardocecon.cappy');
    let dbPath = path.join(vscodePath, 'file-metadata.db');

    console.log('🔍 Looking for database at:', dbPath);

    if (!fs.existsSync(dbPath)) {
      console.log('❌ Database file not found at:', dbPath);
      console.log('\nTrying alternative path...');
      
      // Try alternative path (extension development)
      const altPath = path.join(os.homedir(), 'Library', 'Application Support', 'Code - Insiders', 'User', 'globalStorage', 'eduardocecon.cappy', 'file-metadata.db');
      console.log('🔍 Checking:', altPath);
      
      if (!fs.existsSync(altPath)) {
        console.log('❌ Database not found. Please check the path.');
        return;
      }
      
      // Use alternative path
      dbPath = altPath;
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
