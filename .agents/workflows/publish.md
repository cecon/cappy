---
description: Compilar, bumpar versão e publicar a extensão Cappy no marketplace
---

# Publish

Compilar, incrementar a versão (patch), empacotar e publicar no VS Code Marketplace.

## Passos

// turbo-all

1. Compilar o TypeScript:
```
cd /Users/eduardomendonca/projetos/cappy && npm run compile-extension
```

2. Bumpar versão (patch), empacotar e publicar:
```
cd /Users/eduardomendonca/projetos/cappy && npm run package
```

3. Publicar no marketplace:
```
cd /Users/eduardomendonca/projetos/cappy && npx vsce publish
```

4. Instalar a nova versão localmente:
```
cd /Users/eduardomendonca/projetos/cappy && code --install-extension $(ls -t cappy-*.vsix | head -1) --force
```

5. Fazer commit da versão:
```
cd /Users/eduardomendonca/projetos/cappy && git add package.json package-lock.json && git commit -m "chore: bump version $(node -p 'require(\"./package.json\").version')"
```
