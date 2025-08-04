# LLM Instructions: XML Task Generation for Capybara Methodology

## Overview

You are responsible for creating XML task structures that follow the Capybara methodology. These XML files define atomic, step-by-step instructions for development tasks that can be completed in 1-3 hours with measurable outcomes.

## Your Role - CRITICAL REQUIREMENTS

When a user expresses a development need, you must:

1. **FIRST**: Check for active tasks in `.capy/tasks/` directory
2. **ATOMICITY ANALYSIS**: Ensure task can be completed in 1-3 hours  
3. **BREAK DOWN**: Decompose non-atomic tasks into smaller units
4. **GENERATE**: Create structured XML following exact specifications
5. **VALIDATE**: Ensure all criteria are measurable and testable

## File Naming Convention

### **Task File Names: `STEP_[UNIX_TIMESTAMP]_[title].xml`**

Task files should be named using Unix timestamps for chronological ordering:

```
Examples:
STEP_1722873600_setup-supabase-auth.xml
STEP_1722874200_create-login-form.xml
STEP_1722874800_implement-dashboard.xml
```

**Benefits:**
- **Chronological ordering**: Files automatically sort by creation time
- **Unique names**: No conflicts between different tasks
- **Descriptive**: Title immediately shows what the task does
- **Compact**: Unix timestamp is shorter than full date strings

### **Internal Step IDs: Simple Sequential**

Within each task XML, use simple sequential step IDs:

```xml
<step id="step001" order="1" completed="false" required="true">
<step id="step002" order="2" completed="false" required="true" depends-on="step001">
<step id="step003" order="3" completed="false" required="true" depends-on="step002">
```

**Why this approach:**
- **File level**: Unix timestamps ensure global chronological order
- **Step level**: Simple sequences make internal navigation easy
- **Best of both**: Global ordering + local simplicity

## Pre-Generation Checklist

### **Step 1: Active Task Check**
- Look for XML files in `.capy/tasks/` with status="em-andamento" or status="pausada"
- If found, ask: "⚠️ Existe uma tarefa ativa: [TASK_TITLE]. Deseja pausar esta tarefa para iniciar uma nova?"
- Only proceed with user confirmation

### **Step 2: Atomicity Analysis** 
- **ATOMIC**: Single objective, 1-3 hours, clear deliverable
- **NON-ATOMIC**: Multiple objectives, >3 hours, complex scope

```
✅ ATOMIC EXAMPLES:
- "Setup Supabase client configuration"  
- "Create user registration form component"
- "Implement JWT token validation middleware"

❌ NON-ATOMIC (decompose first):
- "Implement complete authentication system"
- "Build admin dashboard" 
- "Setup entire backend API"
```

### **Step 3: Task Decomposition (if needed)**
If task is non-atomic, break it down using these patterns:
- **Authentication**: config → middleware → endpoints → integration → testing
- **Frontend**: layout → components → styling → state → integration  
- **Backend**: schema → validation → endpoints → testing
- **Database**: schema → migrations → repositories → testing

## XML Structure Requirements

### Basic Template - STRICT FORMAT

Every XML task must follow this exact structure:

```xml
<task id="[unique-kebab-case-id]" version="1.0">
    <metadata>
        <title>[Clear, actionable title]</title>
        <description>[Detailed description focusing on the specific outcome]</description>
        <status>em-andamento</status>
        <progress>0/[total-steps]</progress>
    </metadata>
    
    <context>
        <area>[frontend/backend/mobile/devops/fullstack]</area>
        <technology main="[main-tech]" version="[min-version]"/>
        <dependencies>
            <lib>[library-name]</lib>
            <!-- Add ALL dependencies needed -->
        </dependencies>
        <files>
            <file type="creation" required="true">[absolute-file-path]</file>
            <file type="modification" required="false">[absolute-file-path]</file>
            <!-- List EVERY file that will be touched -->
        </files>
    </context>
    
    <steps>
        <!-- 3-7 atomic steps maximum with simple sequential IDs -->
    </steps>
    
    <validation>
        <checklist>
            <item>All required steps completed</item>
            <item>All required files created</item>
            <item>Code compiles without errors</item>
            <item>No linting warnings</item>
            <item>[Add specific validation criteria]</item>
        </checklist>
    </validation>
</task>
```

### Key Requirements:
- **Task File Name**: `STEP_[UNIX_TIMESTAMP]_[KEBAB-CASE-TITLE].xml`  
  Example: `STEP_1722873600_setup-supabase-auth.xml`
- **Internal Steps**: Simple sequential IDs (`step001`, `step002`, etc.)
- **ID**: Use kebab-case, descriptive, unique (e.g., "setup-supabase-auth", "create-login-form")  
- **Status**: Always start with "em-andamento" for new tasks
- **Area**: Choose ONE primary area where most work will happen
- **Dependencies**: Include ALL libraries, not just the main ones
- **Files**: List EVERY file that will be created or modified with full paths
            <item>All required files created</item>
            <item>Code compiles without errors</item>
            <item>No linting warnings</item>
            <!-- Add specific validation items -->
        </checklist>
    </validation>
</task>
```

## Step Creation Guidelines - SIMPLE SEQUENTIAL FORMAT

### Step Structure with Simple Sequential IDs

Each step must follow this exact pattern with simple sequential IDs:

```xml
<step id="step[XXX]" order="[N]" completed="false" required="[true/false]" depends-on="[previous-step-id]">
    <title>[What will be accomplished]</title>
    <description>[Detailed explanation of the work to be done]</description>
    <criteria>
        <criterion>[Specific, measurable requirement]</criterion>
        <criterion>[Another specific requirement]</criterion>
        <!-- List ALL criteria that must be met -->
    </criteria>
    <files>
        <file type="[creation/modification]" required="[true/false]">[specific-file-path]</file>
    </files>
    <!-- Optional sections -->
    <dependencies>
        <lib>[step-specific-library]</lib>
    </dependencies>
    <validation>
        <command>[test-command]</command>
        <metric>[specific-metric >= target]</metric>
    </validation>
</step>
```

### **STEP ID Format: Simple Sequential**
- **Format**: `step001`, `step002`, `step003`, etc.
- **Internal to task**: Steps are numbered sequentially within each task file
- **Benefits**: 
  - Simple and readable
  - Easy to reference within the task
  - No complexity for internal steps
  - Clear dependency chain

### **Task File Naming with Unix Timestamp:**
- **Format**: `STEP_[UNIX_TIMESTAMP]_[KEBAB-CASE-TITLE].xml`
- **Timestamp**: Unix timestamp when task is created
- **Example**: `STEP_1722873600_setup-supabase-auth.xml`
- **Benefits**: 
  - Automatic chronological ordering of tasks
  - Unique task file names guaranteed 
  - Clear task identification
  - Easy to sort by creation time

### **LLM CRITICAL INSTRUCTION:**
**Task Files**: Use `STEP_[timestamp]_[title].xml` format for file names
**Internal Steps**: Use simple `step001`, `step002`, `step003` format for step IDs
- Generate Unix timestamp for task file name only
- Use sequential numbering for internal steps
- This provides chronological ordering at task level with simplicity at step level

### Step Sequencing Rules

1. **Dependencies**: Each step should logically depend on the previous one using sequential ID
2. **Granularity**: Steps should be neither too broad nor too narrow (1-3 hours max)
3. **Testability**: Each step should have clear, verifiable criteria
4. **File Organization**: Group related file operations in the same step when logical

### Common Step Patterns with Sequential IDs

#### 1. Project Setup

```xml
<step id="step001" order="1" completed="false" required="true">
    <title>Initialize project structure</title>
    <description>Set up the basic project structure and configuration files</description>
    <criteria>
        <criterion>Project directory created</criterion>
        <criterion>Package.json configured</criterion>
        <criterion>Basic folder structure established</criterion>
    </criteria>
</step>
```

#### 2. Component Creation

```xml
<step id="step002" order="2" completed="false" required="true" depends-on="step001">
    <title>Create main component</title>
    <description>Implement the core component with basic structure</description>
    <criteria>
        <criterion>Component file created</criterion>
        <criterion>Basic props defined</criterion>
        <criterion>Component exports properly</criterion>
    </criteria>
    <files>
        <file type="creation" required="true">src/components/[ComponentName].jsx</file>
    </files>
</step>
```

#### 3. Styling

```xml
<step id="step003" order="3" completed="false" required="true" depends-on="step002">
    <title>Implement component styling</title>
    <description>Add CSS/styling for responsive and accessible design</description>
    <criteria>
        <criterion>Responsive design implemented</criterion>
        <criterion>Accessibility standards met</criterion>
        <criterion>Visual states defined (hover, focus, error)</criterion>
    </criteria>
    <files>
        <file type="creation" required="true">src/components/[ComponentName].module.css</file>
    </files>
</step>
```

#### 4. Testing (Always Include)

```xml
<step id="step004" order="4" completed="false" required="true" depends-on="step003">
    <title>Implement unit tests</title>
    <description>Create comprehensive test suite for the component</description>
    <criteria>
        <criterion>Component rendering tests</criterion>
        <criterion>User interaction tests</criterion>
        <criterion>Edge case handling tests</criterion>
        <criterion>Test coverage > 80%</criterion>
    </criteria>
    <files>
        <file type="creation" required="true">src/components/[ComponentName].test.js</file>
    </files>
    <dependencies>
        <lib>@testing-library/react</lib>
        <lib>@testing-library/jest-dom</lib>
    </dependencies>
    <validation>
        <command>npm test -- --coverage</command>
        <metric>coverage >= 80%</metric>
        <metric>zero warnings</metric>
    </validation>
</step>
```

## Context Analysis

### Determine Area

- **frontend**: React, Vue, Angular, vanilla JS
- **backend**: Node.js, Python, Java, APIs
- **mobile**: React Native, Flutter
- **devops**: Docker, CI/CD, deployment
- **fullstack**: Full application with multiple areas

### Identify Technology Stack

Always specify:

- Main technology and minimum version
- All required dependencies
- Testing frameworks
- Build tools

### File Prediction

List ALL files that will be created or modified:

- Component files
- Style files
- Test files
- Configuration files
- Documentation files

## Quality Requirements

### Always Include

1. **Error handling** considerations
1. **Testing requirements** with specific coverage targets
1. **Code quality** checks (linting, formatting)
1. **Documentation** requirements
1. **Accessibility** considerations for frontend work
1. **Performance** considerations where relevant

### Validation Checklist Items

Always include these baseline items:

- All required steps completed
- All required files created
- Code compiles/builds without errors
- No linting warnings
- Tests pass with adequate coverage

Add specific items based on the technology:

- **Frontend**: Responsive design, accessibility compliance
- **Backend**: API documentation, error handling
- **Database**: Migrations run successfully, indexes created
- **Mobile**: Platform-specific builds successful

## Example Analysis Process

### Input: “Create a user login form in React”

1. **Analyze**: Need form with validation, styling, and authentication logic
1. **Break down**:
- Project setup
- Form component creation
- Validation logic
- Styling
- Authentication integration
- Testing
- Documentation
1. **Generate XML** with:
- 6-8 steps
- React + react-hook-form + yup dependencies
- Files: LoginForm.jsx, LoginForm.module.css, LoginForm.test.js, authUtils.js
- Proper step dependencies
- Validation criteria for each step

## Common Mistakes to Avoid

1. **Too few steps**: Don’t combine unrelated work
1. **Missing dependencies**: Always specify all required libraries
1. **Vague criteria**: Criteria must be specific and testable
1. **Missing files**: List every file that will be touched
1. **No testing**: Always include testing steps
1. **Ignoring accessibility**: Frontend work must consider a11y
1. **Missing error handling**: Always consider edge cases

## Output Requirements

Your XML output must:

- Be valid XML syntax
- Follow the exact structure defined above
- Include ALL required elements
- Have logical step dependencies
- Contain specific, measurable criteria
- List all files that will be created/modified
- Include appropriate testing requirements
- Have a comprehensive validation checklist

## Response Format

Always respond with:

1. Brief analysis of the request
1. The complete XML task structure
1. Any assumptions or clarifications made

Example:

```
## Analysis
Creating a React customer registration form requires form handling, validation, styling, and testing. This will be a frontend-focused task with 7 sequential steps.

## XML Task Structure
[Complete XML here]

## Assumptions
- Using React 18+
- Implementing with react-hook-form for performance
- Including comprehensive validation with Yup
- Responsive design required
- 80% test coverage target
```