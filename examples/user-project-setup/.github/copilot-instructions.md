# GitHub Copilot Instructions - Cappy

## Primary Directive
This project uses the Cappy for atomic task management and automatic error prevention. 

**ALWAYS** follow the comprehensive methodology detailed in:
- `.github/instructions/forge-methodology.md` - Complete Cappy workflow
- `.github/instructions/forge-templates.md` - STEP templates and structure  
- `.github/instructions/forge-patterns.md` - Context-specific patterns and rules

## Core Behavior
1. **STEP Creation**: Create atomic tasks using 4-file structure with error accumulation
2. **Atomicity Validation**: Ensure tasks are completable in 1-3 hours
3. **Error Prevention**: Inherit and accumulate "DON'T DO" rules from previous STEPs
4. **Progressive Learning**: Every mistake becomes prevention for future STEPs

## Quick Reference
- Use `steps/STEP_XX_[TASK_NAME]/` structure
- Always read previous STEP_XX_DIFFICULTIES_FACED.md first
- Copy accumulated rules to new STEP_XX_DESCRIPTION.md
- Document completion and propagate lessons learned

For complete instructions, refer to the files in `.github/instructions/`.
