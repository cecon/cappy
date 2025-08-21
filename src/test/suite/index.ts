import * as path from 'path';
const mocha = require('mocha');

export function run(): Promise<void> {
    console.log('🦫 Starting Cappy tests...');
    
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
            const mainTestFile = path.resolve(testsRoot, 'cappy.test.js');
            console.log(`Adding main test file: ${mainTestFile}`);
            mochaInstance.addFile(mainTestFile);
            
            // Add the InitCappy test file
            const initTestFile = path.resolve(testsRoot, 'initCappy.test.js');
            console.log(`Adding InitCappy test file: ${initTestFile}`);
            mochaInstance.addFile(initTestFile);
            
            // Optionally add other test files ONLY if their TypeScript sources exist.
            // This prevents running stale compiled tests from older builds.
            const fs = require('fs');
            const optionalTests: Array<{ compiled: string; source: string }> = [
                { compiled: 'createTask.test.js', source: 'createTask.test.ts' },
                { compiled: 'createTaskFolderStructure.test.js', source: 'createTaskFolderStructure.test.ts' },
                { compiled: 'languageDetectionFix.test.js', source: 'languageDetectionFix.test.ts' },
                { compiled: 'getNewTaskInstruction.test.js', source: 'getNewTaskInstruction.test.ts' },
                { compiled: 'knowStack.test.js', source: 'knowStack.test.ts' },
                { compiled: 'workOnCurrentTask.test.js', source: 'workOnCurrentTask.test.ts' }
            ];

            const srcSuiteRoot = path.resolve(__dirname, '../../../src/test/suite');
            for (const entry of optionalTests) {
                const sourcePath = path.resolve(srcSuiteRoot, entry.source);
                if (fs.existsSync(sourcePath)) {
                    const compiledPath = path.resolve(testsRoot, entry.compiled);
                    try {
                        fs.accessSync(compiledPath);
                        console.log(`Adding optional test file: ${compiledPath} (source found at ${sourcePath})`);
                        mochaInstance.addFile(compiledPath);
                    } catch {
                        console.log(`Optional compiled test not found, skipping: ${compiledPath}`);
                    }
                } else {
                    console.log(`Skipping optional test (source missing): ${sourcePath}`);
                }
            }

            // Run the mocha test
            mochaInstance.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    console.log('✅ All Cappy tests passed!');
                    resolve();
                }
            });
        } catch (err) {
            console.error('Error setting up tests:', err);
            reject(err);
        }
    });
}
