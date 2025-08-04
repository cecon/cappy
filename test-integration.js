const fs = require('fs').promises;
const path = require('path');

async function testCopilotInstructionsGeneration() {
    try {
        const workspacePath = process.cwd();
        
        // Simulate reading activity instructions
        const activityPath = path.join(workspacePath, '.capy', 'actions', 'start_activity.md');
        let activityInstructions = '';
        
        try {
            await fs.access(activityPath);
            const rawInstructions = await fs.readFile(activityPath, 'utf8');
            activityInstructions = '\n\n##  ACTIVITY INSTRUCTIONS\n' + rawInstructions + '\n\n';
            console.log(' Activity instructions loaded successfully');
        } catch (error) {
            console.log(' No activity instructions found, continuing without them');
        }
        
        // Simulate generating Copilot instructions
        const version = '1.0.0';
        const projectName = 'Test Project';
        
        const copilotInstructions = '=====================START CAPYBARA MEMORY v' + version + '=====================\n' +
            '#  Capybara - GitHub Copilot Instructions\n\n' +
            '##  **PROJECT CONTEXT**\n' +
            '- **Project**: ' + projectName + '\n' +
            '- **Type**: test-project\n\n' +
            '##  **CAPYBARA METHODOLOGY**\n' +
            'This project uses Capybara methodology for solo development.\n\n' +
            '### **Available Capybara Commands:**\n' +
            '- \Capybara: Initialize\ - Initialize Capybara in workspace\n\n' +
            '---\n' +
            '*This file contains personalized instructions for GitHub Copilot.*\n' +
            activityInstructions +
            '======================END CAPYBARA MEMORY v' + version + '======================\n';

        console.log(' Copilot instructions generated successfully');
        console.log(' Total length:', copilotInstructions.length, 'characters');
        console.log(' Contains activity instructions:', copilotInstructions.includes('ACTIVITY INSTRUCTIONS'));
        
        // Show a preview of where activity instructions would appear
        const activityIndex = copilotInstructions.indexOf('##  ACTIVITY INSTRUCTIONS');
        if (activityIndex > -1) {
            console.log(' Activity instructions properly integrated at position:', activityIndex);
            const preview = copilotInstructions.substring(activityIndex, activityIndex + 200);
            console.log(' Preview of integration:', preview + '...');
        }
        
        return true;
    } catch (error) {
        console.error(' Error:', error.message);
        return false;
    }
}

testCopilotInstructionsGeneration();
