# 🚀 Guia Rápido: Publicar CAPPY para VS Code e Cursor

## ⚡ Resposta Rápida

**O Cursor não tem marketplace próprio!** Ele usa o **Visual Studio Code Marketplace**.

```
📦 Você publica AQUI → VS Code Marketplace
                        ↓
                        ├─→ ✅ VS Code (automaticamente)
                        └─→ ✅ Cursor (automaticamente)
```

## 🎯 Uma Publicação = Dois Editores

Publicando no VS Code Marketplace, sua extensão fica disponível para:
- ✅ **VS Code** - via marketplace nativo
- ✅ **Cursor** - via marketplace do VS Code (que o Cursor usa)

## 📝 Como Publicar (Passo a Passo)

### 1️⃣ Obter Personal Access Token

```
1. Acesse: https://dev.azure.com
2. Login com conta Microsoft
3. User Settings > Personal Access Tokens
4. New Token:
   - Name: "VSCE Token"
   - Organization: "All accessible organizations"
   - Scopes: Marketplace > Manage
5. Copie o token (não será mostrado novamente!)
```

### 2️⃣ Fazer Login no VSCE

```powershell
npx vsce login eduardocecon
# Cole o Personal Access Token quando solicitado
```

### 3️⃣ Publicar

```powershell
# Opção 1: Usar o script configurado
npm run publish

# Opção 2: Comando direto
npx vsce publish
```

### 4️⃣ Aguardar

```
⏱️ Alguns minutos...
✅ Publicado!
```

### 5️⃣ Verificar

```
VS Code Marketplace:
https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy

Agora disponível para:
- VS Code: Extensions > Search "Cappy"
- Cursor: Extensions > Search "Cappy"
```

## 🔄 Atualizações Futuras

```powershell
# Incrementar versão patch (2.9.9 → 2.9.10)
npx vsce publish patch

# Incrementar versão minor (2.9.9 → 2.10.0)
npx vsce publish minor

# Incrementar versão major (2.9.9 → 3.0.0)
npx vsce publish major
```

## 📦 Alternativa: Distribuição Manual

Se preferir **não publicar** no marketplace (ou enquanto testa):

### Compartilhar o arquivo VSIX

```
Arquivo: cappy-2.9.9.vsix (já criado!)

Distribuir via:
- GitHub Releases
- Google Drive / Dropbox
- Email
- Site próprio
```

### Instalação pelos Usuários

**VS Code:**
```powershell
code --install-extension cappy-2.9.9.vsix
```

**Cursor:**
```powershell
cursor --install-extension cappy-2.9.9.vsix
```

Ou via UI: `Ctrl+Shift+P` → `Extensions: Install from VSIX...`

## 📊 Comparação de Métodos

| Método | Pros | Cons |
|--------|------|------|
| **Marketplace** | ✅ Distribuição automática<br>✅ Atualizações automáticas<br>✅ Descoberta fácil<br>✅ Estatísticas | ⚠️ Requer conta Azure<br>⚠️ Processo de aprovação |
| **VSIX Manual** | ✅ Controle total<br>✅ Sem necessidade de conta<br>✅ Imediato | ⚠️ Sem atualizações automáticas<br>⚠️ Distribuição manual |

## ✅ Checklist Pré-Publicação

Antes de executar `npm run publish`:

- [x] Código compilado (`npm run compile`) ✅
- [x] Versão 2.9.9 no `package.json` ✅
- [x] `CHANGELOG.md` atualizado ✅
- [x] `README.md` atualizado ✅
- [x] VSIX gerado (`cappy-2.9.9.vsix`) ✅
- [ ] Personal Access Token obtido
- [ ] Login feito (`npx vsce login eduardocecon`)
- [ ] Pronto para publicar!

## 🎬 Comandos Completos

```powershell
# 1. Login (uma vez)
npx vsce login eduardocecon

# 2. Publicar versão atual
npm run publish

# 3. (Opcional) Criar release no GitHub
gh release create v2.9.9 `
  --title "CAPPY v2.9.9 - Cursor Support" `
  --notes "Suporte completo ao Cursor" `
  cappy-2.9.9.vsix
```

## 🌐 URLs Importantes

- **Azure DevOps** (criar token): https://dev.azure.com
- **Marketplace Dashboard**: https://marketplace.visualstudio.com/manage/publishers/eduardocecon
- **Sua Extensão**: https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy
- **GitHub Repo**: https://github.com/cecon/cappy

## 💡 Dica Pro

Depois de publicar no marketplace, os usuários poderão instalar assim:

**VS Code:**
```
1. Abrir VS Code
2. Ctrl+Shift+X (Extensions)
3. Buscar "Cappy"
4. Install
```

**Cursor:**
```
1. Abrir Cursor
2. Ctrl+Shift+X (Extensions)
3. Buscar "Cappy"
4. Install
```

**É a mesma extensão!** 🎉

## 📚 Documentação Detalhada

Para mais detalhes, consulte: [docs/publishing-guide.md](docs/publishing-guide.md)

---

**Resumo**: Publique no VS Code Marketplace → Funciona automaticamente em ambos! 🦫🚀



