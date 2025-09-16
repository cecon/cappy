# Cappy Framework - Tech Stack

## Languages & Frameworks
- **TypeScript 4.9.4**: Primary development language for VS Code extension
- **Node.js 20.x**: Development runtime (LTS versions compatible)
- **VS Code Extension API 1.75.0+**: Target platform for extension development

## File Formats & Data
- **XML**: Task instruction scripts and configuration templates
- **JSON**: VS Code configuration, package.json, tmLanguage syntax definitions
- **Markdown**: Documentation and user-facing content
- **YAML**: Cappy configuration files

## Project Structure
```
cappy-framework/
├── src/                    # TypeScript source code
│   ├── extension.ts        # Main extension entry point
│   ├── commands/          # Command implementations
│   ├── models/            # Data models and types
│   ├── utils/             # Utility functions
│   └── test/              # Test suite
├── resources/             # XML instruction templates and scripts
├── syntaxes/              # tmLanguage files for syntax highlighting
├── snippets/              # VS Code snippets
├── assets/                # Icons and visual assets
└── docs/                  # Technical documentation
```

## Dependencies & Versions
### Production
- `date-fns 2.29.3`: Date manipulation utilities

### Development
- `@types/vscode ^1.74.0`: VS Code API type definitions
- `typescript ^4.9.4`: TypeScript compiler
- `mocha ^10.1.0`: Test framework
- `sinon ^21.0.0`: Test mocking library
- `@vscode/vsce ^3.6.0`: Extension packaging tool
- `eslint ^8.28.0`: Code linting

## Coding Standards
- **ES2020** target with CommonJS modules
- **Strict TypeScript** configuration enabled
- **ESLint** for code quality enforcement
- **Naming Convention**: Commands prefixed with `cappy.`, use camelCase
- **File Organization**: Separate commands, models, utils, and tests

## Build, Test & CI/CD
### Build Process
- `npm run compile`: TypeScript compilation to `out/` directory
- `npm run watch`: Development mode with file watching
- `npm run package`: Generate .vsix package file

### Testing
- **Local testing only** using Mocha + Sinon
- `npm run test`: Full test suite execution
- No CI/CD pipeline configured (manual testing)

### Deployment
- **Manual deployment** to VS Code Marketplace
- `npm run publish`: Direct publish via vsce
- Version management through package.json

## Runtime & Deploy Environments
### Development
- **Local VS Code instance** for extension testing
- **Node.js 20.x** for build processes
- **Windows PowerShell** as default shell environment

### Production
- **VS Code Marketplace**: Extension distribution platform
- **User VS Code instances**: Runtime environment (1.75.0+ required)
- **File system**: `.cappy/` directory for task management

## Observability & Tooling
- **VS Code Extension Host**: Runtime logging and debugging
- **TypeScript source maps**: Debug support
- **ESLint**: Static code analysis
- **No external monitoring**: Self-contained extension

## Constraints & Non-Goals
### Constraints
- **VS Code only**: Extension tied to VS Code ecosystem
- **Local file system**: All data stored in workspace `.cappy/` directory
- **Single user**: No multi-user or collaboration features
- **Offline operation**: No external API dependencies

### Non-Goals
- **Web-based interface**: VS Code extension only
- **Real-time collaboration**: Single developer focus
- **Cloud storage**: All data remains local
- **Mobile support**: Desktop development tool only
- **Database integration**: File-based storage approach

## Core Architecture
- **LLM Runtime**: Commands prefixed with `cappy:` for AI interaction
- **XML-based task system**: Structured task definitions and workflows
- **Prevention rules**: Learning system for avoiding repeated mistakes
- **Atomic tasks**: Maximum 3-hour work units for maintainability
- **Single source of truth**: `.cappy/output.txt` for command results
