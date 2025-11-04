# Cross-Platform Native Modules Guide

Este guia resolve o problema de módulos nativos (SQLite3, Sharp) não funcionarem em diferentes plataformas quando compilados em outra arquitetura.

## 🚨 Problema

```
❌ Failed to load sqlite3: Error: \\?\...\node_sqlite3.node is not a valid Win32 application.
```

Este erro ocorre quando:
- Você compila no Mac mas roda no Windows
- Você compila no Windows mas roda no Mac/Linux
- Os módulos nativos (sqlite3, sharp) foram compilados para arquitetura diferente

## ✅ Solução Implementada

### 1. SQLite3 Loader Inteligente

O arquivo `src/nivel2/infrastructure/database/sqlite3-loader.ts` implementa:

- **Fallback automático**: Tenta `@vscode/sqlite3` primeiro, depois `sqlite3`
- **Detecção de arquitetura**: Identifica problemas de compatibilidade
- **Mensagens detalhadas**: Explica exatamente como resolver cada tipo de erro
- **Cache do módulo**: Evita múltiplas tentativas de carregamento

### 2. Scripts de Build Melhorados

#### Setup Automático
```bash
npm run setup:native
```
- Diagnostica build tools
- Limpa módulos nativos corrompidos  
- Rebuilda para a plataforma atual
- Testa se SQLite3 carregou corretamente

#### Build Cross-Platform
```bash
npm run package:all
```
- Builta para todas as plataformas automaticamente
- Backup/restore de módulos nativos
- Rebuild específico para cada target
- Relatório de sucesso/falha

#### Build Específico
```bash
npm run package:win32    # Windows
npm run package:darwin   # macOS (ambas arquiteturas)  
npm run package:linux    # Linux
```

### 3. Processo de Package Melhorado

O script `scripts/package-platform.js` agora:

1. **Rebuilda módulos nativos** para a arquitetura target
2. **Remove binários desnecessários** do Sharp
3. **Gera packages específicos** com `-target` no nome
4. **Valida** se o build foi bem-sucedido

## 🔧 Como Usar

### Para Desenvolvimento Local

```bash
# Se você mudou de plataforma ou teve problemas
npm run setup:native

# Para verificar se está tudo OK
node scripts/setup-native-modules.js
```

### Para Release Cross-Platform

```bash
# Build para todas as plataformas
npm run package:all

# Ou builds específicos
npm run package:win32
npm run package:darwin
npm run package:linux
```

### Para Instalação

```bash
# Windows
code --install-extension cappy-3.1.0-win32-x64.vsix --force

# macOS Intel
code --install-extension cappy-3.1.0-darwin-x64.vsix --force

# macOS Apple Silicon  
code --install-extension cappy-3.1.0-darwin-arm64.vsix --force

# Linux
code --install-extension cappy-3.1.0-linux-x64.vsix --force
```

## 🐛 Troubleshooting

### Erro "not a valid Win32 application"

```bash
# Limpe tudo e rebuilde
rm -rf node_modules package-lock.json
npm install
npm run setup:native
```

### Build Tools Ausentes

**Windows:**
```bash
npm install --global --production windows-build-tools
# Ou instale Visual Studio Build Tools manualmente
```

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt-get install build-essential  # Ubuntu/Debian
sudo yum groupinstall "Development Tools"  # CentOS/RHEL
```

### SQLite3 Não Carrega

1. **VS Code Extensions**: Use `@vscode/sqlite3` (mais confiável)
2. **Fallback**: O loader tenta `sqlite3` automaticamente
3. **Manual**: `npm install @vscode/sqlite3 sqlite3`

### Sharp Problemas

```bash
npm run rebuild:sharp
# Ou
npm rebuild sharp
```

## 📁 Estrutura dos Packages

```
cappy-3.1.0-win32-x64.vsix     # Windows 64-bit
cappy-3.1.0-darwin-x64.vsix    # macOS Intel
cappy-3.1.0-darwin-arm64.vsix  # macOS Apple Silicon
cappy-3.1.0-linux-x64.vsix     # Linux 64-bit
```

Cada package contém apenas os binários necessários para sua plataforma, reduzindo o tamanho e evitando conflitos.

## 🔍 Diagnóstico

Para diagnosticar problemas:

```bash
node scripts/setup-native-modules.js
```

Este script verifica:
- ✅ Build tools instalados
- ✅ node-gyp disponível
- ✅ SQLite3 carregando corretamente
- ✅ Arquitetura compatível

## ⚡ Performance

- **Packages menores**: Apenas binários necessários
- **Carregamento mais rápido**: Fallback inteligente
- **Menos conflitos**: Binários específicos por plataforma
- **Build confiável**: Backup/restore automático de módulos