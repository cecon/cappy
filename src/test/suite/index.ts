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
            // Add the main test file
            const mainTestFile = path.resolve(testsRoot, 'capybara.test.js');
            console.log(`Adding main test file: ${mainTestFile}`);
            mochaInstance.addFile(mainTestFile);
            
            // Add the InitCapybara test file
            const initTestFile = path.resolve(testsRoot, 'initCapybara.test.js');
            console.log(`Adding InitCapybara test file: ${initTestFile}`);
            mochaInstance.addFile(initTestFile);
            
            // Add the CreateTask test file
            const createTaskTestFile = path.resolve(testsRoot, 'createTask.test.js');
            console.log(`Adding CreateTask test file: ${createTaskTestFile}`);
            mochaInstance.addFile(createTaskTestFile);

            // Add the CreateTaskFolderStructure test file
            const createTaskFolderTestFile = path.resolve(testsRoot, 'createTaskFolderStructure.test.js');
            console.log(`Adding CreateTaskFolderStructure test file: ${createTaskFolderTestFile}`);
            mochaInstance.addFile(createTaskFolderTestFile);

            // Add the LanguageDetectionFix test file
            const languageDetectionTestFile = path.resolve(testsRoot, 'languageDetectionFix.test.js');
            console.log(`Adding LanguageDetectionFix test file: ${languageDetectionTestFile}`);
            mochaInstance.addFile(languageDetectionTestFile);

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
