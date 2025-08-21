import * as assert from 'assert';
import * as vscode from 'vscode';
import workOnCurrentTask from '../../commands/workOnCurrentTask';

suite('workOnCurrentTask Command Tests', () => {
    let testWorkspaceUri: vscode.Uri;
    let cappyUri: vscode.Uri;
    let tasksUri: vscode.Uri;

    suiteSetup(async () => {
        // Create a temporary test workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        assert.ok(workspaceFolders && workspaceFolders.length > 0, 'No workspace folders found');
        
        testWorkspaceUri = workspaceFolders[0].uri;
        cappyUri = vscode.Uri.joinPath(testWorkspaceUri, '.cappy');
        tasksUri = vscode.Uri.joinPath(cappyUri, 'tasks');
    });

    setup(async () => {
        // Ensure clean state before each test
        try {
            await vscode.workspace.fs.delete(cappyUri, { recursive: true });
        } catch (error) {
            // Directory might not exist, ignore
        }

        // Create .cappy directory structure
        await vscode.workspace.fs.createDirectory(cappyUri);
        await vscode.workspace.fs.createDirectory(tasksUri);
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(cappyUri, 'history'));

        // Create config file
        const configUri = vscode.Uri.joinPath(cappyUri, 'config.yaml');
        const configContent = `prevention-rules:
  max-count: 50
  categories:
    type-errors: 15
    performance: 10
    security: 20
    general: 5`;
        await vscode.workspace.fs.writeFile(configUri, Buffer.from(configContent, 'utf8'));

        // Create prevention rules file
        const preventionRulesUri = vscode.Uri.joinPath(cappyUri, 'prevention-rules.xml');
        const preventionRulesContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="3">
  <rule id="1" category="type-errors" severity="high">
    <title>Avoid untyped variables</title>
    <description>Always provide explicit types for variables</description>
    <createdAt>2025-01-01T00:00:00.000Z</createdAt>
  </rule>
  <rule id="2" category="performance" severity="medium">
    <title>Use efficient loops</title>
    <description>Prefer for-of loops over forEach for better performance</description>
    <createdAt>2025-01-02T00:00:00.000Z</createdAt>
  </rule>
  <rule id="3" category="security" severity="high">
    <title>Sanitize user inputs</title>
    <description>Always validate and sanitize user inputs to prevent security vulnerabilities</description>
    <createdAt>2025-01-03T00:00:00.000Z</createdAt>
  </rule>
</prevention-rules>`;
        await vscode.workspace.fs.writeFile(preventionRulesUri, Buffer.from(preventionRulesContent, 'utf8'));
    });

    teardown(async () => {
        // Clean up after each test
        try {
            await vscode.workspace.fs.delete(cappyUri, { recursive: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    test('Should return inactive status when no active task exists', async () => {
        const result = await workOnCurrentTask();
        
        assert.ok(result.includes('<active>false</active>'), 'Should indicate no active task');
        assert.ok(result.includes('<next-step>No active task found</next-step>'), 'Should indicate no active task found');
    });

    test('Should work on active task when one exists', async () => {
        // Create a sample active task file
        const taskFileName = 'STEP_20250815_120000_test-task.ACTIVE.xml';
        const taskFileUri = vscode.Uri.joinPath(tasksUri, taskFileName);
        const taskContent = `<?xml version="1.0" encoding="UTF-8"?>
<task id="STEP_20250815_120000_test-task" status="em-andamento">
  <title>Test Task</title>
  <goals>
    <goal>Complete test implementation</goal>
  </goals>
  <steps>
    <step id="step1">
      <description>Write unit tests</description>
      <doneWhen>All tests pass</doneWhen>
    </step>
    <step id="step2">
      <description>Fix implementation</description>
      <doneWhen>Code works as expected</doneWhen>
      <completed-at>2025-01-01T12:00:00Z</completed-at>
    </step>
  </steps>
</task>`;

        await vscode.workspace.fs.writeFile(taskFileUri, Buffer.from(taskContent, 'utf8'));

        const result = await workOnCurrentTask();

        assert.ok(result.includes('<active>true</active>'), 'Should indicate active task exists');
        assert.ok(result.includes('<file-path>'), 'Should include file path');
        assert.ok(result.includes('<next-step>Write unit tests</next-step>'), 'Should identify next uncompleted step');
        assert.ok(result.includes('<task-content>'), 'Should include task content');
    });

    test('Should identify next step correctly', async () => {
        // Create a task with multiple steps, some completed
        const taskFileName = 'STEP_20250815_120000_multi-step.ACTIVE.xml';
        const taskFileUri = vscode.Uri.joinPath(tasksUri, taskFileName);
        const taskContent = `<?xml version="1.0" encoding="UTF-8"?>
<task id="STEP_20250815_120000_multi-step" status="em-andamento">
  <title>Multi-step Task</title>
  <steps>
    <step id="step1">
      <description>First step</description>
      <completed-at>2025-01-01T10:00:00Z</completed-at>
    </step>
    <step id="step2">
      <description>Second step - not completed</description>
      <doneWhen>Second step criteria met</doneWhen>
    </step>
    <step id="step3">
      <description>Third step</description>
      <doneWhen>Third step criteria met</doneWhen>
    </step>
  </steps>
</task>`;

        await vscode.workspace.fs.writeFile(taskFileUri, Buffer.from(taskContent, 'utf8'));

        const result = await workOnCurrentTask();

        assert.ok(result.includes('<next-step>Second step - not completed</next-step>'), 
                 'Should identify first uncompleted step as next step');
    });

    test('Should handle task with all steps completed', async () => {
        const taskFileName = 'STEP_20250815_120000_completed.ACTIVE.xml';
        const taskFileUri = vscode.Uri.joinPath(tasksUri, taskFileName);
        const taskContent = `<?xml version="1.0" encoding="UTF-8"?>
<task id="STEP_20250815_120000_completed" status="em-andamento">
  <title>Completed Task</title>
  <steps>
    <step id="step1">
      <description>First step</description>
      <completed-at>2025-01-01T10:00:00Z</completed-at>
    </step>
    <step id="step2">
      <description>Second step</description>
      <completed-at>2025-01-01T11:00:00Z</completed-at>
    </step>
  </steps>
</task>`;

        await vscode.workspace.fs.writeFile(taskFileUri, Buffer.from(taskContent, 'utf8'));

        const result = await workOnCurrentTask();

        assert.ok(result.includes('<next-step>All steps completed</next-step>'), 
                 'Should indicate all steps are completed');
    });

    test('Should handle task without steps', async () => {
        const taskFileName = 'STEP_20250815_120000_no-steps.ACTIVE.xml';
        const taskFileUri = vscode.Uri.joinPath(tasksUri, taskFileName);
        const taskContent = `<?xml version="1.0" encoding="UTF-8"?>
<task id="STEP_20250815_120000_no-steps" status="em-andamento">
  <title>Task without steps</title>
  <goals>
    <goal>Complete something</goal>
  </goals>
</task>`;

        await vscode.workspace.fs.writeFile(taskFileUri, Buffer.from(taskContent, 'utf8'));

        const result = await workOnCurrentTask();

        assert.ok(result.includes('<next-step>No steps found in task</next-step>'), 
                 'Should handle tasks without steps section');
    });

    test('Should escape XML content properly', async () => {
        const taskFileName = 'STEP_20250815_120000_xml-content.ACTIVE.xml';
        const taskFileUri = vscode.Uri.joinPath(tasksUri, taskFileName);
        const taskContent = `<?xml version="1.0" encoding="UTF-8"?>
<task id="STEP_20250815_120000_xml-content" status="em-andamento">
  <title>Task with XML content</title>
  <description>This contains < and > characters & "quotes"</description>
  <steps>
    <step id="step1">
      <description>Handle special characters</description>
    </step>
  </steps>
</task>`;

        await vscode.workspace.fs.writeFile(taskFileUri, Buffer.from(taskContent, 'utf8'));

        const result = await workOnCurrentTask();

        // Check that XML special characters are properly escaped in task-content
        assert.ok(result.includes('&lt;'), 'Should escape < characters');
        assert.ok(result.includes('&gt;'), 'Should escape > characters');
        assert.ok(result.includes('&amp;'), 'Should escape & characters');
        assert.ok(result.includes('&quot;'), 'Should escape quote characters');
    });

    test('Should return absolute file paths in response', async () => {
        // Create a simple active task
        const taskFileName = 'TASK_20250819_absolute_path.ACTIVE.xml';
        const taskFileUri = vscode.Uri.joinPath(tasksUri, taskFileName);
        const taskContent = `<?xml version="1.0" encoding="UTF-8"?>
<task id="TASK_20250819_absolute_path" status="em-andamento">
  <title>Test Absolute Path</title>
  <steps>
    <step id="step1">
      <description>Test step</description>
    </step>
  </steps>
</task>`;

        await vscode.workspace.fs.writeFile(taskFileUri, Buffer.from(taskContent, 'utf8'));

        const result = await workOnCurrentTask();

        // Validate that the file path in the response is absolute (should contain the full drive path)
        const filePathMatch = result.match(/<file-path>(.*?)<\/file-path>/);
        assert.ok(filePathMatch, 'Should contain file-path element');
        
        const filePath = filePathMatch[1];
        assert.ok(filePath.includes('\\') || filePath.includes('/'), 'Should contain path separators');
        assert.ok(filePath.includes(taskFileName), 'Should contain the task file name');
        
        // On Windows, absolute paths should start with drive letter (like D:\) 
        // On Unix systems, they should start with /
        const isAbsolute = /^[A-Za-z]:\\/.test(filePath) || filePath.startsWith('/');
        assert.ok(isAbsolute, `File path should be absolute. Got: ${filePath}`);
    });

    test('Should handle errors gracefully', async () => {
        // Create a valid active task file first
        const taskFileName = 'STEP_20250815_120000_invalid.ACTIVE.xml';
        const taskFileUri = vscode.Uri.joinPath(tasksUri, taskFileName);
        
        const validTaskContent = `<?xml version="1.0" encoding="UTF-8"?>
<Task version="1.0" id="STEP_20250815_120000_invalid" status="em-andamento">
    <title>Test Task</title>
    <goals>Test goals</goals>
    <steps>
        <step id="step1">
            <action>Test action</action>
            <doneWhen>Test completion</doneWhen>
        </step>
    </steps>
</Task>`;
        
        await vscode.workspace.fs.writeFile(taskFileUri, Buffer.from(validTaskContent, 'utf8'));
        
        // Corrupt the file to test malformed XML handling
        const corruptedContent = 'This is not valid XML content that will cause parsing errors';
        await vscode.workspace.fs.writeFile(taskFileUri, Buffer.from(corruptedContent, 'utf8'));

        const result = await workOnCurrentTask();
        // Even with malformed XML, it should return a valid response structure
        assert.ok(result.includes('<work-current-task>'), 'Should return valid XML structure even with malformed task content');
        assert.ok(result.includes('<active>true</active>'), 'Should show task as active');
        assert.ok(result.includes('<next-step>'), 'Should include next-step element');
        assert.ok(result.includes('<task-content>'), 'Should include task-content element');
    });
});
