# Architecture Documentation Skill

Este skill gera automaticamente um documento markdown que descreve a arquitetura do projeto **Cappy**.

## Como usar
```bash
# Na raiz do projeto
node .agents/skills/architecture-doc/scripts/generate-doc.js
```
Após a execução, um arquivo `ARCHITECTURE.md` será criado na raiz contendo:
- Estrutura de diretórios principais.
- Breve descrição de cada módulo (baseada nos nomes dos diretórios).
- Lista de comandos disponíveis.

## Estrutura do skill
- `scripts/generate-doc.js` – script Node que varre o código‑fonte e produz a documentação.
- `SKILL.md` – este arquivo de referência.
