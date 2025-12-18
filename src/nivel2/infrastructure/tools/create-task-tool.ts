import * as vscode from 'vscode';

interface CreateTaskInput {
  title: string;
  category: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'chore';
  description?: string;
}

/**
 * Language Model Tool for creating task files in .cappy/tasks/
 */
export class CreateTaskTool implements vscode.LanguageModelTool<CreateTaskInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CreateTaskInput>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { title, category, description } = options.input;

    try {
      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('❌ No workspace folder open')
        ]);
      }

      // Generate task ID and slug
      const timestamp = Date.now();
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const taskId = `task_${new Date().toISOString().split('T')[0]}_${timestamp}_${slug}`;
      const fileName = `${taskId}.ACTIVE.xml`;

      // Create tasks directory if it doesn't exist
      const tasksDir = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'tasks');
      try {
        await vscode.workspace.fs.createDirectory(tasksDir);
      } catch {
        // Directory might already exist
      }

      // Generate XML content
      const now = new Date().toISOString();
      const xmlContent = this.generateTaskXML({
        id: taskId,
        title,
        category,
        description: description || '',
        createdAt: now,
        updatedAt: now
      });

      // Create task file
      const taskUri = vscode.Uri.joinPath(tasksDir, fileName);
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(taskUri, encoder.encode(xmlContent));

      // Open the created file
      const document = await vscode.workspace.openTextDocument(taskUri);
      await vscode.window.showTextDocument(document);

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `✅ Task file created: .cappy/tasks/${fileName}\n\n` +
          `📋 Next steps (follow the checklist inside the file):\n` +
          `1. [ ] Fill in task description\n` +
          `2. [ ] Define acceptance criteria\n` +
          `3. [ ] Add implementation steps\n` +
          `4. [ ] Specify context requirements\n` +
          `5. [ ] Define validation criteria`
        )
      ]);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Error creating task file: ${errorMessage}`)
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CreateTaskInput>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { title, category } = options.input;
    return {
      invocationMessage: `Creating ${category} task: ${title}`,
      confirmationMessages: {
        title: 'Create Task File',
        message: new vscode.MarkdownString(
          `Create a new **${category}** task:\n\n**${title}**`
        )
      }
    };
  }

  /**
   * Generates the XML content for a task file
   */
  private generateTaskXML(task: {
    id: string;
    title: string;
    category: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!--
╔══════════════════════════════════════════════════════════════════════════════╗
║                        CAPPY TASK CREATION CHECKLIST                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

📋 TASK CREATION PROGRESS:
  [⏳] Phase 1: Basic Information (CURRENT)
    [ ] 1.1 - Fill in task description
    [ ] 1.2 - Define acceptance criteria
    [ ] 1.3 - Review category (${task.category})
  
  [ ] Phase 2: Implementation Planning
    [ ] 2.1 - Define implementation steps (max 5 main steps)
    [ ] 2.2 - Add sub-steps where needed
    [ ] 2.3 - Define validation criteria for each step
  
  [ ] Phase 3: Context Setup
    [ ] 3.1 - Specify required documentation files
    [ ] 3.2 - Add prevention rules (if applicable)
    [ ] 3.3 - Link related files and components
  
  [ ] Phase 4: Execution
    [ ] 4.1 - Mark task as ready (remove .ACTIVE, add .DONE when complete)
    [ ] 4.2 - Execute implementation steps
    [ ] 4.3 - Validate against acceptance criteria

💡 TIPS:
- Keep steps atomic and testable
- Reference specific files and line numbers
- Use prevention rules to avoid common mistakes
- Update this checklist as you progress (mark with [x])

╚══════════════════════════════════════════════════════════════════════════════╝
-->
<task xmlns="http://cappy.dev/schemas/task/2.0">
  
  <metadata>
    <id>${task.id}</id>
    <category>${task.category}</category>
    <title>${task.title}</title>
    <description>
${task.description || '      <!-- TODO: Describe what needs to be accomplished -->'}
    </description>
    <createdAt>${task.createdAt}</createdAt>
    <updatedAt>${task.updatedAt}</updatedAt>
    <status>draft</status>
  </metadata>

  <requirements>
    <acceptanceCriteria>
      <!-- TODO: Define clear acceptance criteria -->
      <!-- Example:
      <criterion id="AC-1">User can successfully authenticate with JWT token</criterion>
      <criterion id="AC-2">Token expires after 24 hours</criterion>
      -->
    </acceptanceCriteria>
  </requirements>

  <implementation>
    <steps>
      <!-- TODO: Define implementation steps (max 5 main steps) -->
      <!-- Example:
      <step id="STEP-1">
        <title>Create authentication service</title>
        <description>Implement JWT token generation and validation</description>
        <files>
          <file>src/services/auth-service.ts</file>
        </files>
        <validation>Service passes unit tests</validation>
      </step>
      -->
    </steps>
  </implementation>

  <context>
    <documentation>
      <!-- TODO: Specify required documentation files -->
      <!-- Example:
      <doc path="docs/architecture/AUTH.md" relevance="high">Authentication architecture</doc>
      -->
    </documentation>
    
    <preventionRules>
      <!-- TODO: Add prevention rules from docs/prevention/ if applicable -->
      <!-- Example:
      <rule category="security">Always hash passwords before storing</rule>
      -->
    </preventionRules>
    
    <relatedFiles>
      <!-- TODO: Link related files and components -->
      <!-- Example:
      <file path="src/middleware/auth.ts" relevance="high">Auth middleware</file>
      -->
    </relatedFiles>
  </context>

  <validation>
    <criteria>
      <!-- TODO: Define how to validate completion -->
      <!-- Example:
      <criterion>All unit tests pass</criterion>
      <criterion>Integration tests with real tokens work</criterion>
      <criterion>Security scan shows no vulnerabilities</criterion>
      -->
    </criteria>
  </validation>

</task>
`;
  }
}
