## Instalação da Extensão

A extensão tem builds específicas por plataforma para incluir apenas os binários do sharp necessários:

**Windows:**
```bash
npm run build
npm run package:win32
code --install-extension cappy-{version}-win32.vsix --force
```

**macOS:**
```bash
npm run build
npm run package:darwin
code --install-extension cappy-{version}-darwin.vsix --force
```

**Linux:**
```bash
npm run build
npm run package:linux
code --install-extension cappy-{version}-linux.vsix --force
```

**Todas as plataformas (para CI/CD):**
```bash
npm run build
npm run package:all
```
<!-- CAPPY INI -->
# CAPPY — Manual de Comandos (Orquestração de Contexto)
Use e abuse do retriever do cappy para orquestrar o contexto

---
<!-- CAPPY END -->