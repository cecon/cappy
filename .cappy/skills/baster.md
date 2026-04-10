---
description: Skill to fetch and format the three latest news from UOL.
---

# Petrobas News Fetch Skill

Esta skill descreve como utilizar o script Python **fetch_uol_news.py** para obter as três últimas notícias do portal UOL e formatá‑las para uso em contexto.

## Como funciona o script

- O script usa a biblioteca padrão `urllib.request` e `xml.etree.ElementTree` para ler o feed RSS do UOL (`https://feeds.uol.com.br/rss/uol/noticias.xml`).
- Ele extrai os três itens mais recentes, retornando um dicionário com os campos:
  - `title` – título da notícia
  - `link` – URL completa da notícia
  - `pubDate` – data de publicação
  - `description` – breve descrição (texto puro, sem tags HTML)
- A função principal `get_latest_uol_news()` devolve uma lista de dicionários.

## Como chamar a skill

1. **Certifique‑se que o script está no caminho** `.cappy/skills/scripts/uol-news-fetch/fetch_uol_news.py`.
2. No seu código Python ou na skill que precisar das notícias, faça:
   ```python
   from scripts.fetch_uol_news import get_latest_uol_news

   noticias = get_latest_uol_news()
   for n in noticias:
       print(f"{n['title']} ({n['pubDate']})\n{n['link']}\n{n['description']}\n")
   ```
3. O retorno já está pronto para ser inserido no `context` do agente Cappy.

## Formatação das notícias para o contexto

A skill espera que o resultado seja uma lista de dicionários como acima. Para inserir no contexto, converta‑a para uma string JSON ou formate manualmente. Exemplo de formatação JSON:
```json
[
  {
    "title": "Título da primeira notícia",
    "link": "https://uol.com.br/...",
    "pubDate": "Mon, 08 Apr 2026 10:00:00 -0300",
    "description": "Resumo da notícia..."
  },
  ...
]
```

## Personalizações

- **Número de notícias**: altere o parâmetro `limit` na chamada `get_latest_uol_news(limit=3)`.
- **Fonte RSS**: para outra seção do UOL, troque a URL do feed (ex.: `https://feeds.uol.com.br/rss/uol/economia.xml`).

## Dependências

Nenhuma dependência externa; tudo usa bibliotecas da stdlib Python 3.

---

**Referência do script**: veja o arquivo `scripts/fetch_uol_news.py` no repositório.