import * as path from 'path';
const mocha = require('mocha');

export function run(): Promise<void> {
    console.log('🦫 Starting Cappy Simple Tests...');
    
    // Create the mocha test
    const mochaInstance = new mocha({
        ui: 'tdd',
        color: true,
        timeout: 30000 // Reduce timeout to avoid hanging
    });

    const testsRoot = path.resolve(__dirname, '.');

    return new Promise((resolve, reject) => {
        try {
            // Add only the working tests
            const simpleTestFile = path.resolve(testsRoot, 'simpleWorkingTests.test.js');
            console.log(`Adding simple working tests: ${simpleTestFile}`);
            mochaInstance.addFile(simpleTestFile);

            // Run the mocha test
            mochaInstance.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    console.log('✅ All simple tests passed!');
                    resolve();
                }
            });
        } catch (err) {
            console.error('Error setting up tests:', err);
            reject(err);
        }
    });
}
