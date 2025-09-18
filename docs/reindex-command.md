# Reindex Command Documentation

## Overview

The `cappy.reindex` command rebuilds semantic indexes for all files in the workspace, including tasks, documentation, and prevention rules. This command leverages VS Code's native APIs for efficient file processing and symbol extraction.

## Purpose

The reindex command maintains up-to-date semantic indexes that enable:
- Fast context discovery during task creation
- Efficient search across documentation and prevention rules
- Automated relationship mapping between tasks and related content
- Better performance in context orchestration

## Functionality

### What Gets Indexed

1. **Tasks** (`/cappy/tasks/` and `.cappy/history/`)
   - Active and completed task XML files
   - Extracts task metadata (ID, title, category, keywords)
   - Analyzes task content for semantic context

2. **Documentation** (`docs/` directory)
   - Markdown and text files containing project documentation
   - Extracts titles, categories, and keywords
   - Maps content to relevant technical areas

3. **Prevention Rules** (`docs/prevention/` directory)
   - Prevention rule definitions and guidelines
   - Categorizes rules by severity and domain
   - Enables automatic rule application during task execution

### Generated Index Files

The command creates three JSON index files in `.cappy/indexes/`:

- **`tasks.json`** - Index of all tasks with metadata
- **`docs.json`** - Index of documentation files
- **`rules.json`** - Index of prevention rules

### Index Entry Structure

Each indexed entry contains:
```typescript
interface IndexEntry {
    id: string;           // Unique identifier
    title: string;        // Human-readable title
    path: string;         // Absolute file path
    content: string;      // First 1000 characters for search
    category: string;     // Inferred category (auth, database, api, ui, etc.)
    keywords: string[];   // Extracted keywords for semantic search
    lastModified: string; // ISO timestamp of last modification
    type: 'task' | 'doc' | 'rule'; // Entry type
}
```

## VS Code API Integration

The reindex command utilizes several VS Code native APIs for enhanced performance:

### Document Symbol Provider
- Extracts symbols from code files when available
- Enhances keyword extraction with actual code symbols
- Provides better semantic understanding of file content

### Workspace File Search
- Uses `vscode.workspace.findFiles()` for efficient file discovery
- Finds related files based on naming patterns
- Improves keyword relevance through file relationships

### Text Document API
- Opens documents to extract symbols and metadata
- Provides access to VS Code's language services
- Enables better content analysis

## Usage

### Command Execution

```typescript
// Programmatic execution
const result = await vscode.commands.executeCommand('cappy.reindex');
console.log(result); // Returns summary of indexation results
```

### Manual Execution
1. Open Command Palette (Ctrl+Shift+P)
2. Type "Cappy: Reindex Files"
3. Execute command
4. Monitor progress in notification

### When to Use

- After adding new documentation files
- When prevention rules are updated
- After completing multiple tasks
- To refresh stale index data
- During project setup or migration

## Error Handling

The command includes comprehensive error handling:

- **No Workspace**: Gracefully handles missing workspace folders
- **Uninitialized Project**: Detects when Cappy hasn't been initialized
- **File Access Errors**: Continues processing other files if individual files fail
- **VS Code API Failures**: Falls back to regex-based extraction if APIs fail

## Performance Considerations

### Optimization Features
- Progress reporting for long-running operations
- Batch processing for large file sets
- Efficient memory usage with content truncation
- Asynchronous processing with proper error isolation

### Scalability
- Handles workspaces with hundreds of files
- Limits content per file to prevent memory issues
- Keyword extraction limited to 20 terms per file
- Graceful degradation for very large projects

## Output Format

The command outputs a summary in `.cappy/output.txt`:

```
Reindexation completed successfully:
- Tasks indexed: 15
- Docs indexed: 32
- Rules indexed: 8
- Total entries: 55
- Last updated: 2025-01-15T14:30:00.000Z
```

## Integration with Cappy 2.0

The reindex command is a cornerstone of Cappy 2.0's context orchestration system:

1. **Context Discovery**: Provides data for automatic context discovery during task creation
2. **Prevention Rules**: Enables automatic application of relevant prevention rules
3. **Relationship Mapping**: Creates connections between tasks, docs, and rules
4. **Performance**: Ensures fast access to context without full workspace scans

## Testing

The command includes comprehensive unit tests covering:
- Basic indexation functionality
- Error scenarios (no workspace, uninitialized project)
- Keyword extraction accuracy
- Index file structure validation
- Integration with VS Code APIs

Run tests with:
```bash
npm run test
```

## Troubleshooting

### Common Issues

1. **"Cappy not initialized"**
   - Solution: Run `cappy.init` first

2. **"No workspace folder found"**
   - Solution: Open a project folder in VS Code

3. **Empty index files**
   - Check if files exist in expected directories
   - Verify file permissions
   - Review console output for specific errors

### Debugging

Enable detailed logging by checking VS Code's Developer Console during execution. The command logs warnings for failed file processing while continuing with other files.