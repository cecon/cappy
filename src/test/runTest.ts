import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Create a temporary workspace for testing to avoid affecting the production workspace
        const tempDir = os.tmpdir();
        const testWorkspace = path.join(tempDir, `cappy-test-workspace-${Date.now()}`);
        
        // Create the temporary workspace directory
        await fs.promises.mkdir(testWorkspace, { recursive: true });
        
        // Create a simple package.json for the test workspace
        const testPackageJson = {
            name: 'cappy-test-workspace',
            version: '1.0.0',
            description: 'Temporary workspace for Cappy tests'
        };
        
        await fs.promises.writeFile(
            path.join(testWorkspace, 'package.json'),
            JSON.stringify(testPackageJson, null, 2)
        );

        console.log(`🧪 Using temporary test workspace: ${testWorkspace}`);

        // Download VS Code, unzip it and run the integration test
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath,
            launchArgs: [testWorkspace]
        });

        // Clean up the temporary workspace after tests
        try {
            await fs.promises.rm(testWorkspace, { recursive: true, force: true });
            console.log(`🧹 Cleaned up temporary test workspace: ${testWorkspace}`);
        } catch (error) {
            console.warn(`⚠️ Failed to clean up test workspace: ${error}`);
        }

    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
