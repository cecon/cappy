# Async Web Crawler

A lightweight asynchronous web crawler written in Python. It uses **aiohttp** for non‑blocking HTTP requests and **BeautifulSoup** to parse HTML and discover links.

## Features

- Configurable maximum depth and page limit
- Option to stay within the start domain or crawl external sites
- Include/exclude URL filtering with regular expressions
- Asynchronous concurrency for fast crawling
- Simple CLI interface with optional output file

## Installation

```bash
# (Optional) Create a virtual environment
python -m venv venv
source venv/bin/activate  # on Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

```bash
python crawler.py https://example.com \
    --depth 3 \
    --max-pages 200 \
    --exclude "#" \
    --output visited.txt
```

### Arguments

| Argument | Description |
|----------|-------------|
| `url` | Starting URL for the crawl (required) |
| `--depth N` | Maximum link depth (default = 2) |
| `--max-pages N` | Stop after visiting N pages (default = 100) |
| `--external` | Allow crawling to external domains (by default only the start domain is crawled) |
| `--include PATTERN` | Regex pattern – only URLs matching at least one include pattern will be visited. Can be provided multiple times. |
| `--exclude PATTERN` | Regex pattern – URLs matching any exclude pattern will be skipped. Can be provided multiple times. |
| `--output FILE` | Write the list of visited URLs to *FILE* (plain‑text, one per line) |

## Example

```bash
python crawler.py https://news.ycombinator.com \
    --depth 1 \
    --max-pages 50 \
    --exclude "login|logout" \
    --output hn_urls.txt
```

The script will print each visited URL to the console and, if `--output` is supplied, store them in `hn_urls.txt`.

## License

This project is released under the MIT License.
