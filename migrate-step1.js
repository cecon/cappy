const fs = require('fs');
const filePath = 'd:/projetos/cappy-framework/src/adapters/secondary/graph/sqlite-adapter.ts';
const backupPath = filePath + '.backup';
let content = fs.readFileSync(backupPath, 'utf-8');
content = content.replace(/import initSqlJs[^;]+;/, "import * as sqlite3 from 'sqlite3';");
content = content.replace(/private SQL: SqlJsStatic \| null = null;\n/, '');
content = content.replace(/private db: SqlJsDatabase \| null/, 'private db: sqlite3.Database | null');
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done');
