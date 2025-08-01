# Capybara Methodology - Complete Workflow

## 🎯 **Capybara Core Rules**

When asked to "create STEP_XX" or "set up Capybara structure":

1. **Always create this folder structure:**
```
steps/STEP_XX_[TASK_NAME]/
├── STEP_XX_DESCRIPTION.md
├── STEP_XX_DONE.md  
├── STEP_XX_DIFFICULTIES_FACED.md
└── artifacts/
```

2. **FIRST: Read previous STEP_[XX-1]_DIFFICULTIES_FACED.md** (if exists)
3. **Extract and accumulate "DON'T DO" rules** in new DESCRIPTION.md
4. **Auto-populate files with appropriate templates**
5. **Follow atomicity analysis in DESCRIPTION.md**
6. **Set up validation criteria specific to task type**

## ⚛️ **Atomicity Analysis - ALWAYS First**

Before implementing ANY task:
- **Atomic Task**: Can be completed in 1-3 hours with single, clear objective
- **Non-Atomic**: Needs decomposition into smaller sub-tasks

```
❌ BAD: "Implement complete authentication system"
✅ GOOD: "Create JWT middleware for token validation"
```

**If task is NOT atomic → STOP and decompose first**

## 🔄 **Task Decomposition Patterns**

**Authentication**: middleware → endpoints → database_integration → testing
**API Development**: schema_design → endpoints → validation → testing  
**Database**: schema → migrations → repositories → testing
**Setup**: dependencies → configuration → environment → validation

## 🤖 **Agent Response Pattern**

#### When user says: "Create STEP_XX for [task]"

```
✅ Creating STEP_02_SETUP_DATABASE

📖 Reading STEP_01_DIFFICULTIES_FACED.md → "Accumulated DON'Ts" section...
🚨 Found 2 accumulated rules to carry forward:
  - DON'T use open SQLx versions
  - DON'T forget Windows .exe suffix

📊 Atomicity Analysis:
- Task: "Set up database connection and migrations"  
- Estimated: 2.5 hours (+30min for known issues)
- Complexity: 3/5
- Status: ✅ ATOMIC (proceeding)

📁 Creating structure:
/steps/STEP_02_SETUP_DATABASE/
├── STEP_02_DESCRIPTION.md (✅ populated + 2 accumulated rules)
├── STEP_02_DONE.md (✅ template ready)  
├── STEP_02_DIFFICULTIES_FACED.md (✅ EMPTY template - will accumulate at completion)
└── artifacts/ (✅ folder created)

🎯 Prevention rules applied from previous STEPs in DESCRIPTION.md
🎯 Next: Review STEP_02_DESCRIPTION.md and start implementation
```

## 🔄 **STEP Execution Flow**

```
1. Read previous STEP_XX_DIFFICULTIES_FACED.md → "Accumulated DON'Ts" section
2. Copy accumulated rules to new DESCRIPTION.md 
3. Read task description
4. ⚛️ Analyze atomicity (≤3h?)
5. If non-atomic → Decompose into sub-tasks
6. Check pre-flight checklist + accumulated prevention rules
7. Implement incrementally
8. Test after each change
9. Document completion in DONE.md
10. 🔄 CRITICAL: Update DIFFICULTIES_FACED.md with:
    - Copy all accumulated rules from DESCRIPTION.md
    - Add any NEW problems from this STEP
    - Create final "Accumulated DON'Ts for Next STEP" section
```

## 🚨 **Progressive Error Accumulation**

**STEP_01**: No previous errors → 1 new error → 1 total rule for STEP_02  
**STEP_02**: 1 inherited + 2 new = 3 total rules for STEP_03  
**STEP_03**: 3 inherited + 1 new = 4 total rules for STEP_04  

**Each STEP gets progressively smarter with minimal manual work**

## 🔄 **STEP Completion Propagation (CRITICAL)**

**When finishing ANY STEP, you MUST:**

1. **Copy** accumulated rules from `STEP_XX_DESCRIPTION.md` 
2. **Add** any NEW "DON'T DO" rules from current STEP problems
3. **Update** `STEP_XX_DIFFICULTIES_FACED.md` → "Accumulated DON'Ts for Next STEP" section
4. **Result**: Next STEP will inherit ALL previous lessons in one place

## 🚨 **CRITICAL: If You Encounter Problems**

1. **STOP** - Don't push through errors
2. **DOCUMENT** - Record the exact problem in DIFFICULTIES_FACED.md
3. **PATTERN** - Identify if it's a known issue type
4. **SOLVE** - Fix methodically, not randomly
5. **PREVENT** - Create simple "DON'T DO" rule
6. **🔄 PROPAGATE** - At STEP completion: inherit + add new rules

**🎯 Key Benefit**: Next STEP inherits complete knowledge with zero manual effort!
