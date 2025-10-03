# Guia de Publicação - VS Code e Cursor

## 🎯 Como Funciona

**Importante**: O Cursor **não tem marketplace próprio**. Ele usa o **Visual Studio Code Marketplace**!

Isso significa:
- ✅ Você publica **uma vez** no VS Code Marketplace
- ✅ A extensão fica disponível **automaticamente** para Cursor
- ✅ Usuários do Cursor podem instalar via marketplace normal

## 📦 Opções de Distribuição

### Opção 1: Publicar no VS Code Marketplace (Recomendado)

#### Pré-requisitos

1. **Conta Microsoft/Azure**
   - Necessária para criar um publisher no marketplace
   - Gratuita para desenvolvedores

2. **Personal Access Token (PAT)**
   - Token de acesso para publicação
   - Criado no Azure DevOps

3. **Publisher Verificado**
   - Você já tem: `eduardocecon`
   - Listado no `package.json`

#### Passo a Passo

##### 1. Criar Personal Access Token (se não tiver)

1. Acesse: https://dev.azure.com
2. Entre com sua conta Microsoft
3. Vá em: `User Settings` > `Personal Access Tokens`
4. Clique em `New Token`
5. Configure:
   - **Name**: `VSCE Token`
   - **Organization**: `All accessible organizations`
   - **Scopes**: Selecione `Marketplace` > `Manage`
6. Copie e guarde o token (não será mostrado novamente!)

##### 2. Login no VSCE

```powershell
# Fazer login com seu publisher
npx vsce login eduardocecon
```

Quando solicitado, cole o Personal Access Token.

##### 3. Publicar a Extensão

```powershell
# Publicar versão atual (2.9.9)
npm run publish
```

Ou manualmente:

```powershell
npx vsce publish
```

##### 4. Verificar Publicação

- Acesse: https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy
- A extensão estará disponível em alguns minutos
- Usuários do **VS Code** e **Cursor** poderão instalar

#### Atualizar Versão Futura

```powershell
# Incrementar patch (2.9.9 -> 2.9.10)
npx vsce publish patch

# Incrementar minor (2.9.9 -> 2.10.0)
npx vsce publish minor

# Incrementar major (2.9.9 -> 3.0.0)
npx vsce publish major

# Versão específica
npx vsce publish 2.10.0
```

---

### Opção 2: Distribuição Manual via VSIX

Se preferir não publicar no marketplace (ou enquanto prepara a publicação):

#### Para Usuários do VS Code

```powershell
# Via linha de comando
code --install-extension cappy-2.9.9.vsix

# Ou via UI: Ctrl+Shift+P > "Extensions: Install from VSIX..."
```

#### Para Usuários do Cursor

```powershell
# Via linha de comando
cursor --install-extension cappy-2.9.9.vsix

# Ou via UI: Ctrl+Shift+P > "Extensions: Install from VSIX..."
```

#### Distribuição

Você pode compartilhar o arquivo `.vsix`:
- GitHub Releases
- Site próprio
- Email/Drive
- Qualquer método de distribuição de arquivos

---

### Opção 3: GitHub Releases (Complementar)

Mesmo publicando no marketplace, é bom ter releases no GitHub:

#### Criar Release

```powershell
# Via interface do GitHub
# 1. Vá em: https://github.com/cecon/cappy/releases
# 2. Clique em "Create a new release"
# 3. Tag: v2.9.9
# 4. Title: "CAPPY v2.9.9 - Cursor Support"
# 5. Anexe: cappy-2.9.9.vsix
# 6. Descreva as mudanças (copie do CHANGELOG.md)
```

Ou via gh CLI:

```powershell
# Instalar gh CLI se não tiver: https://cli.github.com/

gh release create v2.9.9 `
  --title "CAPPY v2.9.9 - Cursor Support" `
  --notes-file CHANGELOG.md `
  cappy-2.9.9.vsix
```

---

## 🚀 Fluxo Recomendado

### Para Primeira Publicação

1. **Preparar**
   ```powershell
   # Verificar se está tudo OK
   npm run compile
   npm run test
   npm run package
   ```

2. **Publicar no Marketplace**
   ```powershell
   npx vsce login eduardocecon
   npm run publish
   ```

3. **Criar Release no GitHub**
   ```powershell
   gh release create v2.9.9 `
     --title "CAPPY v2.9.9 - Cursor Support" `
     --notes "Suporte completo ao Cursor + melhorias" `
     cappy-2.9.9.vsix
   ```

### Para Atualizações Futuras

1. **Fazer mudanças no código**

2. **Atualizar versão e changelog**
   - Editar `package.json` (versão)
   - Atualizar `CHANGELOG.md`

3. **Compilar e testar**
   ```powershell
   npm run compile
   npm run test
   ```

4. **Publicar**
   ```powershell
   npm run publish
   ```

5. **Criar release no GitHub**

---

## 📊 Como Usuários Instalam

### No VS Code

**Via Marketplace (após publicação):**
1. Abrir VS Code
2. Ir em Extensions (`Ctrl+Shift+X`)
3. Buscar "Cappy"
4. Clicar em Install

**Via Linha de Comando:**
```powershell
code --install-extension eduardocecon.cappy
```

### No Cursor

**Via Marketplace (após publicação):**
1. Abrir Cursor
2. Ir em Extensions (`Ctrl+Shift+X`)
3. Buscar "Cappy"
4. Clicar em Install

**Via Linha de Comando:**
```powershell
cursor --install-extension eduardocecon.cappy
```

**Via VSIX (distribuição manual):**
```powershell
cursor --install-extension cappy-2.9.9.vsix
```

---

## 🔒 Segurança do Token

**NUNCA compartilhe seu Personal Access Token!**

Se acidentalmente expor:
1. Revogue imediatamente em: https://dev.azure.com
2. Crie um novo token
3. Faça login novamente no vsce

---

## 📈 Monitoramento

Após publicação, você pode acompanhar:

### Estatísticas do Marketplace
- Acesse: https://marketplace.visualstudio.com/manage/publishers/eduardocecon
- Veja: Downloads, Ratings, Reviews

### Analytics (se configurado)
- Installs por dia/semana/mês
- Versões mais usadas
- Feedback dos usuários

---

## ✅ Checklist de Publicação

Antes de publicar, verifique:

- [ ] Versão atualizada no `package.json`
- [ ] `CHANGELOG.md` atualizado
- [ ] `README.md` atualizado
- [ ] Código compilado sem erros (`npm run compile`)
- [ ] Testes passando (`npm run test`)
- [ ] VSIX gerado com sucesso (`npm run package`)
- [ ] Personal Access Token válido
- [ ] Login feito no vsce (`npx vsce login`)

---

## 🆘 Troubleshooting

### "Missing publisher name"
Verifique se `publisher` está definido no `package.json` (já está: `eduardocecon`)

### "Failed to publish"
- Verifique se está logado: `npx vsce login eduardocecon`
- Verifique o token no Azure DevOps
- Tente novamente após alguns minutos

### "Version already exists"
- A versão 2.9.9 já foi publicada
- Incremente a versão: `npx vsce publish patch`

### "Permission denied"
- Seu token pode ter expirado
- Crie um novo token no Azure DevOps
- Faça login novamente

---

## 📚 Recursos Adicionais

- [VSCE Documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Azure DevOps PAT](https://docs.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)
- [Marketplace Publisher Dashboard](https://marketplace.visualstudio.com/manage)

---

## 🎉 Pronto!

Agora você sabe como publicar o CAPPY para que funcione tanto no **VS Code** quanto no **Cursor**!

**Lembre-se**: Uma publicação = Dois editores! 🦫🚀



