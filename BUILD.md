# 🚀 Cappy - Guia de Build e Publicação

## Build Cross-Platform

O Cappy suporta build para múltiplas plataformas a partir de qualquer sistema operacional (Windows, macOS ou Linux).

### Comandos Rápidos

```bash
# Build para a plataforma atual
npm run build:cross

# Build para todas as plataformas
npm run package:all

# Build para plataformas específicas
node scripts/build-cross-platform.js win32-x64 darwin-arm64
```

### Plataformas Suportadas

- **Windows**: `win32-x64`
- **macOS Intel**: `darwin-x64`
- **macOS Apple Silicon**: `darwin-arm64`
- **Linux x64**: `linux-x64`
- **Linux ARM64**: `linux-arm64`

## Processo de Build

### 1. Build Básico (desenvolvimento local)

```bash
# Build e compilação
npm run build
npm run compile-extension

# Package para sua plataforma atual
npm run package:darwin-arm64  # macOS Apple Silicon
npm run package:win32         # Windows
npm run package:linux         # Linux
```

### 2. Build Cross-Platform (para publicação)

```bash
# Build para todas as plataformas de uma vez
npm run package:all
```

Isso irá gerar os seguintes arquivos:
- `cappy-X.X.X-win32-x64.vsix`
- `cappy-X.X.X-darwin-x64.vsix`
- `cappy-X.X.X-darwin-arm64.vsix`
- `cappy-X.X.X-linux-x64.vsix`
- `cappy-X.X.X-linux-arm64.vsix`

### 3. Instalação Local

```bash
# No macOS/Linux
code --install-extension cappy-X.X.X-darwin-arm64.vsix --force

# No Windows
code --install-extension cappy-X.X.X-win32-x64.vsix --force
```

## Publicação no Marketplace

### Publicar Todas as Plataformas

```bash
# 1. Build todas as plataformas
npm run package:all

# 2. Publicar todas
npm run publish:all
```

### Publicar Plataforma Específica

```bash
# Apenas Windows
npm run publish:win32

# Apenas macOS (ambas as arquiteturas)
npm run publish:darwin

# Apenas Linux
npm run publish:linux
```

### Publicação Manual

```bash
# Login no marketplace (uma vez)
vsce login eduardocecon

# Publicar pacotes específicos
vsce publish --packagePath cappy-*.vsix
```

## Troubleshooting

### Erro de Native Modules

Se você encontrar erros relacionados a `sqlite3` ou `sharp`:

```bash
# Limpar e reinstalar
rm -rf node_modules
npm install

# Rebuild para sua plataforma
npm run build
npm run compile-extension
```

### Build Falhou para Plataforma Específica

O script continua mesmo se uma plataforma falhar. Verifique os logs e tente rebuildar apenas aquela plataforma:

```bash
node scripts/build-cross-platform.js darwin-arm64
```

### Verificar Pacotes Gerados

```bash
# Listar todos os VSIX
ls -lh *.vsix

# Verificar conteúdo
unzip -l cappy-X.X.X-darwin-arm64.vsix | grep -E "(sqlite3|sharp)"
```

## Estrutura de Dependências Nativas

### sqlite3
- **Windows**: `node_modules/sqlite3/build/Release/node_sqlite3.node`
- **macOS**: `node_modules/sqlite3/build/Release/node_sqlite3.node`
- **Linux**: `node_modules/sqlite3/build/Release/node_sqlite3.node`

### sharp
- **Windows**: `node_modules/@img/sharp-win32-x64/`
- **macOS Intel**: `node_modules/@img/sharp-darwin-x64/`
- **macOS ARM**: `node_modules/@img/sharp-darwin-arm64/`
- **Linux**: `node_modules/@img/sharp-linux-x64/`

## CI/CD (GitHub Actions)

Para automatizar o build em CI:

```yaml
name: Build and Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build all platforms
        run: npm run package:all
      
      - name: Publish to marketplace
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
        run: npm run publish:all
```

## Versioning

Atualizar versão antes de publicar:

```bash
# Patch (3.0.8 -> 3.0.9)
npm version patch

# Minor (3.0.9 -> 3.1.0)
npm version minor

# Major (3.1.0 -> 4.0.0)
npm version major
```

## Checklist de Publicação

- [ ] Atualizar CHANGELOG.md
- [ ] Atualizar version no package.json
- [ ] Testar extensão localmente
- [ ] Build para todas as plataformas: `npm run package:all`
- [ ] Verificar tamanho dos pacotes (< 200MB cada)
- [ ] Publicar: `npm run publish:all`
- [ ] Criar release no GitHub
- [ ] Testar instalação do marketplace

## Recursos

- [VS Code Extension API](https://code.visualstudio.com/api)
- [vsce CLI](https://github.com/microsoft/vscode-vsce)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## Solução para Dependências Nativas (sqlite3)

### O Problema

O `sqlite3` é um módulo nativo que precisa ser compilado especificamente para cada plataforma (Windows, macOS, Linux) e arquitetura (x64, arm64). Ao fazer build cross-platform, o binário do sqlite3 é sempre compilado para a plataforma onde você está rodando o build, não para a plataforma alvo.

### A Solução Implementada

Implementamos um sistema de **fallback inteligente** que:

1. **Tenta carregar `@vscode/sqlite3` primeiro**
   - Versão otimizada e pré-compilada pelo VS Code
   - Mais confiável para extensões do VS Code
   - Funciona out-of-the-box em qualquer plataforma

2. **Fallback para `sqlite3` padrão**
   - Usado apenas se `@vscode/sqlite3` não estiver disponível
   - Requer que o binário correto esteja instalado

### Arquitetura

```
src/nivel2/infrastructure/database/
├── sqlite3-loader.ts       # Smart loader com fallback
└── sqlite-adapter.ts       # Usa o loader ao invés de import direto
```

#### sqlite3-loader.ts
```typescript
function loadSQLite3() {
  try {
    return require('@vscode/sqlite3');  // Preferido
  } catch {
    return require('sqlite3');           // Fallback
  }
}
```

### Por Que Isso Funciona?

1. **`@vscode/sqlite3` é universal**
   - O VS Code já gerencia os binários corretos
   - Funciona em qualquer plataforma sem rebuild

2. **O vsce package inclui ambos**
   - `@vscode/sqlite3` como dependência opcional
   - `sqlite3` como dependência principal
   - O VS Code escolhe automaticamente o correto

3. **Sem necessidade de rebuild**
   - Não precisa compilar nativamente para cada plataforma
   - Basta empacotar com `--dependencies`

### Benefícios

✅ **Build de qualquer plataforma** - Windows pode buildar para macOS e vice-versa
✅ **Sem erros de arquitetura** - Funciona em Intel e Apple Silicon
✅ **Compatível com VS Code** - Usa a versão otimizada quando disponível
✅ **Fallback seguro** - Sempre tem um sqlite3 funcionando

### Testando Localmente

```bash
# Verificar qual sqlite3 está sendo usado
# Ao iniciar a extensão, veja no console do VS Code:
# ✅ Using @vscode/sqlite3 (VS Code bundled version)
# ou
# ✅ Using sqlite3 (standard npm package)
```

### Para Desenvolvedores

Se você está desenvolvendo e encontrar erros de sqlite3:

```bash
# Reinstalar ambas as versões
npm install sqlite3@^5.1.7
npm install @vscode/sqlite3@^5.1.8-vscode --save-optional

# Rebuild (se necessário)
npm run compile-extension
```

### Limitações Conhecidas

- O build ainda inclui TODOS os binários do sqlite3 padrão
- Isso aumenta o tamanho do pacote (~15-20MB)
- **Solução futura**: Excluir sqlite3 padrão e usar apenas @vscode/sqlite3

