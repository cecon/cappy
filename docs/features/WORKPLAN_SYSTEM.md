# WorkPlan System - JSON-based Structured Planning

## Overview

The WorkPlan system provides a comprehensive, machine-readable approach to development planning. Plans are stored as structured JSON with rich metadata, enabling automated execution, tracking, and post-execution hooks.

## Architecture

### Core Components

1. **Type Definitions** (`src/nivel2/infrastructure/agents/codeact/types/work-plan.ts`)
   - Complete TypeScript interfaces for all plan structures
   - 20+ interfaces covering goals, requirements, steps, hooks, metrics

2. **SavePlanTool** (`src/nivel2/infrastructure/agents/codeact/tools/save-plan-tool.ts`)
   - Saves plans in JSON and/or Markdown format
   - Generates human-readable Markdown from JSON
   - Stores in `.cappy/plans/` directory

3. **ExecutePlanTool** (`src/nivel2/infrastructure/agents/codeact/tools/execute-plan-tool.ts`)
   - Executes plan steps with 3 modes: step, all, resume
   - Tracks execution metrics (duration, LLM calls)
   - Runs post-execution hooks automatically
   - Handles validation and error recovery

4. **Planning Agent Integration** (`src/nivel2/infrastructure/agents/sub-agents/planning/agent.ts`)
   - Updated to generate JSON plans via LLM
   - Collects requirements through interactive questions
   - Uses SavePlanTool for persistence

## WorkPlan Structure

### Metadata
```json
{
  "id": "unique-plan-id",
  "version": "1.0.0",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "status": "draft|ready|in_progress|completed|failed"
}
```

### Goal Definition
```json
{
  "goal": {
    "title": "Brief title",
    "description": "Detailed description",
    "userRequest": "Original user request",
    "clarifications": [
      {
        "question": "What was asked",
        "answer": "User's response",
        "source": "user|retrieved|inferred"
      }
    ]
  }
}
```

### Requirements
```json
{
  "requirements": {
    "functional": ["List of features"],
    "technical": ["Technical constraints"],
    "constraints": ["Business/time limitations"]
  }
}
```

### Context
```json
{
  "context": {
    "relevantFiles": [
      {
        "path": "src/file.ts",
        "startLine": 10,
        "endLine": 50,
        "description": "Why relevant"
      }
    ],
    "dependencies": ["npm-package-1"],
    "architecture": "Hexagonal architecture",
    "patterns": ["Repository", "Factory"]
  }
}
```

### Implementation Steps
```json
{
  "steps": [
    {
      "id": "step-1",
      "title": "Step title",
      "description": "What it does",
      "status": "pending|in_progress|completed|failed|skipped",
      "action": {
        "type": "create_file|edit_file|run_command|ask_user|custom",
        "details": "Specific instructions",
        "expectedOutput": "What should result"
      },
      "context": {
        "reasoning": "Why this step",
        "constraints": ["Limitations"],
        "dependencies": ["Required steps"]
      },
      "relevantFiles": [...],
      "validation": {
        "command": "npm test",
        "expectedResult": "Tests pass"
      },
      "execution": {
        "startedAt": "ISO-8601",
        "completedAt": "ISO-8601",
        "duration": 5000,
        "llmCalls": 3,
        "error": "Error message if failed"
      }
    }
  ]
}
```

### Post-Execution Hooks
```json
{
  "postExecutionHooks": [
    {
      "id": "hook-git",
      "name": "Git Commit",
      "description": "Commit changes",
      "enabled": true,
      "order": 1,
      "action": {
        "type": "git_commit|run_tests|update_docs|update_embeddings|custom",
        "command": "optional command",
        "params": { "message": "commit msg" }
      },
      "condition": {
        "onSuccess": true,
        "onFailure": false,
        "onStepsCompleted": ["step-1", "step-2"]
      }
    }
  ]
}
```

### Testing Strategy
```json
{
  "testing": {
    "strategy": "Overall approach",
    "testCases": [
      {
        "id": "test-1",
        "description": "What to test",
        "type": "unit|integration|e2e",
        "command": "npm test -- file.test.ts"
      }
    ]
  }
}
```

### Success Criteria
```json
{
  "successCriteria": [
    {
      "id": "criteria-1",
      "description": "Measurable criterion",
      "verified": false
    }
  ]
}
```

### Execution Metrics
```json
{
  "metrics": {
    "totalSteps": 5,
    "completedSteps": 3,
    "failedSteps": 0,
    "totalDuration": 15000,
    "llmCallsTotal": 12
  }
}
```

## Usage

### Creating a Plan

Ask the Planning Agent to create a plan:

```
User: "Crie um plano para implementar autenticação JWT"
```

The agent will:
1. Ask 5 clarification questions (goal, scope, stack, constraints, timeline)
2. Generate structured JSON plan via LLM
3. Save both JSON and Markdown versions
4. Report file locations

### Executing a Plan

Three execution modes available:

1. **Step Mode** - Execute next pending step
   ```typescript
   ExecutePlanTool.execute({ plan, mode: 'step' })
   ```

2. **All Mode** - Execute all pending steps
   ```typescript
   ExecutePlanTool.execute({ plan, mode: 'all' })
   ```

3. **Resume Mode** - Continue from last incomplete step
   ```typescript
   ExecutePlanTool.execute({ plan, mode: 'resume' })
   ```

4. **Specific Step** - Execute by ID
   ```typescript
   ExecutePlanTool.execute({ plan, mode: 'step', stepId: 'step-3' })
   ```

### Post-Execution Hooks

Hooks run automatically after plan completion:

**Available Hook Types:**
- `git_commit` - Create Git commit
- `run_tests` - Execute test suite
- `update_docs` - Trigger documentation update
- `update_embeddings` - Reindex semantic search (calls `cappy.reindex`)
- `custom` - Run custom command

**Conditional Execution:**
- `onSuccess: true` - Only if no failures
- `onFailure: true` - Only if failures occurred
- `onStepsCompleted: [...]` - Only if specific steps completed

## File Locations

### Plans Storage
- **JSON**: `.cappy/tasks/{timestamp}_slug.json`
- **Markdown**: `.cappy/tasks/{timestamp}_slug.md`

Example: `.cappy/tasks/2024-01-01_implement-jwt-auth.json`

### Type Definitions
- `src/nivel2/infrastructure/agents/codeact/types/work-plan.ts`

### Tools
- `src/nivel2/infrastructure/agents/codeact/tools/save-plan-tool.ts`
- `src/nivel2/infrastructure/agents/codeact/tools/execute-plan-tool.ts`

## Benefits

### Machine-Readable
- Parse and manipulate programmatically
- Integrate with CI/CD pipelines
- Track metrics automatically

### Human-Readable
- Markdown export for review
- Clear structure with emojis
- Line-by-line file references

### Executable
- Step-by-step or full execution
- Automatic validation
- Error recovery with user prompts

### Trackable
- Execution metrics
- Duration and LLM call counts
- Success/failure tracking

### Automated
- Post-execution hooks
- Git commits
- Test execution
- Documentation updates
- Embedding reindexing

## Example Workflow

1. **User Request**
   ```
   "Crie um plano para adicionar suporte a temas no dashboard"
   ```

2. **Agent Collects Info**
   - Objetivo: Permitir dark/light themes
   - Escopo: Dashboard e chat UI
   - Stack: Existing (Tailwind CSS)
   - Restrições: Manter compatibilidade
   - Prazo: 1 semana

3. **LLM Generates Plan**
   - 5 steps: Setup → Implement → Test → Document → Deploy
   - File references with line numbers
   - Validation commands
   - Post-execution hooks

4. **Plan Saved**
   ```
   .cappy/tasks/2024-01-01_theme-support.json
   .cappy/tasks/2024-01-01_theme-support.md
   ```

5. **User Executes**
   ```typescript
   ExecutePlanTool.execute({ plan, mode: 'all' })
   ```

6. **Hooks Run**
   - Git commit: "feat: add theme support"
   - Run tests: `npm test`
   - Update embeddings: `cappy.reindex`

## Future Enhancements

### Planned Features
- [ ] Plan templates by category
- [ ] Plan versioning and history
- [ ] Parallel step execution
- [ ] Step dependencies graph
- [ ] Real-time progress UI
- [ ] Plan approval workflow
- [ ] Integration with task management systems

### Potential Improvements
- More action types (API calls, database operations)
- Rollback mechanism for failed steps
- Plan merging and composition
- LLM-powered plan optimization
- Automatic step estimation
- Resource allocation tracking

## Technical Notes

### Design Decisions

1. **Why JSON + Markdown?**
   - JSON: Machine-readable, queryable, executable
   - Markdown: Human-readable, reviewable, shareable

2. **Why Utility Functions vs Tool Classes?**
   - SavePlanTool and ExecutePlanTool are workflow-specific
   - Not general-purpose agent tools
   - Called directly by Planning Agent

3. **Why Separate Hooks from Steps?**
   - Steps: Implementation tasks
   - Hooks: Post-completion automation
   - Clear separation of concerns

4. **Why File References with Line Numbers?**
   - Precise context for LLM
   - Direct navigation in editor
   - Better for code analysis

### Performance Considerations

- Plans stored as files (not in database)
- JSON parsing overhead minimal (<1ms for typical plan)
- Markdown generation on-demand
- Hooks execute sequentially (future: parallel)

### Error Handling

- JSON parse errors: Fallback to default plan
- Step execution errors: User prompt to continue/stop
- Hook errors: Log and continue (don't fail plan)
- Validation failures: Reported but not blocking

## Related Documentation

- [Task Workflow](./TASK_WORKFLOW.md) - Overall task system
- [Planning Agent](../architecture/NIVEL1_UI_MIGRATION.md) - Sub-agent architecture
- [Context Retrieval](./CONTEXT_RETRIEVAL_TOOL.md) - Context gathering
- [Agent Architecture](../architecture/ARCHITECTURE_OVERVIEW.md) - System design

---

**Status**: ✅ Fully Implemented  
**Version**: 1.0.0  
**Last Updated**: 2024-01-06
