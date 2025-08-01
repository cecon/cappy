const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

async function testInit() {
    console.log('🧪 Testing Capybara Init Command...');
    
    try {
        // Import modules
        const { InitCapybaraCommand } = require('./out/commands/initCapybara');
        const { FileManager } = require('./out/utils/fileManager');
        
        console.log('📦 Modules loaded successfully');
        
        // Create instances
        const fileManager = new FileManager();
        const initCommand = new InitCapybaraCommand(fileManager);
        
        console.log('🎯 Executing init command...');
        
        // Execute command
        const result = await initCommand.execute();
        
        console.log(`✅ Init command result: ${result}`);
        
        // Check if files were created
        const workspaceRoot = process.cwd();
        const capyDir = path.join(workspaceRoot, '.capy');
        const configFile = path.join(capyDir, 'config.json');
        const rulesFile = path.join(capyDir, 'prevention-rules.md');
        
        console.log('🔍 Checking created files...');
        
        const capyExists = fs.existsSync(capyDir);
        const configExists = fs.existsSync(configFile);
        const rulesExists = fs.existsSync(rulesFile);
        
        console.log(`📁 .capy directory: ${capyExists}`);
        console.log(`📄 config.json: ${configExists}`);
        console.log(`📄 prevention-rules.md: ${rulesExists}`);
        
        if (configExists) {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            console.log('📋 Config content:', JSON.stringify(config, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testInit();
