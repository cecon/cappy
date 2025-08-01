# GitHub Copilot Instructions - Capybara

## 🎯 **Primary Directive**
This project uses **Capybara** for atomic task management and automatic error prevention.

## 📚 **Stack-Specific Guidelines**
{LOAD_FROM: .github/stack-instructions.md}

**Note**: All code style, testing, and architectural conventions are defined in the stack-instructions file above. Always follow those guidelines when writing code.

## ⚙️ **Environment-Specific Rules**
{INJECT_ENVIRONMENT_RULES_HERE}

**Configuration**: Environment rules loaded from `capybaraConfig.environment`
- **OS**: {environment.os}
- **Shell**: {environment.shell}  
- **Editor**: {environment.editor}
- **Package Manager**: {environment.packageManager}

## 🦫 **Capybara Methodology**tructions - Capybara

## 🎯 **Primary Directive**
This project uses the **Capybara** for atomic task management and automatic error prevention.

## 📚 **Stack-Specific Guidelines**
{LOAD_FROM: .github/stack-instructions.md}

**Note**: All code style, testing, and architectural conventions are defined in the stack-instructions file above. Always follow those guidelines when writing code.

## �️ **Environment-Specific Rules**
{INJECT_ENVIRONMENT_RULES_HERE}

**Configuration**: Environment rules loaded from `capybaraConfig.environment`
- **OS**: {environment.os}
- **Shell**: {environment.shell}  
- **Editor**: {environment.editor}
- **Package Manager**: {environment.packageManager}

## �🔨 **Capybara Methodology**

### **Task Creation Workflows**

#### **New Activity Creation**
When user says: *"vamos desenvolver uma nova atividade"*
1. **Gap Analysis**: Detect missing information in the request
2. **Smart Questionnaire**: Ask only about detected gaps
3. **Auto-Creation**: Generate STEP_XXXX when confident (≥80%)
4. **Error Inheritance**: Apply prevention rules from previous STEPs

#### **STEP Development**  
When user says: *"vamos iniciar o desenvolvimento da STEP_XXXX"*
1. **Read DESCRIPTION.md**: Load STEP objectives and constraints
2. **Apply Prevention Rules**: Follow accumulated "DON'T DO" patterns
3. **Incremental Implementation**: Small changes, test frequently
4. **Document Progress**: Update DONE.md and DIFFICULTIES_FACED.md

### **STEP Structure (Always 4-digit format)**
```
steps/STEP_0001_[TASK_NAME]/
├── STEP_0001_DESCRIPTION.md (objectives, rules, acceptance criteria)
├── STEP_0001_DONE.md (completion tracking)
├── STEP_0001_DIFFICULTIES_FACED.md (lessons for next STEPs)
└── artifacts/ (code, configs, documentation)
```

### **Error Prevention System**
- **Progressive Learning**: Each STEP inherits lessons from previous ones
- **Volume Control**: Max {context.maxRules} rules (configured in capybaraConfig.json)
- **Smart Prioritization**: Task-relevant errors get priority
- **Pattern Recognition**: Group similar issues to reduce noise

### **Atomicity Requirements**  
- **Max Duration**: 3 hours per STEP (configurable)
- **Single Objective**: One clear, measurable goal
- **Minimal Dependencies**: Reduce external blocking factors
- **Testable Criteria**: Concrete validation checkpoints

## 🧪 **Testing Integration**
**Config**: See `tasks.requireUnitTests` in `src/capybaraConfig.json`

When unit tests are required:
- **Framework**: {tasks.testFramework} (from config)
- **Coverage**: {tasks.testCoverage}% minimum (from config)
- **Structure**: Follow stack-instructions.md testing patterns
- **Scope**: Every STEP that adds business logic needs tests

## 🚨 **Core Prevention Patterns**

### **Configuration Management**
- **Always check**: `src/capybaraConfig.json` for project-specific settings
- **Stack-specific rules**: Apply patterns from stack-instructions.md
- **Version pinning**: Use exact versions, not ranges
- **Feature flags**: Include required features for dependencies

### **Development Workflow**
- **Read prevention rules**: Check latest STEP_XXXX_DIFFICULTIES_FACED.md
- **Test incrementally**: Validate after each small change
- **Document blockers**: Record new issues with prevention rules
- **Update accumulated rules**: At STEP completion, pass lessons forward

### **Cross-Platform Compatibility**
- **Environment awareness**: Detect Windows vs Unix patterns
- **Tool suffixes**: Include .exe, .cmd when needed
- **Path handling**: Use proper separators for the environment

## 📋 **Pre-Flight Checklist**
Before starting ANY task:
- [ ] Is task atomic (≤3 hours)?
- [ ] Have I read accumulated prevention rules?
- [ ] Are dependencies compatible with stack?
- [ ] Do I understand acceptance criteria?
- [ ] Is environment properly configured?
- [ ] Are tests required for this STEP?

## 🔄 **Command Patterns**

### **Gap Analysis Mode**
```
User: "vamos desenvolver uma nova atividade"
→ Analyze request for information gaps
→ Ask targeted questions only for missing pieces  
→ Auto-create STEP when confidence ≥80%
```

### **Development Mode**
```  
User: "vamos iniciar o desenvolvimento da STEP_0042"
→ Load STEP_0042_DESCRIPTION.md
→ Apply inherited prevention rules
→ Execute incremental development workflow
```

### **Configuration Mode**
```
User: "atualizar configuração de stack"
→ Show current stack configuration
→ Update stack-instructions.md and capybaraConfig.json
→ Regenerate relevant sections
```

## 📚 **Reference Files**
- **Methodology**: `resources/instructions/capybara-methodology.md`
- **Patterns**: `resources/instructions/capybara-patterns.md`  
- **Templates**: `resources/instructions/capybara-templates.md`
- **Questionnaire**: `resources/instructions/capybara-questionnaire.md`
- **Stack Setup**: `resources/instructions/capybara-stack-setup.md`
- **Configuration**: `src/models/capybaraConfig.ts`

## 🎯 **Success Metrics**
- **Reduced Debugging Time**: Prevention rules eliminate recurring issues
- **Consistent Progress**: Atomic STEPs prevent overwhelming complexity
- **Knowledge Retention**: Lessons accumulate automatically across STEPs
- **Stack Adherence**: Code follows project-specific conventions consistently

---

**Remember**: Capybara is about building momentum through small, validated steps while automatically learning from mistakes. Always prioritize atomicity and incremental progress over trying to solve everything at once.
