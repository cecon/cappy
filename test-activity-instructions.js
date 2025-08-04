const fs = require('fs').promises;
const path = require('path');

async function testReadActivityInstructions() {
    try {
        const workspacePath = process.cwd();
        const activityPath = path.join(workspacePath, '.capy', 'actions', 'start_activity.md');
        
        // Check if file exists
        await fs.access(activityPath);
        console.log(' Activity instructions file exists');
        
        // Read the file
        const activityInstructions = await fs.readFile(activityPath, 'utf8');
        console.log(' Activity instructions read successfully');
        console.log(' Content preview:', activityInstructions.substring(0, 100) + '...');
        
        // Simulate the formatting that would be done in the method
        const formattedInstructions = '\n\n##  ACTIVITY INSTRUCTIONS\n' + activityInstructions + '\n\n';
        
        console.log(' Instructions formatted successfully');
        console.log(' Final length:', formattedInstructions.length, 'characters');
        
        return true;
    } catch (error) {
        console.error(' Error:', error.message);
        return false;
    }
}

testReadActivityInstructions();
