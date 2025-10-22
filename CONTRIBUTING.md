# Contributing to Cappy

Thank you for your interest in contributing to Cappy! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0 or higher
- VS Code 1.105.0 or higher
- Git
- Basic knowledge of TypeScript and React

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/cappy.git
   cd cappy
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Extension**
   ```bash
   npm run compile-extension
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Start Development**
   ```bash
   # Terminal 1: Watch TypeScript compilation
   npm run watch
   
   # Terminal 2: Start Vite dev server (for webview development)
   npm run dev
   ```

## 🏗️ Project Structure

```
src/
├── domains/           # Business logic (Clean Architecture)
│   ├── chat/         # Chat and conversation management
│   ├── graph/        # Knowledge graph operations
│   └── workspace/    # Workspace analysis
├── adapters/         # External interfaces
│   ├── primary/      # VS Code integration
│   └── secondary/    # Databases, APIs, tools
├── services/         # Application services
├── types/           # TypeScript definitions
└── extension.ts     # Main extension entry point
```

## 🎯 How to Contribute

### 1. Reporting Issues

Before creating an issue:
- Search existing issues to avoid duplicates
- Use the issue templates when available
- Provide clear reproduction steps
- Include relevant system information

### 2. Suggesting Features

- Open a discussion first for major features
- Explain the use case and benefits
- Consider implementation complexity
- Be open to feedback and alternatives

### 3. Code Contributions

#### Small Changes
- Fix typos, improve documentation
- Small bug fixes
- Minor performance improvements

#### Major Changes
- New features or significant refactoring
- Always discuss in an issue first
- Consider breaking changes carefully
- Update documentation and tests

## 📝 Development Guidelines

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Use Prettier (configured in project)
- **Linting**: Follow ESLint rules
- **Naming**: Use descriptive names, follow conventions
- **Comments**: JSDoc for public APIs, inline for complex logic

### Architecture Principles

- **Clean Architecture**: Separate concerns into layers
- **Dependency Injection**: Use interfaces and dependency inversion
- **Single Responsibility**: Each class/function has one purpose
- **Open/Closed**: Open for extension, closed for modification

### Testing

- **Unit Tests**: Test business logic in isolation
- **Integration Tests**: Test adapter interactions
- **Coverage**: Aim for >80% coverage on new code
- **Test Structure**: Arrange, Act, Assert pattern

```typescript
// Example test structure
describe('WorkspaceScanner', () => {
  it('should scan files and create graph nodes', async () => {
    // Arrange
    const mockRepository = createMockRepository();
    const scanner = new WorkspaceScanner(mockRepository);
    
    // Act
    const result = await scanner.scanWorkspace();
    
    // Assert
    expect(result.processedFiles).toBeGreaterThan(0);
    expect(mockRepository.createNode).toHaveBeenCalled();
  });
});
```

### Git Workflow

1. **Branch Naming**
   - `feature/description` - New features
   - `fix/description` - Bug fixes
   - `docs/description` - Documentation updates
   - `refactor/description` - Code refactoring

2. **Commit Messages**
   ```
   type(scope): description
   
   - feat: add new feature
   - fix: resolve bug
   - docs: update documentation
   - style: formatting changes
   - refactor: code restructuring
   - test: add or update tests
   - chore: maintenance tasks
   ```

3. **Pull Request Process**
   - Create from feature branch to main
   - Fill out PR template completely
   - Ensure all checks pass
   - Request review from maintainers
   - Address feedback promptly

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Categories

- **Unit Tests**: `*.test.ts` - Test individual functions/classes
- **Integration Tests**: `*.integration.test.ts` - Test component interactions
- **E2E Tests**: `*.e2e.test.ts` - Test full workflows

### Writing Tests

- Test behavior, not implementation
- Use descriptive test names
- Mock external dependencies
- Test edge cases and error conditions
- Keep tests focused and independent

## 📚 Documentation

### Code Documentation

- **JSDoc**: Document all public APIs
- **README**: Keep project README updated
- **Architecture Docs**: Document design decisions
- **API Docs**: Generate from JSDoc comments

### Writing Guidelines

- Use clear, concise language
- Include code examples
- Explain the "why", not just the "what"
- Keep documentation up to date with code changes

## 🔍 Code Review Process

### For Contributors

- Self-review your code before submitting
- Write clear PR descriptions
- Respond to feedback constructively
- Make requested changes promptly
- Test your changes thoroughly

### Review Criteria

- **Functionality**: Does it work as intended?
- **Code Quality**: Is it readable and maintainable?
- **Performance**: Are there any performance implications?
- **Security**: Are there any security concerns?
- **Tests**: Are there adequate tests?
- **Documentation**: Is documentation updated?

## 🚀 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release PR
4. Tag release after merge
5. Publish to VS Code Marketplace

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on the issue, not the person
- Help others learn and grow

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Requests**: Code contributions and reviews

## 🆘 Getting Help

### Resources

- [Project Documentation](docs/)
- [Architecture Overview](docs/architecture/)
- [API Reference](docs/api/)

### Support Channels

- **GitHub Issues**: Technical problems
- **GitHub Discussions**: General questions
- **Email**: eduardo@cecon.dev (maintainer)

## 🎉 Recognition

Contributors are recognized in:
- README.md acknowledgments
- Release notes
- GitHub contributors page
- Special thanks in major releases

Thank you for contributing to Cappy! 🦫