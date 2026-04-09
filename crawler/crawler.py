import argparse
import asyncio
import re
from urllib.parse import urljoin, urlparse

import aiohttp
from bs4 import BeautifulSoup


class AsyncCrawler:
    def __init__(self, start_url, max_depth=2, max_pages=100, same_domain=True, include_patterns=None, exclude_patterns=None):
        self.start_url = start_url.rstrip('/')
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.same_domain = same_domain
        self.include_patterns = [re.compile(p) for p in (include_patterns or [])]
        self.exclude_patterns = [re.compile(p) for p in (exclude_patterns or [])]
        self.visited = set()
        self.found = []

    def _should_visit(self, url: str) -> bool:
        if url in self.visited:
            return False
        if self.same_domain:
            if urlparse(url).netloc != urlparse(self.start_url).netloc:
                return False
        if self.include_patterns and not any(p.search(url) for p in self.include_patterns):
            return False
        if any(p.search(url) for p in self.exclude_patterns):
            return False
        return True

    async def _fetch(self, session: aiohttp.ClientSession, url: str) -> str | None:
        try:
            async with session.get(url, timeout=10) as resp:
                if resp.status != 200:
                    return None
                # Only parse HTML content types
                ct = resp.headers.get('Content-Type', '')
                if 'text/html' not in ct:
                    return None
                return await resp.text()
        except Exception as e:
            # Silently ignore errors, but could be logged
            return None

    async def _crawl(self, url: str, depth: int, session: aiohttp.ClientSession):
        if len(self.visited) >= self.max_pages:
            return
        if depth > self.max_depth:
            return
        if not self._should_visit(url):
            return
        self.visited.add(url)
        html = await self._fetch(session, url)
        if html is None:
            return
        self.found.append(url)
        soup = BeautifulSoup(html, 'html.parser')
        tasks = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            # Resolve relative URLs
            next_url = urljoin(url, href)
            # Strip fragments
            next_url = next_url.split('#')[0]
            if self._should_visit(next_url):
                tasks.append(self._crawl(next_url, depth + 1, session))
        await asyncio.gather(*tasks, return_exceptions=True)

    async def run(self):
        async with aiohttp.ClientSession() as session:
            await self._crawl(self.start_url, 0, session)
        return self.found


def parse_args():
    parser = argparse.ArgumentParser(description='Simple asynchronous web crawler')
    parser.add_argument('url', help='Start URL')
    parser.add_argument('--depth', type=int, default=2, help='Maximum crawl depth (default 2)')
    parser.add_argument('--max-pages', type=int, default=100, help='Maximum number of pages to fetch (default 100)')
    parser.add_argument('--external', action='store_true', help='Allow crawling external domains')
    parser.add_argument('--include', action='append', help='Regex pattern to include URLs (can be used multiple times)')
    parser.add_argument('--exclude', action='append', help='Regex pattern to exclude URLs (can be used multiple times)')
    parser.add_argument('--output', help='File to write the list of visited URLs (plain text)')
    return parser.parse_args()


async def main():
    args = parse_args()
    crawler = AsyncCrawler(
        start_url=args.url,
        max_depth=args.depth,
        max_pages=args.max_pages,
        same_domain=not args.external,
        include_patterns=args.include,
        exclude_patterns=args.exclude,
    )
    result = await crawler.run()
    for u in result:
        print(u)
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write('\n'.join(result))

if __name__ == '__main__':
    asyncio.run(main())
