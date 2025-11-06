# Cappy Prefixes - Command System

## Overview

Cappy supports **prefix-based commands** for explicit control over agent behavior:

- `@cappy/plan` - Create a structured WorkPlan (Planning Agent)
- `@cappy/code` - Direct code execution (CodeAct Agent)
- `@cappy` - Auto-routing based on intent detection

## Usage

### 📋 @cappy/plan - Planning Mode

Creates a **structured JSON WorkPlan** with steps, validation, and post-execution hooks.

**Examples:**
```
@cappy/plan improve the README to explain how Cappy works

@cappy/plan implement JWT authentication with refresh tokens

@cappy/plan refactor the agent architecture to support plugins
```

**Behavior:**
1. ✅ Activates Planning Agent (priority override)
2. ✅ Asks 5 clarification questions
3. ✅ Generates WorkPlan JSON via LLM
4. ✅ Saves to `.cappy/tasks/{timestamp}_slug.json`
5. ✅ Creates Markdown version for review

**Output:**
- JSON plan with 5-7 actionable steps
- File references with line ranges
- Post-execution hooks (git, tests, docs, embeddings)
- Success criteria and metrics

---

### 💻 @cappy/code - Direct Execution Mode

Executes code changes **immediately** without creating a plan.

**Examples:**
```
@cappy/code fix the typo in line 42 of agent.ts

@cappy/code add a TODO comment in the validate function

@cappy/code update the version in package.json to 3.2.0
```

**Behavior:**
1. ✅ Bypasses Planning Agent
2. ✅ Uses CodeAct Agent directly
3. ✅ Executes tools (file_read, file_write, edit_file, bash)
4. ✅ Returns result immediately

**Use Cases:**
- Quick fixes
- Simple edits
- One-off commands
- Terminal operations

---

### 🤖 @cappy - Auto-Routing (Default)

Let Cappy **decide** based on intent detection and context.

**Examples:**
```
@cappy how does the retrieval system work?

@cappy what files are in src/nivel2?

@cappy explain the agent architecture
```

**Behavior:**
1. ✅ Analyzes user intent
2. ✅ Routes to appropriate sub-agent
3. ✅ Can activate Planning, Clarification, Analysis, or Execution agents
4. ✅ Smart decision based on keywords and context

**Intent Categories:**
- `feature-implementation` → Planning Agent
- `architecture` → Planning Agent
- `debug` → Execution Agent
- `question` → Clarification/Analysis Agent

---

## Decision Flow

```mermaid
graph TD
    A[User Message] --> B{Contains Prefix?}
    B -->|@cappy/plan| C[Planning Agent]
    B -->|@cappy/code| D[CodeAct Agent]
    B -->|@cappy| E[Intent Detection]
    
    E --> F{Intent Category}
    F -->|feature/architecture| C
    F -->|debug/fix| D
    F -->|question| G[Clarification Agent]
    
    C --> H[Generate WorkPlan]
    D --> I[Execute Directly]
    G --> J[Provide Answer]
```

## Comparison

| Aspect | @cappy/plan | @cappy/code | @cappy |
|--------|-------------|-------------|---------|
| **Speed** | Slower (questions + planning) | Fast (immediate) | Variable |
| **Structure** | Highly structured | Ad-hoc | Depends on intent |
| **Output** | JSON + Markdown plan | Direct changes | Varies |
| **Use Case** | Complex features | Quick fixes | General use |
| **Tracking** | Full metrics | Basic logs | Depends |
| **Validation** | Built-in per step | Manual | Depends |
| **Hooks** | Yes (git, tests, docs) | No | Depends |

## Best Practices

### ✅ Use @cappy/plan When:
- Implementing new features
- Complex refactoring
- Multi-file changes
- Need documentation/testing strategy
- Want step-by-step execution
- Need approval before execution

### ✅ Use @cappy/code When:
- Fixing typos
- Single-line changes
- Running terminal commands
- Quick experiments
- Time-sensitive fixes

### ✅ Use @cappy When:
- Asking questions
- Exploring codebase
- Unsure which mode to use
- Want Cappy to decide

## Examples

### Scenario 1: New Feature
**Bad:**
```
@cappy/code add user authentication
```
❌ Too complex for direct execution

**Good:**
```
@cappy/plan implement user authentication with JWT tokens and refresh logic
```
✅ Creates structured plan with steps, validation, and hooks

---

### Scenario 2: Quick Fix
**Bad:**
```
@cappy/plan fix typo in README line 42
```
❌ Overkill - will ask 5 questions for a typo

**Good:**
```
@cappy/code fix typo in README line 42: "functoin" → "function"
```
✅ Direct, fast execution

---

### Scenario 3: Exploration
**Bad:**
```
@cappy/code explain the agent system
```
❌ Code mode won't answer questions well

**Good:**
```
@cappy how does the agent orchestration work?
```
✅ Auto-routes to appropriate agent

## Implementation Details

### Planning Agent Activation

```typescript
canHandle(context: SubAgentContext): boolean {
  const { userMessage } = context
  const messageLower = userMessage.toLowerCase()
  
  // Explicit prefix - highest priority
  if (messageLower.includes('@cappy/plan')) {
    return true
  }
  
  // Keyword detection fallback
  // ...
}
```

### Prefix Removal

```typescript
async *processStream(context: SubAgentContext) {
  let { userMessage } = context
  
  // Clean prefix before processing
  userMessage = userMessage.replace(/@cappy\/plan\s*/gi, '').trim()
  
  // Continue with clean message...
}
```

## Future Prefixes

Potential future commands:

- `@cappy/test` - Generate and run tests
- `@cappy/debug` - Debug mode with verbose logging
- `@cappy/review` - Code review mode
- `@cappy/doc` - Documentation generation
- `@cappy/refactor` - Refactoring suggestions
- `@cappy/optimize` - Performance optimization

## Migration Guide

### Old Behavior (Keyword-based)
```
@cappy create a plan for implementing themes
```
✅ Works but ambiguous

### New Behavior (Prefix-based)
```
@cappy/plan implement theme system
```
✅ Explicit and clear

**Both work**, but prefixes are **recommended** for clarity.

---

**Status**: ✅ Implemented  
**Version**: 1.0.0  
**Last Updated**: 2024-11-06
