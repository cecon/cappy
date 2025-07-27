# Environment-Specific Rules Templates

## Windows PowerShell Template
```markdown
## 🖥️ **Environment Rules - Windows PowerShell + VS Code**

### **Shell Command Syntax**
- ✅ **DO**: Use semicolon to chain commands
  ```powershell
  npm install; npm run build; npm start
  ```
- ❌ **DON'T**: Use && (bash syntax won't work)
  ```bash
  npm install && npm run build  # ❌ PowerShell error
  ```

### **Environment Variables**
- ✅ **DO**: PowerShell environment syntax
  ```powershell
  $env:NODE_ENV = "development"
  $env:PORT = "3000"
  ```
- ❌ **DON'T**: Use bash export syntax
  ```bash
  export NODE_ENV=development  # ❌ PowerShell doesn't understand
  ```

### **Path Handling**
- ✅ **DO**: Use backslashes in PowerShell commands
  ```powershell
  cd .\\src\\components
  copy .\\dist\\* .\\build\\
  ```
- ✅ **DO**: Use forward slashes in config files (universal)
  ```json
  {"main": "./src/index.ts"}
  ```

### **Executable Commands**
- ✅ **DO**: Add .cmd suffix when scripting
  ```powershell
  npm.cmd install
  npx.cmd tsc
  yarn.cmd install
  ```
- ✅ **DO**: Plain commands work in package.json scripts
  ```json
  {"scripts": {"build": "tsc"}}
  ```

### **VS Code Integration**
- ✅ **DO**: Use integrated terminal (PowerShell by default)
- ✅ **DO**: Configure .vscode/tasks.json for common commands
- ✅ **DO**: Use PowerShell in terminal scripts
```

## macOS zsh Template  
```markdown
## 🖥️ **Environment Rules - macOS zsh + VS Code**

### **Shell Command Syntax**
- ✅ **DO**: Use && to chain commands
  ```bash
  npm install && npm run build && npm start
  ```

### **Environment Variables**
- ✅ **DO**: Use export syntax
  ```bash
  export NODE_ENV=development
  export PORT=3000
  ```

### **Permission Handling**
- ✅ **DO**: Use chmod for executable scripts
  ```bash
  chmod +x ./scripts/deploy.sh
  ```
- ✅ **DO**: Consider sudo for global packages
  ```bash
  sudo npm install -g typescript
  ```

### **Package Manager**
- ✅ **DO**: Plain commands work fine
  ```bash
  npm install
  npx tsc
  yarn install
  ```
```

## Linux bash Template
```markdown
## 🖥️ **Environment Rules - Linux bash + VS Code**

### **Shell Command Syntax**
- ✅ **DO**: Use && to chain commands
  ```bash
  npm install && npm run build && npm start
  ```

### **Package Installation**
- ✅ **DO**: Consider system package manager vs npm global
  ```bash
  # System package
  sudo apt install nodejs npm
  
  # Global npm
  sudo npm install -g typescript
  ```

### **Docker Integration**
- ✅ **DO**: Use Docker for consistent environments
  ```bash
  docker run -v $(pwd):/app -w /app node:18 npm install
  ```
- ✅ **DO**: Handle file permissions in containers
  ```bash
  docker run --user $(id -u):$(id -g) ...
  ```
```

## Cross-Platform Template
```markdown
## 🌐 **Cross-Platform Environment Rules**

### **Universal Practices**
- ✅ **DO**: Use package.json scripts (work on all platforms)
  ```json
  {
    "scripts": {
      "dev": "nodemon src/index.ts",
      "build": "tsc",
      "test": "jest",
      "docker:build": "docker build -t app ."
    }
  }
  ```

### **Environment Variables**
- ✅ **DO**: Use cross-env for universal environment setting
  ```json
  {
    "scripts": {
      "dev": "cross-env NODE_ENV=development nodemon src/index.ts"
    }
  }
  ```

### **Path Handling**
- ✅ **DO**: Use forward slashes in configs (universal)
- ✅ **DO**: Use Node.js path module for dynamic paths
  ```typescript
  import path from 'path';
  const configPath = path.join(__dirname, 'config', 'app.json');
  ```

### **Task Automation**
- ✅ **DO**: Use npm scripts as the primary interface
- ✅ **DO**: Create platform-specific scripts when needed
  ```json
  {
    "scripts": {
      "build": "tsc",
      "build:windows": "tsc && copy .\\assets\\* .\\dist\\assets\\",
      "build:unix": "tsc && cp -r ./assets/* ./dist/assets/"
    }
  }
  ```
```
