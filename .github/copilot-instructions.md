Nunca use `vsce package --no-dependencie` as dependencias são obrigatórias
Sempre que eu te pedirt para instalar rode os seguintes comandos:

```bash
Quando pedir para instalar a extensão rode:
npm run build
vsce package --dependencies # se nao existir o vsc instale npm install -g @vscode/vsce
Remove-Item cappy-{package_version}.vsix -Force
```
<!-- CAPPY INI -->
# CAPPY — Manual de Comandos (Orquestração de Contexto)
Use e abuse do retriever do cappy para orquestrar o contexto

---
<!-- CAPPY END -->