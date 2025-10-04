# Cappy Framework - Stack Knowledge Base

## Overview
Cappy é uma extensão do VS Code para orquestração de contexto e automação de tarefas de desenvolvimento. O framework utiliza metodologia baseada em XML para definir tarefas atômicas com contexto automatizado.

## Tech Stack

### Core Technologies
- **Language**: TypeScript
- **Platform**: VS Code Extension API
- **Package Manager**: npm
- **Testing**: Mocha

### Key Dependencies
- VS Code Extension API
- XML parsing and validation
- File system operations
- YAML configuration

## Architecture

### Project Structure
```
src/
├── extension.ts           # Main extension entry point
├── commands/              # VS Code command implementations
│   ├── initCappy.ts
│   ├── createTaskFile.ts
│   ├── workOnCurrentTask.ts
│   └── ...
├── models/                # Data models and types
├── utils/                 # Utility functions
└── test/                  # Test suites
```

### Key Components
- **Commands**: VS Code command handlers for Cappy operations
- **File Manager**: Handles XML task files and configuration
- **Output Writer**: Manages .cappy/output.txt for command results
- **Environment Detector**: Detects project context

## Development Workflows

### Building
- `npm run compile` - Compile TypeScript
- `npm run test` - Run test suite

### Publishing
1. Update version in package.json
2. `npm run compile`
3. `npm run package` (creates .vsix)
4. `npm run publish`

### Key Files
- `package.json` - Extension manifest and dependencies
- `tsconfig.json` - TypeScript configuration
- `.cappy/` - Runtime directory for tasks and configuration

## Cappy Methodology
- Tasks are defined in XML format following XSD schema
- Each task has context, execution steps, and validation checklists
- Commands communicate through `.cappy/output.txt`
- Prevention rules system for automated quality checks

## AI Coding Instructions

### Command Execution Rules
- **NEVER** execute Cappy commands in terminal - always use VS Code API
- **ALWAYS** check `.cappy/output.txt` after command execution
- If output.txt is empty, respond: "No output in .cappy/output.txt. Re-execute in VS Code."

### Task Management
- Only one active task at a time (marked with .ACTIVE.xml)
- Tasks follow strict XML schema validation
- Context is automatically orchestrated per task category

### Development Patterns
- Use TypeScript strict mode
- Follow VS Code extension guidelines
- Implement proper error handling for file operations
- Test command implementations thoroughly
