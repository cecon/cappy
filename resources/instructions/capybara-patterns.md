# Capybara - Padrões Comuns de Decomposição

## 🔧 **Patterns de Decomposição por Área**

### **Authentication System**
```
Task 1: Setup & Configuration (1-2h)
├── Configure authentication provider
├── Install dependencies
└── Setup environment variables

Task 2: Core Authentication (2-3h)  
├── Implement login/logout
├── JWT handling
└── Route protection

Task 3: User Management (2-3h)
├── Registration flow
├── Password reset
└── User profile

Task 4: Integration & Testing (1-2h)
├── Integration tests
├── Error handling
└── UI feedback
```

### **Dashboard/Admin Panel**
```
Task 1: Layout & Navigation (2-3h)
├── Basic layout structure
├── Navigation components
└── Responsive design

Task 2: Data Layer (2-3h)
├── API integration setup
├── State management
└── Data fetching patterns

Task 3: Components & Features (2-3h per component)
├── Each major component separately
├── CRUD operations
└── Validation & error handling

Task 4: Polish & Testing (1-2h)
├── Performance optimization
├── Testing suite
└── Documentation
```

### **API Development**
```
Task 1: Project Setup (1-2h)
├── Framework configuration
├── Database setup
└── Basic middleware

Task 2: Data Models (1-2h per model)
├── Schema definition
├── Migrations
└── Model validation

Task 3: Endpoints (1-2h per group)
├── CRUD operations
├── Authentication integration
└── Error handling

Task 4: Documentation & Testing (1-2h)
├── API documentation
├── Integration tests
└── Performance validation
```

## 📋 **Templates de Steps Comuns**

### **Step: Project Setup**
```xml
<step id="step001" order="1" completed="false" required="true">
    <title>Initialize project structure</title>
    <description>Set up basic project configuration and dependencies</description>
    <criteria>
        <criterion>Project directory created</criterion>
        <criterion>Package.json configured</criterion>
        <criterion>Dependencies installed</criterion>
        <criterion>Basic folder structure created</criterion>
    </criteria>
    <files>
        <file type="creation" required="true">package.json</file>
        <file type="creation" required="true">src/index.js</file>
    </files>
</step>
```

### **Step: Component Creation**
```xml
<step id="step002" order="2" completed="false" required="true" depends-on="step001">
    <title>Create [ComponentName] component</title>
    <description>Implement the main component with basic functionality</description>
    <criteria>
        <criterion>Component file created</criterion>
        <criterion>Props interface defined</criterion>
        <criterion>Basic functionality implemented</criterion>
        <criterion>Component exports properly</criterion>
    </criteria>
    <files>
        <file type="creation" required="true">src/components/[ComponentName].jsx</file>
    </files>
</step>
```

### **Step: Styling Implementation**
```xml
<step id="step003" order="3" completed="false" required="true" depends-on="step002">
    <title>Implement component styling</title>
    <description>Add responsive and accessible styling</description>
    <criteria>
        <criterion>CSS/SCSS file created</criterion>
        <criterion>Responsive design implemented</criterion>
        <criterion>Accessibility standards met</criterion>
        <criterion>Visual states defined (hover, focus, error)</criterion>
    </criteria>
    <files>
        <file type="creation" required="true">src/components/[ComponentName].module.css</file>
    </files>
</step>
```

### **Step: Testing (Always Include)**
```xml
<step id="step004" order="4" completed="false" required="true" depends-on="step003">
    <title>Implement comprehensive tests</title>
    <description>Create test suite covering all functionality</description>
    <criteria>
        <criterion>Test file created</criterion>
        <criterion>Component rendering tests</criterion>
        <criterion>User interaction tests</criterion>
        <criterion>Edge case handling tests</criterion>
        <criterion>Test coverage ≥ 80%</criterion>
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
    </validation>
</step>
```

## 🎯 **Guidelines para Decomposição**

### **Sinais de Task Não-Atômica:**
- ❌ Múltiplos verbos na descrição ("implementar E configurar E testar")
- ❌ Estimativa > 3 horas
- ❌ Muitas dependências diferentes
- ❌ Arquivos em múltiplas áreas do projeto

### **Estratégias de Decomposição:**
- **Por Layer**: Frontend → Backend → Database → Integration
- **Por Feature**: Auth → User Management → Admin → Reporting
- **Por Componente**: Header → Sidebar → Main Content → Footer
- **Por Funcionalidade**: CRUD operations separadamente

### **Ordem Recomendada de Steps:**
1. **Setup/Configuration** - Base necessária
2. **Core Implementation** - Funcionalidade principal
3. **Integration** - Conectar com outros sistemas
4. **Styling/UI** - Interface e experiência
5. **Testing** - Validação e qualidade
6. **Documentation** - Registro do conhecimento
