# Cappy Agent - Enhanced Prompts & Examples

## Phase 3: Improved Tools - Usage Examples

### BashTool Enhancements

**Command Validation & Safety:**
```typescript
// Safe command execution with validation
await bashTool.execute({
  command: "npm run build",
  cwd: "src",
  timeout: 60,
  background: false
})

// Dangerous commands are blocked
await bashTool.execute({
  command: "rm -rf /" // ❌ Blocked for security
})

// Sensitive commands logged but allowed
await bashTool.execute({
  command: "git reset --hard" // ⚠️ Logged as sensitive
})
```

**Command History & Monitoring:**
```typescript
// Get command history
const history = bashTool.getCommandHistory()
// ["npm run build", "git status", "ls -la"]

// Clear history when needed
bashTool.clearHistory()
```

### EditFileTool Enhancements

**Diff-based Editing with Preview:**
```typescript
// Preview changes before applying
const result = await editFileTool.execute({
  path: "src/main.ts",
  oldContent: "console.log('old message')",
  newContent: "console.log('new message')",
  preview: true
})
// Returns diff showing exactly what will change

// Apply changes with backup
await editFileTool.execute({
  path: "src/main.ts",
  oldContent: "console.log('old message')",
  newContent: "console.log('new message')",
  backup: true
})
```

**Syntax Validation:**
```typescript
// Automatic syntax checking for code files
await editFileTool.execute({
  path: "src/app.ts",
  oldContent: "function test() {",
  newContent: "function test() {\n  return true;\n}" // ✅ Valid syntax
})

// Invalid syntax is rejected
await editFileTool.execute({
  path: "src/app.ts",
  oldContent: "function test() {",
  newContent: "function test() {\n  return true;\n" // ❌ Missing closing brace
})
// Returns: "Syntax validation failed: Unmatched braces"
```

### FileReadTool Enhancements

**Intelligent File Reading:**
```typescript
// Read with context and limits
const result = await fileReadTool.execute({
  path: "src/large-file.ts",
  startLine: 100,
  endLine: 150,
  context: 5, // 5 lines of context around range
  maxLines: 100
})

// Automatic file type detection
// Returns: { fileType: "TypeScript", encoding: "utf-8", ... }
```

**Performance Features:**
```typescript
// Large file handling with chunking
await fileReadTool.execute({
  path: "logs/app.log",
  maxLines: 500, // Prevents memory issues
  startLine: 1000 // Jump to specific section
})

// Binary file detection
await fileReadTool.execute({
  path: "assets/image.png" // ❌ "Binary file detected"
})
```

### RunTool - Background Processes

**Process Management:**
```typescript
// Start background process
const result = await runTool.execute({
  command: "npm run dev",
  background: true,
  cwd: "src",
  env: { PORT: "3000" }
})
// Returns: { status: "started", processId: "npm_run_dev_12345" }

// Monitor running processes
const running = runTool.listRunningProcesses()
// ["npm_run_dev_12345", "build_watcher_67890"]

// Stop specific process
runTool.stopProcess("npm_run_dev_12345")

// Stop all processes
const stopped = runTool.stopAllProcesses() // Returns count
```

## Phase 4: Enhanced Agent Capabilities

### Multi-Tool Orchestration

**Code Refactoring Workflow:**
```typescript
// 1. Read the file to understand structure
const fileContent = await fileReadTool.execute({
  path: "src/old-component.ts",
  maxLines: 200
})

// 2. Use edit tool with preview to plan changes
const preview = await editFileTool.execute({
  path: "src/old-component.ts",
  oldContent: "class OldComponent",
  newContent: "class NewComponent",
  preview: true
})

// 3. Apply the refactoring
await editFileTool.execute({
  path: "src/old-component.ts",
  oldContent: "class OldComponent",
  newContent: "class NewComponent",
  backup: true
})

// 4. Run tests to validate
await bashTool.execute({
  command: "npm test -- --testPathPattern=component",
  timeout: 30
})
```

**Build & Deploy Pipeline:**
```typescript
// 1. Start build process in background
await runTool.execute({
  command: "npm run build:watch",
  background: true
})

// 2. Run tests
await bashTool.execute({
  command: "npm test",
  timeout: 120
})

// 3. Deploy if tests pass
await bashTool.execute({
  command: "npm run deploy",
  cwd: "dist"
})

// 4. Clean up background processes
runTool.stopAllProcesses()
```

### Error Recovery & Resilience

**Graceful Error Handling:**
```typescript
try {
  // Attempt operation
  await editFileTool.execute({
    path: "src/app.ts",
    oldContent: "old code",
    newContent: "new code"
  })
} catch (error) {
  // Fallback: create backup and retry
  console.log("Edit failed, attempting recovery...")

  // Read current state
  const current = await fileReadTool.execute({
    path: "src/app.ts"
  })

  // Manual fix with validation
  await editFileTool.execute({
    path: "src/app.ts",
    oldContent: current.content,
    newContent: "recovered code",
    backup: true
  })
}
```

### Context-Aware Operations

**Smart File Analysis:**
```typescript
// Analyze project structure
const packageJson = await fileReadTool.execute({
  path: "package.json"
})

// Determine project type and run appropriate commands
if (packageJson.content.includes('"react"')) {
  await runTool.execute({
    command: "npm run start",
    background: true,
    env: { BROWSER: "none" }
  })
} else if (packageJson.content.includes('"vue"')) {
  await runTool.execute({
    command: "npm run serve",
    background: true
  })
}
```

## Best Practices

### Tool Selection Guidelines

1. **BashTool**: For command execution, file operations, builds
2. **EditFileTool**: For precise code changes with validation
3. **FileReadTool**: For analysis, understanding code structure
4. **RunTool**: For long-running processes, servers, watchers

### Error Prevention

1. Always use `preview: true` for complex edits
2. Enable `backup: true` for critical files
3. Validate commands before execution
4. Use timeouts for long-running operations

### Performance Optimization

1. Use `maxLines` to prevent memory issues with large files
2. Leverage caching in FileReadTool for repeated access
3. Run background processes for non-blocking operations
4. Clean up processes when done

### Security Considerations

1. Dangerous commands are automatically blocked
2. Sensitive operations are logged
3. File operations are workspace-bound
4. Binary files are rejected for reading