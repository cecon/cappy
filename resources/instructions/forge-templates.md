# FORGE Templates - STEP File Structures

# FORGE Templates - STEP File Structures

## Template: `STEP_0XXX_DESCRIPTION.md`
```markdown
# STEP_0XXX: [TASK_TITLE]

## ⚛️ Atomicity Check: [AUTO-CALCULATE]
- **Estimated hours**: [X.X] 
- **Complexity score**: [1-5]
- **Is atomic**: [YES/NO - if NO, decompose first]

## 🚨 Inherited Prevention Rules (Max: 50 from config)
**Source**: STEP_0XXX_DIFFICULTIES_FACED.md (prioritized by relevance)

- ❌ **DON'T** use `cargo build` on Windows → use `cargo.exe build`
- ❌ **DON'T** use open versions → pin `sqlx = "0.7.4"`
- ❌ **DON'T** forget features → `sqlx = { version = "0.7.4", features = ["migrate"] }`
- ❌ **DON'T** use `.unwrap()` → always handle `Result<T,E>`
- ❌ **DON'T** create migrations manually → use `alembic revision -m "description"`

[Auto-populated from previous STEP's DIFFICULTIES_FACED.md, summarized by context relevance]

---

## 📋 Context  
- **Objective**: [Specific, measurable goal from questionnaire]
- **Prerequisites**: [What must be ready]
- **Dependencies**: [Other STEPs that must be complete]

## 🎯 Validation Criteria
[Generate 3-5 specific, testable criteria based on task type]

## 🧪 Unit Testing Requirements
**Config**: `tasks.requireUnitTests` from `src/models/forgeConfig.ts`

[If requireUnitTests = true:]
- **Framework**: {tasks.testFramework} (from config)
- **Coverage Target**: {tasks.testCoverage}% (from config)
- **Required Tests**:
  - [ ] Happy path scenarios
  - [ ] Error/edge cases  
  - [ ] Input validation
  - [ ] Integration points
- **Test Files**: Create in `/tests/` or `/__tests__/` directory
- **Test Naming**: `[filename].test.[ext]` or `[filename].spec.[ext]`

[If requireUnitTests = false:]
- Unit tests optional for this STEP
- Focus on acceptance criteria validation

## 📝 Implementation Notes
[Technical approach, key decisions to make]

---
Created: [CURRENT_DATE]
Status: [ ] Not Started [x] Ready [ ] Complete
```

## Template: `STEP_0XXX_DONE.md` 
```markdown
# STEP_0XXX: [TASK_TITLE] - ✅ COMPLETED

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

## 📝 **Accumulated Prevention Rules for Next STEP**
**Source**: All Previous STEPs + Current STEP (Max: {context.maxRules} from config)

### 🔥 High Priority (Critical Issues)
❌ **DON'T** use `cargo build` on Windows → use `cargo.exe build`
❌ **DON'T** use open versions → pin `sqlx = "0.7.4"`  
❌ **DON'T** forget features → `sqlx = { version = "0.7.4", features = ["migrate"] }`

### 📋 Context-Specific Rules
❌ **DON'T** use `.unwrap()` → always handle `Result<T,E>`
❌ **DON'T** create migrations manually → use `alembic revision -m "description"`
❌ **DON'T** [new rule from this STEP if any]

[This section auto-populated at STEP completion, filtered by relevance and config limits]

---
Recorded: [DATE]
Total Rules Available: [X]
```

## 🎯 **Questionnaire Template for New STEP Creation**

```markdown
## 📋 **FORGE STEP Creation Questionnaire**

**Trigger**: User says "vamos desenvolver uma nova atividade"

### 1. **Task Objective** 🎯
"Qual é o objetivo específico desta tarefa?"
- What specific outcome should this STEP achieve?
- How will success be measured?

### 2. **Current State Analysis** 📊  
"Qual é o estado atual do projeto?"
- What's currently working/implemented?
- What dependencies exist from previous STEPs?

### 3. **Technical Scope** 🔧
"Quais tecnologias/frameworks estão envolvidos?"
- Which technologies/frameworks are involved?
- Are there specific patterns/approaches required?

### 4. **Success Criteria** ✅
"Como saberemos que a tarefa foi concluída com sucesso?"
- What must be demonstrable when complete?
- What tests/validations should pass?

### 5. **Complexity Assessment** ⚛️
"Qual é sua estimativa inicial de tempo/complexidade?"
- Initial time estimate?
- Any known complexity factors?

---

## 🤖 **LLM Confidence Check**
```
Based on questionnaire responses:
- **Understanding Level**: [1-10] (create only if ≥8)
- **Atomicity Assessment**: [ATOMIC/NEEDS_DECOMPOSITION]
- **Missing Information**: [List specific gaps]
- **Ready to Create STEP**: [YES/NO]

If NO → "Preciso de mais informações sobre: [list gaps]"
If YES → "✅ Confiança suficiente! Criando STEP_XXXX automaticamente..."
```
```
