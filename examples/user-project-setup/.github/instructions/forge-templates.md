# Cappy Templates - STEP File Structures

## Template: `STEP_XX_DESCRIPTION.md`
```markdown
# STEP_XX: [TASK_TITLE]

## ⚛️ Atomicity Check: [AUTO-CALCULATE]
- **Estimated hours**: [X.X] 
- **Complexity score**: [1-5]
- **Is atomic**: [YES/NO - if NO, decompose first]

## 🚨 Accumulated Errors - DO NOT
**Source**: Previous STEPs summarized

- ❌ **DON'T** use `cargo build` on Windows → use `cargo.exe build`
- ❌ **DON'T** use open versions → pin `sqlx = "0.7.4"`
- ❌ **DON'T** forget features → `sqlx = { version = "0.7.4", features = ["migrate"] }`
- ❌ **DON'T** use `.unwrap()` → always handle `Result<T,E>`
- ❌ **DON'T** create migrations manually → use `alembic revision -m "description"`

[Only include if previous STEPs exist - leave empty for STEP_01]

---

## 📋 Context  
- **Objective**: [Specific, measurable goal]
- **Prerequisites**: [What must be ready]
- **Dependencies**: [Other STEPs that must be complete]

## 🎯 Validation Criteria
[Generate 3-5 specific, testable criteria based on task type]

## 📝 Implementation Notes
[Technical approach, key decisions to make]

---
Created: [CURRENT_DATE]
Status: [ ] Not Started [x] Ready [ ] Complete
```

## Template: `STEP_XX_DONE.md` 
```markdown
# STEP_XX: [TASK_TITLE] - ✅ COMPLETED

## ⏱️ Metrics
- **Time spent**: ___ hours
- **Variance from estimate**: +/-___ hours

## ✅ Implemented
- ✅ [Fill as work progresses]

## 📁 Files Modified
- [List files created/changed]

## 🧪 Validation Results
- [x] [Criteria 1] → ✅ Passed
- [x] [Criteria 2] → ✅ Passed

---
Completed: [DATE] | Approved: [YES/NO]
```

## Template: `STEP_XX_DIFFICULTIES_FACED.md`
**Starts EMPTY - gets populated at completion with accumulated + new errors**

```markdown
# STEP_XX: Difficulties Faced

## 🚨 Issues Encountered

[Fill only if NEW problems occurred in this STEP]

### Problem: [Title]
- **Time lost**: ___ minutes  
- **Description**: [What went wrong]
- **Error**: [Specific error message]
- **Solution**: [How fixed]
- **Pattern**: [Known pattern name or 'new_pattern']
- **❌ DON'T DO**: [Simple rule - 1 line summary]

---

## 📝 **Accumulated DON'Ts for Next STEP**
**Source**: Previous STEPs + Current STEP

❌ **DON'T** use `cargo build` on Windows → use `cargo.exe build`
❌ **DON'T** use open versions → pin `sqlx = "0.7.4"`  
❌ **DON'T** forget features → `sqlx = { version = "0.7.4", features = ["migrate"] }`
❌ **DON'T** use `.unwrap()` → always handle `Result<T,E>`
❌ **DON'T** [new rule from this STEP if any]

[This section gets populated at STEP completion by copying from DESCRIPTION.md + adding new errors]

---
Recorded: [DATE]
```

## Interactive Conversation Templates

### Initial Request Understanding
```
User: "I need to implement user authentication"
AI: "Great! Let me help you create a well-structured Cappy STEP. 
     
     First, let me check if we have previous STEPs to learn from, then tell me more:
     - What type of authentication? (OAuth, JWT, session-based?)
     - Which platforms/frameworks are you using?
     - Do you have any existing authentication infrastructure?"
```

### Scope Clarification & Atomicity Check
```
AI: "To ensure this task is atomic (completable in 1-3 hours), let's break this down:
     
     Based on what you've told me, this might be too large for one STEP.
     Would you prefer to focus on:
     a) Setting up the authentication middleware (STEP_XX)
     b) Implementing the login endpoints (STEP_YY)
     c) Adding token validation (STEP_ZZ)
     d) Setting up user database schema (STEP_WW)
     
     Which feels like the right atomic starting point?"
```

### STEP Structure Creation
```
AI: "Perfect! I'll create STEP_XX for [chosen scope].
     
     📖 First, let me check for accumulated lessons from previous STEPs...
     🚨 Found X prevention rules from previous work
     
     📊 Atomicity Analysis:
     - Estimated: X hours 
     - Complexity: X/5
     - Status: ✅ ATOMIC
     
     Creating Cappy structure with all templates and inherited prevention rules..."
```
