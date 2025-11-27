import * as vscode from 'vscode';

interface CreateTaskFileInput {
  /** Category of the task (must match enum in XSD) */
  category: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'chore';
  /** Brief title/description of the task */
  title: string;
  /** Optional slug for filename (auto-generated if not provided) */
  slug?: string;
}

/**
 * Language Model Tool for creating task XML files
 * Creates structured task files in .cappy/tasks/ with proper naming and template
 */
export class CreateTaskFileTool implements vscode.LanguageModelTool<CreateTaskFileInput> {
  public inputSchema = {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['feature', 'bugfix', 'refactor', 'docs', 'test', 'chore'],
        description: 'Category of the task'
      },
      title: {
        type: 'string',
        description: 'Brief title/description of the task'
      },
      slug: {
        type: 'string',
        description: 'Optional slug for filename (auto-generated from title if not provided)'
      }
    },
    required: ['category', 'title']
  } as const;

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CreateTaskFileInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    // Validate input
    if (!options.input) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('❌ Error: Missing tool parameters. Please provide "category" and "title".')
      ]);
    }

    const { category, title, slug } = options.input;

    // Validate required parameters
    if (!category || !title) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('❌ Error: Missing required parameters. Example: {"category": "feature", "title": "Add user authentication"}')
      ]);
    }

    try {
      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('❌ No workspace folder open')
        ]);
      }

      // Generate filename components
      const now = new Date();
      const date = now.toISOString().split('T')[0]; // yyyy-mm-dd
      const timestamp = now.getTime();
      const fileSlug = slug || this.generateSlug(title);
      const filename = `task_${date}_${timestamp}_${fileSlug}.xml`;

      // Ensure .cappy/tasks directory exists
      const tasksDir = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'tasks');
      try {
        await vscode.workspace.fs.createDirectory(tasksDir);
      } catch {
        // Directory might already exist
      }

      // Create full file path
      const fileUri = vscode.Uri.joinPath(tasksDir, filename);

      // Check if file already exists
      try {
        await vscode.workspace.fs.stat(fileUri);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`❌ File already exists: .cappy/tasks/${filename}`)
        ]);
      } catch {
        // File doesn't exist, proceed with creation
      }

      // Generate task XML template
      const xmlContent = this.generateTaskTemplate(category, title, filename);

      // Write file
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(fileUri, encoder.encode(xmlContent));

      // Open the created file
      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document);

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `✅ Task file created: .cappy/tasks/${filename}\n\n` +
          `📋 Next steps (follow the checklist inside the file):\n` +
          `1. [ ] Fill in task description\n` +
          `2. [ ] Define acceptance criteria\n` +
          `3. [ ] Add implementation steps\n` +
          `4. [ ] Specify context requirements\n` +
          `5. [ ] Define validation criteria`
        )
      ]);

    } catch (error) {
      console.error('[CreateTaskFileTool] Error creating task file:', error);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Error creating task file: ${error instanceof Error ? error.message : String(error)}`)
      ]);
    }
  }

  /**
   * Generates a URL-friendly slug from a title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length
  }

  /**
   * Generates the task XML template with embedded checklist
   */
  private generateTaskTemplate(category: string, title: string, filename: string): string {
    const now = new Date().toISOString();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<!--
╔══════════════════════════════════════════════════════════════════════════════╗
║                        CAPPY TASK CREATION CHECKLIST                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

📋 TASK CREATION PROGRESS:
  [⏳] Phase 1: Basic Information (CURRENT)
    [ ] 1.1 - Fill in task description
    [ ] 1.2 - Define acceptance criteria
    [ ] 1.3 - Review category (${category})
  
  [ ] Phase 2: Implementation Planning
    [ ] 2.1 - Define implementation steps (max 5 main steps)
    [ ] 2.2 - Add sub-steps where needed
    [ ] 2.3 - Define validation criteria for each step
  
  [ ] Phase 3: Context Requirements
    [ ] 3.1 - Specify required documentation
    [ ] 3.2 - List prevention rules to apply
    [ ] 3.3 - Define related tasks/dependencies
  
  [ ] Phase 4: Validation & Refinement
    [ ] 4.1 - Review all sections for completeness
    [ ] 4.2 - Ensure timestamps are valid
    [ ] 4.3 - Verify XSD compliance
  
  [ ] Phase 5: Activation
    [ ] 5.1 - Mark file as .ACTIVE.xml
    [ ] 5.2 - Begin work on first step

💡 TIPS:
  - Use conversational agent to guide filling this template
  - System will automatically load this file when chat starts
  - Each phase can be called as a refinement tool
  - Progress is tracked via checkboxes above

📝 FILE: ${filename}
📅 CREATED: ${now}
-->

<task xmlns="http://cappy.dev/schemas/task/2.0" 
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://cappy.dev/schemas/task/2.0 ../../schemas/task.xsd">
  
  <metadata>
    <id>${this.generateTaskId()}</id>
    <category>${category}</category>
    <title>${this.escapeXml(title)}</title>
    <description>
      <!-- TODO: Describe what needs to be accomplished -->
      <!-- Example: Implement user authentication using JWT tokens -->
    </description>
    <createdAt>${now}</createdAt>
    <updatedAt>${now}</updatedAt>
    <status>draft</status>
  </metadata>

  <requirements>
    <acceptanceCriteria>
      <!-- TODO: Define clear acceptance criteria -->
      <!-- Example:
      <criterion id="ac-1">User can login with email and password</criterion>
      <criterion id="ac-2">JWT token is generated upon successful login</criterion>
      -->
    </acceptanceCriteria>
  </requirements>

  <implementation>
    <steps>
      <!-- TODO: Define implementation steps (max 5 main steps) -->
      <!-- Example:
      <step id="step-1" order="1" status="pending">
        <title>Setup authentication service</title>
        <description>Create AuthService with login/logout methods</description>
        <validation>
          <criterion>AuthService class created with proper TypeScript types</criterion>
          <criterion>Unit tests for AuthService pass</criterion>
        </validation>
      </step>
      -->
    </steps>
  </implementation>

  <context>
    <!-- Context is automatically orchestrated by CAPPY -->
    <documentation>
      <!-- TODO: Specify required documentation files -->
      <!-- Example:
      <doc path="docs/architecture/authentication.md" priority="high"/>
      -->
    </documentation>
    
    <preventionRules>
      <!-- TODO: List prevention rules to apply -->
      <!-- Example:
      <rule category="security" priority="high">Validate all user inputs</rule>
      -->
    </preventionRules>
    
    <relatedTasks>
      <!-- TODO: Link related tasks if any -->
      <!-- Example:
      <task id="task-123" relationship="depends-on"/>
      -->
    </relatedTasks>
  </context>

  <progress>
    <currentStep>step-1</currentStep>
    <completedSteps>
      <!-- Completed steps will be tracked here -->
    </completedSteps>
    <learnings>
      <!-- Learnings captured during execution will be added here -->
    </learnings>
  </progress>

</task>`;
  }

  /**
   * Generates a unique task ID
   */
  private generateTaskId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `task-${timestamp}-${random}`;
  }

  /**
   * Escapes XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
