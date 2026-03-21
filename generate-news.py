"""
generate-news.py
----------------
Fetches Published articles from the NRG2fly Notion database
and writes them to news-data.json for local development.

Usage:
    python3 generate-news.py

Requirements:
    pip install requests
"""

import json
import sys
import urllib.request
import urllib.error

NOTION_TOKEN    = "ntn_z7472365667b9AWGGP8xOSCwZrFKo9NRCt3UnjkUw8OelC"
NOTION_DATABASE = "adc992c0-788d-408a-99a8-deb68c92a47f"
NOTION_VERSION  = "2022-06-28"

def fetch_news():
    url = f"https://api.notion.com/v1/databases/{NOTION_DATABASE}/query"
    payload = json.dumps({
        "filter": {
            "property": "Published",
            "checkbox": {"equals": True},
        },
        "sorts": [
            {"property": "Date", "direction": "descending"},
        ],
        "page_size": 50,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}: {e.read().decode()}")
        sys.exit(1)

    articles = []
    for page in data.get("results", []):
        props = page["properties"]

        title    = (props["Title"]["title"] or [{}])[0].get("plain_text", "")
        category = (props["Category"]["select"] or {}).get("name", "")
        date     = (props["Date"]["date"] or {}).get("start", "")
        image    = props["Image"]["url"] or ""
        intro    = (props["Intro"]["rich_text"] or [{}])[0].get("plain_text", "")
        body     = "\n\n".join(b.get("plain_text", "") for b in (props["Body"]["rich_text"] or []))
        link     = props["Link"]["url"] or ""

        if not title:
            continue

        articles.append({
            "id":       page["id"],
            "title":    title,
            "category": category,
            "date":     date,
            "image":    image,
            "intro":    intro,
            "body":     body,
            "link":     link,
        })

    return articles

if __name__ == "__main__":
    if "JOUW_NOTION_TOKEN_HIER" in NOTION_TOKEN:
        print("⚠️  Vul eerst je Notion token in bovenaan dit bestand.")
        sys.exit(1)

    articles = fetch_news()
    with open("news-data.json", "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    print(f"✅  {len(articles)} artikel(en) opgeslagen in news-data.json")
