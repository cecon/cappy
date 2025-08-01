import * as path from 'path';
const mocha = require('mocha');

export function run(): Promise<void> {
    console.log('🦫 Starting Capybara tests...');
    
    // Create the mocha test
    const mochaInstance = new mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000
    });

    const testsRoot = path.resolve(__dirname, '.');

    return new Promise((resolve, reject) => {
        try {
            // Add the test file directly
            const testFile = path.resolve(testsRoot, 'capybara.test.js');
            console.log(`Adding test file: ${testFile}`);
            mochaInstance.addFile(testFile);

            // Run the mocha test
            mochaInstance.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    console.log('✅ All Capybara tests passed!');
                    resolve();
                }
            });
        } catch (err) {
            console.error('Error setting up tests:', err);
            reject(err);
        }
    });
}
