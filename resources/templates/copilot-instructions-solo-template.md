# GitHub Copilot Instructions - FORGE Solo Development

## 🎯 **Core Objective**
Smart task decomposition + automatic error prevention for solo developers.

**Key Principle**: Learn from mistakes once, apply lessons everywhere.

## 🔨 **Essential Workflow**

### **When Starting New Feature/Task:**
1. **Read**: Latest `STEP_XXXX_DIFFICULTIES_FACED.md` for current context
2. **Decompose**: Break down into 2-3 hour chunks if needed  
3. **Document**: Create STEP_XXXX with clear objectives
4. **Prevent**: Apply accumulated "don't do" patterns

### **During Development:**
- **Small iterations**: Test frequently, document blockers immediately
- **Pattern recognition**: Notice recurring issues across STEPs
- **Context preservation**: Keep current work connected to project goals

### **After Completing Work:**
- **Extract lessons**: What went wrong? What patterns emerged?
- **Create prevention rules**: Document specific "don't do" patterns
- **Update context**: Refresh Copilot with new learnings

## 🧠 **Active Prevention Rules**

### **Current Project Patterns** 
{LOAD_ACTIVE_PREVENTION_RULES}

### **Stack-Specific Gotchas**
{LOAD_STACK_PATTERNS}

## 📊 **Project Context**

### **Tech Stack**: {project.language} + {project.framework}
### **Environment**: {environment.os} / {environment.shell}
### **Current Phase**: {project.currentPhase}

**Architecture Overview**: {project.architectureNotes}

## 🎯 **Balance Guidelines**

### **Atomicity vs Macro Vision**
- **Atomic tasks**: 2-3 hours max, single clear objective
- **Macro tracking**: Each STEP references overall project goals
- **Context bridges**: Connect current work to bigger picture
- **Progress indicators**: Track % completion of major features

### **Documentation vs Overhead**
- **Document**: Only real blockers and unexpected patterns
- **Skip**: Obvious or standard implementation details  
- **Focus**: Prevention rules that actually save time
- **Automate**: Context updates when completing STEPs

## 🚀 **Commands for Solo Dev**

### **Quick Task Creation**
```
"preciso implementar [feature]"
→ Auto-decompose into 2-3 STEPs
→ Inherit relevant prevention rules
→ Link to project objectives
```

### **Smart Problem Documentation**
```
"esse erro já aconteceu antes"
→ Extract prevention pattern
→ Add to active rules
→ Update Copilot context
```

### **Context Refresh**
```
"onde estou no projeto?"
→ Show current STEP progress
→ Display active prevention rules
→ Review macro objectives
```

## 📈 **Success Indicators**
- **Fewer repeated mistakes**: Prevention rules working
- **Smoother development flow**: Less debugging time
- **Clear progress tracking**: Know where you are in project
- **Maintained momentum**: Atomic tasks prevent overwhelm

---

**Remember**: FORGE Solo is about sustainable solo development velocity through smart learning and lightweight documentation. Focus on what actually helps you code better, skip the rest.
