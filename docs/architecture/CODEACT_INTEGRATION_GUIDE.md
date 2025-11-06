# CodeAct Agent - Integration Guide

## Overview

This guide shows how to integrate the CodeAct Agent into the Cappy extension to replace the current orchestrated agent system.

## Complete Tool Suite

The CodeAct Agent now includes **7 powerful tools** inspired by OpenHands:

### 1. **think** - Internal Reasoning
- Purpose: Express reasoning and plan next steps
- Use: Agent uses this automatically for decision-making
- Example: "Let me think about how to approach this refactoring..."

### 2. **retrieve_context** - Semantic Search
- Purpose: Find relevant code, docs, and patterns across the workspace
- Input: `{ query: string, category?: string, maxResults?: number }`
- Output: Relevant code snippets with file paths and scores
- Example: "Find authentication implementation in this codebase"

### 3. **file_read** - Read Files
- Purpose: Read file contents with optional line ranges
- Input: `{ path: string, startLine?: number, endLine?: number }`
- Output: File content as string with line count
- Example: Read lines 10-50 of `src/extension.ts`

### 4. **file_write** - Create/Overwrite Files
- Purpose: Create new files or overwrite existing ones
- Input: `{ path: string, content: string }`
- Output: Confirmation with line count
- Auto-features: Creates directories, opens in editor, workspace-relative paths

### 5. **edit_file** - Search & Replace
- Purpose: Edit files using exact string matching
- Input: `{ path: string, old_str: string, new_str: string }`
- Output: Confirmation with context
- Safety: Validates single match, shows context, positions cursor

### 6. **bash** - Execute Commands
- Purpose: Run terminal commands (PowerShell/bash)
- Input: `{ command: string, background?: boolean }`
- Output: Command output or background process ID
- Features: Persistent shell session, working directory tracking

### 7. **finish** - Complete Task
- Purpose: Signal task completion with final response
- Input: `{ response: string }`
- Output: Task completion confirmation
- Use: Agent uses this when task is done

## Integration Steps

### Step 1: Update Extension Registration

Edit `src/extension.ts`:

```typescript
import { CappyAgentAdapter } from './nivel2/infrastructure/agents/codeact/cappy-agent-adapter'
import { RetrieveContextUseCase } from './nivel2/application/usecases/retrieve-context-usecase'

export async function activate(context: vscode.ExtensionContext) {
  // ... existing setup ...
  
  // Initialize retrieve context use case
  const retrieveUseCase = new RetrieveContextUseCase(
    contextRetrieverRepository,
    // ... other dependencies ...
  )
  
  // Register CodeAct Agent
  const cappyAgent = vscode.chat.createChatParticipant(
    'cappy.assistant',
    async (
      request: vscode.ChatRequest,
      context: vscode.ChatContext,
      stream: vscode.ChatResponseStream,
      token: vscode.CancellationToken
    ) => {
      const adapter = new CappyAgentAdapter(retrieveUseCase)
      
      for await (const chunk of adapter.processMessage(request.prompt, stream)) {
        if (token.isCancellationRequested) {
          break
        }
        
        // Chunk is already streamed by the adapter
        // No need to stream again here
      }
      
      return { metadata: { command: 'chat' } }
    }
  )
  
  cappyAgent.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    'assets',
    'cappy-icon.png'
  )
  
  context.subscriptions.push(cappyAgent)
}
```

### Step 2: Remove Old Agent System (Optional)

The old orchestrated agent system can be deprecated:

```typescript
// Remove or comment out:
// - OrchestratedChatEngine
// - GreetingAgent
// - ClarificationAgent
// - PlanningAgent
// - AnalysisAgent
// - ContextOrganizerAgent

// These are all replaced by the single CappyAgent
```

### Step 3: Test the Integration

1. **Build the extension**:
   ```bash
   npm run compile
   ```

2. **Launch in Extension Development Host**:
   - Press F5 in VS Code
   - Open the Command Palette (Ctrl+Shift+P)
   - Type "Chat: Focus on Chat View"

3. **Test basic conversation**:
   ```
   @cappy Hello! Can you help me understand this project?
   ```

4. **Test context retrieval**:
   ```
   @cappy Find all error handling code in the project
   ```

5. **Test file operations**:
   ```
   @cappy Read the main extension.ts file and summarize its structure
   ```

6. **Test code execution**:
   ```
   @cappy Run 'npm test' and show me the results
   ```

7. **Test file editing**:
   ```
   @cappy Add a TODO comment at the top of src/extension.ts
   ```

## System Prompt Features

The agent uses a comprehensive system prompt inspired by OpenHands that includes:

### Role Definition
- Primary role as coding assistant
- Thorough, methodical approach
- Quality over speed

### Efficiency Guidelines
- Combine multiple operations
- Use efficient tools (grep, find, sed)
- Minimize unnecessary operations

### File System Best Practices
- Explore before assuming paths
- Edit files directly (no duplicates)
- Workspace-relative paths
- Clean up temporary files

### Code Quality Standards
- Clean, minimal comments
- Minimal changes to solve problems
- Understand before implementing
- Proper import organization
- Git ignore management

### Version Control Guidelines
- Safe git operations
- Proper commit practices
- Respect gitignore

### Problem Solving Workflow
1. Exploration (retrieve_context, file_read, bash)
2. Analysis (multiple approaches)
3. Testing (TDD when appropriate)
4. Implementation (focused changes)
5. Verification (thorough testing)

### Environment Setup
- Auto-install missing dependencies
- Use package managers properly
- Respect existing dependency files

### Troubleshooting
- Systematic cause analysis
- Likelihood assessment
- Documented reasoning
- User confirmation for major changes

## Architecture Benefits

### Single Unified Agent
- No routing logic needed
- Single context/state
- Simpler mental model
- Easier to maintain

### Tool-Based Approach
- Clear capabilities
- Easy to extend
- Better debugging
- LLM-friendly

### State Management
- Complete history tracking
- Metrics and monitoring
- Status tracking
- Easy to serialize

### VS Code Integration
- Native LM API usage
- Direct file system access
- Terminal integration
- Streaming responses

## Advanced Usage

### Custom Tool Configuration

Disable thinking in production:

```typescript
const adapter = new CappyAgentAdapter(retrieveUseCase, {
  enableThinking: false, // Don't expose internal reasoning
  maxIterations: 15,     // Allow more complex tasks
})
```

### Monitoring and Debugging

Access agent state:

```typescript
const adapter = new CappyAgentAdapter(retrieveUseCase)
const messages = adapter.processMessage(userMessage, stream)

for await (const chunk of messages) {
  console.log('Agent state:', adapter['agent']['state'].toSummary())
  console.log('Current metrics:', adapter['agent']['state'].metrics)
}
```

### Error Handling

The agent includes comprehensive error handling:

```typescript
try {
  for await (const chunk of adapter.processMessage(message, stream)) {
    // Process chunk
  }
} catch (error) {
  if (error instanceof Error) {
    stream.markdown(`⚠️ Error: ${error.message}`)
  }
}
```

## Performance Considerations

### Context Window Management
- Agent limits history to 20 recent events
- Large file operations are chunked
- Tool results are truncated if too large

### Terminal Session Persistence
- BashTool maintains a single terminal session
- Working directory is tracked
- Background processes are supported

### File System Operations
- Uses VS Code workspace.fs API (cross-platform)
- Supports workspace-relative paths
- Auto-creates directories

### LLM Token Usage
- Efficient system prompt
- Truncated tool results
- Streaming responses

## Troubleshooting

### Agent doesn't respond
**Check**: GitHub Copilot is installed and active
**Fix**: Restart VS Code, check Copilot status

### File operations fail
**Check**: Workspace folder is open
**Fix**: Open a folder in VS Code

### Context retrieval returns nothing
**Check**: `.cappy/indexes/` exists and is populated
**Fix**: Run `cappy.reindex` command

### Bash commands timeout
**Check**: Command is not waiting for input
**Fix**: Use non-interactive commands or `background: true`

### Edit operations fail
**Check**: `old_str` matches exactly (including whitespace)
**Fix**: Use file_read to see exact content first

## Migration Checklist

- [ ] Build extension (`npm run compile`)
- [ ] Update `src/extension.ts` with CappyAgentAdapter
- [ ] Remove old agent registrations
- [ ] Test basic chat
- [ ] Test context retrieval
- [ ] Test file operations
- [ ] Test bash execution
- [ ] Test file editing
- [ ] Update user documentation
- [ ] Deploy to users

## Next Steps

1. **Test thoroughly** with real development tasks
2. **Gather feedback** from users
3. **Monitor metrics** (iterations, tool usage, errors)
4. **Add more tools** if needed (git operations, etc.)
5. **Optimize prompts** based on usage patterns
6. **Consider CopilotKit** for UI improvements

## Resources

- [CodeAct Architecture Overview](./CODEACT_AGENT_REFACTORING.md)
- [Implementation Details](./CODEACT_IMPLEMENTATION_COMPLETE.md)
- [Documentation Index](./CODEACT_INDEX.md)
- [Test Guide](../../TESTING_GUIDE.md)
- [OpenHands Reference](.cappy/data/openhands/)
