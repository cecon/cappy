import urllib.request
import xml.etree.ElementTree as ET
import re
from html import unescape

def _clean_html(text: str) -> str:
    """Remove simple HTML tags from description."""
    # Very basic removal, sufficient for RSS description
    import re
    clean = re.sub(r'<[^>]+>', '', text)
    return unescape(clean).strip()

def get_petrobasa_news(limit: int = 3):
    """Fetch the latest *limit* news items from UOL RSS feed that mention Petrobras.
    Returns a list of dictionaries with keys: title, link, pubDate, description.
    """
    """Fetch the latest *limit* news items from UOL RSS feed.

    Returns a list of dictionaries with keys: title, link, pubDate, description.
    """
    rss_url = "https://feeds.uol.com.br/rss/uol/noticias.xml"
    try:
        # Set a User-Agent to avoid possible blocks by the server
        req = urllib.request.Request(rss_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            data = response.read()
    except Exception as e:
        raise RuntimeError(f"Failed to fetch UOL RSS feed: {e}")
    root = ET.fromstring(data)
    items = []
    count = 0
    for item in root.findall('.//item'):
        if count >= limit:
            break
        title = item.findtext('title') or ''
        if 'petrobras' not in title.lower():
            continue
        link = item.findtext('link') or ''
        pubDate = item.findtext('pubDate') or ''
        description = item.findtext('description') or ''
        description = _clean_html(description)
        items.append({
            'title': title,
            'link': link,
            'pubDate': pubDate,
            'description': description,
        })
        count += 1
        title = item.findtext('title') or ''
        link = item.findtext('link') or ''
        pubDate = item.findtext('pubDate') or ''
        description = item.findtext('description') or ''
        description = _clean_html(description)
        items.append({
            'title': title,
            'link': link,
            'pubDate': pubDate,
            'description': description,
        })
    return items

if __name__ == "__main__":
    for news in get_latest_uol_news():
        print(f"{news['title']} ({news['pubDate']})")
        print(news['link'])
        print(news['description'])
        print('-' * 80)
