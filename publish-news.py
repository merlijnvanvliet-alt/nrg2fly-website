"""
publish-news.py
---------------
Haalt gepubliceerde artikelen op uit Notion, genereert voor elk artikel
een statische HTML-pagina met OG-tags, en uploadt alles via FTP.

Gebruik:
    python3 publish-news.py
"""

import json
import re
import sys
import ftplib
import urllib.request
import urllib.error
from pathlib import Path
from html import escape
from urllib.parse import urlparse

# ===== CONFIGURATIE =====
NOTION_TOKEN    = "ntn_z7472365667b9AWGGP8xOSCwZrFKo9NRCt3UnjkUw8OelC"
NOTION_DATABASE = "adc992c0-788d-408a-99a8-deb68c92a47f"
NOTION_VERSION  = "2022-06-28"

SITE_URL    = "https://www.nrg2fly.com"
FTP_HOST    = "s17.servitnow.nl"
FTP_PORT    = 21
FTP_USER    = "mdambras"
FTP_PASS    = "NRG123fly!"
FTP_REMOTE  = "/domains/nrg2fly.com/public_html"

BASE_DIR = Path(__file__).parent


# ===== HELPERS =====
def slugify(text):
    # Normalize special characters to ASCII
    replacements = {"æ":"ae","ø":"o","å":"a","ä":"ae","ö":"oe","ü":"ue","é":"e","è":"e","ê":"e","ë":"e","à":"a","â":"a","î":"i","ï":"i","ô":"o","û":"u","ç":"c","ñ":"n"}
    slug = text.lower()
    for char, repl in replacements.items():
        slug = slug.replace(char, repl)
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)
    return slug[:80]

def render_rich_text(segments):
    """Convert Notion rich_text array to HTML, preserving bold and italic."""
    html = ""
    for seg in (segments or []):
        text = escape(seg.get("plain_text", ""))
        ann = seg.get("annotations", {})
        if ann.get("bold"):
            text = f"<strong>{text}</strong>"
        if ann.get("italic"):
            text = f"<em>{text}</em>"
        html += text
    return html

def format_date(iso):
    if not iso:
        return ""
    from datetime import date
    d = date.fromisoformat(iso)
    return d.strftime("%-d %B %Y")


# ===== STAP 1: Notion ophalen =====
def fetch_news():
    print("📰  Artikelen ophalen uit Notion…")
    url = f"https://api.notion.com/v1/databases/{NOTION_DATABASE}/query"
    payload = json.dumps({
        "filter": {"property": "Published", "checkbox": {"equals": True}},
        "sorts": [{"property": "Date", "direction": "descending"}],
        "page_size": 50,
    }).encode("utf-8")

    req = urllib.request.Request(
        url, data=payload, method="POST",
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
        print(f"❌  Notion fout {e.code}: {e.read().decode()}")
        sys.exit(1)

    articles = []
    for page in data.get("results", []):
        props = page["properties"]
        title = (props["Title"]["title"] or [{}])[0].get("plain_text", "")
        if not title:
            continue

        slug = slugify(title)

        # Image: Notion-hosted file → download locally so URL never expires
        image = ""
        notion_files = props.get("Image", {}).get("files", [])
        if notion_files:
            notion_url = (notion_files[0].get("file") or notion_files[0].get("external") or {}).get("url", "")
            if notion_url:
                ext = Path(urlparse(notion_url).path).suffix.split("?")[0] or ".jpg"
                local_name = f"images/news/{slug}{ext}"
                local_path = BASE_DIR / local_name
                local_path.parent.mkdir(parents=True, exist_ok=True)
                urllib.request.urlretrieve(notion_url, local_path)
                image = local_name
                print(f"    🖼   Afbeelding gedownload: {local_name}")

        articles.append({
            "id":       page["id"],
            "slug":     slug,
            "title":    title,
            "category": (props["Category"]["select"] or {}).get("name", ""),
            "date":     (props["Date"]["date"] or {}).get("start", ""),
            "image":    image,
            "intro":    (props["Intro"]["rich_text"] or [{}])[0].get("plain_text", ""),
            "body":     render_rich_text(props["Body"]["rich_text"] or []),
            "link":     props["Link"]["url"] or "",
        })

    print(f"    ✅  {len(articles)} artikel(en) gevonden")
    return articles


# ===== STAP 2: news-data.json opslaan =====
def save_json(articles):
    path = BASE_DIR / "news-data.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    print(f"    💾  news-data.json opgeslagen")
    return path


# ===== STAP 3: Statische artikelpagina's genereren =====
BADGE_COLORS = {
    "Award":       ("fffbe6", "a07c00"),
    "Partnership": ("e8f0fe", "1a56ba"),
    "Product":     ("e6f4ea", "1e6e3e"),
    "Event":       ("fce8d5", "b54a00"),
    "Press":       ("f0e6fa", "6b28a8"),
    "Update":      ("f0f0f0", "555555"),
}

def generate_article_html(article):
    title    = escape(article["title"])
    intro    = escape(article["intro"])
    category = escape(article["category"])
    date_str = format_date(article["date"])
    slug     = article["slug"]

    # Absolute image URL for OG tags
    img_raw = article["image"]
    if img_raw and img_raw.startswith("http"):
        og_image = img_raw
    elif img_raw:
        og_image = f"{SITE_URL}/{img_raw}"
    else:
        og_image = f"{SITE_URL}/NRG2FLY_icon_RGB.png"

    page_url = f"{SITE_URL}/news/{slug}.html"

    # Badge style
    bg, fg = BADGE_COLORS.get(article["category"], ("eee", "333"))
    badge_html = f'<span style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:.2rem .6rem;border-radius:4px;background:#{bg};color:#{fg}">{category}</span>' if category else ""

    # Image
    img_html = f'<img style="width:100%;max-height:440px;object-fit:cover;border-radius:8px;margin-bottom:2rem;display:block" src="../{img_raw}" alt="{title}" />' if img_raw and not img_raw.startswith("http") else (f'<img style="width:100%;max-height:440px;object-fit:cover;border-radius:8px;margin-bottom:2rem;display:block" src="{img_raw}" alt="{title}" />' if img_raw else "")

    # Image 2 (Notion-hosted, downloaded locally)
    img2_raw = article.get("image2", "")
    img2_html = f'<img style="width:100%;max-height:440px;object-fit:cover;border-radius:8px;margin-bottom:2rem;display:block" src="../{img2_raw}" alt="{title}" />' if img2_raw else ""

    # Body paragraphs — body is already HTML (bold/italic preserved), split on double newline
    body_html = "".join(f"<p>{p}</p>" for p in article["body"].split("\n\n") if p.strip()) if article["body"] else ""

    # External link button
    link_btn = f'<a href="{escape(article["link"])}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:.75rem 2rem;border-radius:8px;background:#ffd936;color:#1a1a1a;font-weight:600;text-decoration:none;margin-top:.5rem">Read full article</a>' if article["link"] else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — NRG2fly</title>
  <meta name="description" content="{intro}" />

  <!-- Open Graph -->
  <meta property="og:type"        content="article" />
  <meta property="og:title"       content="{title}" />
  <meta property="og:description" content="{intro}" />
  <meta property="og:image"       content="{og_image}" />
  <meta property="og:url"         content="{page_url}" />
  <meta property="og:site_name"   content="NRG2fly" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="{title}" />
  <meta name="twitter:description" content="{intro}" />
  <meta name="twitter:image"       content="{og_image}" />

  <link rel="icon" type="image/png" href="../NRG2FLY_icon_RGB.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Forum&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../style.css" />
  <style>
    .article-hero {{
      padding-top: calc(var(--nav-height) + 3rem);
      padding-bottom: 3rem;
      background: var(--sage);
    }}
    .article-hero .container, .article-body .container {{ max-width: 760px; }}
    .article-back {{
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      font-size: .88rem;
      font-weight: 600;
      color: var(--green);
      margin-bottom: 1.5rem;
      transition: gap var(--transition);
    }}
    .article-back:hover {{ gap: .65rem; }}
    .article-title {{
      font-family: var(--font-heading);
      font-size: clamp(1.8rem, 4vw, 2.8rem);
      color: var(--dark);
      line-height: 1.2;
      margin-top: .75rem;
    }}
    .article-body {{ padding: 3rem 1.5rem 5rem; }}
    .article-body p {{ font-size: 1.05rem; line-height: 1.8; color: var(--text); margin-bottom: 1.25rem; }}
    .article-intro {{ font-size: 1.1rem !important; font-weight: 500; color: var(--dark) !important; }}
    .share-bar {{
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: .6rem;
      margin-top: 2.5rem;
      padding-top: 2rem;
      border-top: 1px solid #eee;
    }}
    .share-label {{
      font-size: .82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: var(--text-light);
      margin-right: .25rem;
    }}
    .share-btn {{
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      padding: .45rem 1rem;
      border-radius: 100px;
      font-family: var(--font-body);
      font-size: .85rem;
      font-weight: 600;
      text-decoration: none;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all .2s ease;
    }}
    .share-btn--linkedin {{ background: #0a66c2; color: #fff; }}
    .share-btn--linkedin:hover {{ background: #004182; }}
    .share-btn--x {{ background: #000; color: #fff; }}
    .share-btn--x:hover {{ background: #333; }}
    .share-btn--mail {{ background: var(--sage); color: var(--green); border-color: var(--green); }}
    .share-btn--mail:hover {{ background: var(--green); color: #fff; }}
    .share-btn--copy {{ background: none; border-color: #ddd; color: var(--text); }}
    .share-btn--copy:hover {{ border-color: var(--green); color: var(--green); }}
  </style>
</head>
<body>

  <header class="site-header light" aria-label="Main navigation">
    <nav class="nav-inner">
      <a href="../index.html" class="nav-logo" aria-label="NRG2fly — Home">
        <img class="logo-mark" src="../NRG2FLY_icon_RGB.png" alt="NRG2fly" />
        <img class="logo-full" src="../NRG2FLY_transparant_logo_RGB.png" alt="NRG2fly" />
      </a>
      <button class="hamburger" aria-label="Toggle navigation" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links" role="list">
        <li><a href="../index.html" class="nav-link">Home</a></li>
        <li><a href="../network.html" class="nav-link">Join the Network</a></li>
        <li><a href="../about.html" class="nav-link">About</a></li>
        <li><a href="../news.html" class="nav-link active">News</a></li>
        <li><a href="../whitepapers.html" class="nav-link">Whitepapers</a></li>
        <li><a href="../jobs.html" class="nav-link">Job Openings</a></li>
        <li><a href="../contact.html" class="nav-link">Contact</a></li>
        <li>
          <button class="search-btn" id="search-toggle" aria-label="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </li>
      </ul>
    </nav>
  </header>

  <main>
    <section class="article-hero">
      <div class="container">
        <a href="../news.html" class="article-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to News
        </a>
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
          {badge_html}
          <span style="font-size:.88rem;color:var(--text-light)">{date_str}</span>
        </div>
        <h1 class="article-title">{title}</h1>
      </div>
    </section>

    <section class="article-body">
      <div class="container">
        {img_html}
        {f'<p class="article-intro">{escape(article["intro"])}</p>' if article["intro"] else ""}
        {body_html}
        {img2_html}
        {link_btn}

        <div class="share-bar">
          <span class="share-label">Share</span>
          <a class="share-btn share-btn--linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url={page_url}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
          </a>
          <a class="share-btn share-btn--x" href="https://twitter.com/intent/tweet?url={page_url}&text={title}" target="_blank" rel="noopener noreferrer" aria-label="Share on X">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            X
          </a>
          <a class="share-btn share-btn--mail" href="mailto:?subject={title}&body={page_url}" aria-label="Share via email">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
            Email
          </a>
          <button class="share-btn share-btn--copy" id="copy-btn" onclick="copyUrl()" aria-label="Copy link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            <span id="copy-label">Copy link</span>
          </button>
        </div>
      </div>
    </section>
  </main>

  <script>
    function copyUrl() {{
      navigator.clipboard.writeText('{page_url}').then(function() {{
        var label = document.getElementById('copy-label');
        label.textContent = 'Copied!';
        setTimeout(function() {{ label.textContent = 'Copy link'; }}, 2000);
      }});
    }}
  </script>

  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <img src="../NRG2FLY_transparant_logo_RGB.png" alt="NRG2fly" class="footer-logo-img" />
        <p>Powering Europe's airports for the electric aviation era.</p>
        <div class="footer-member">
          <p class="footer-member-label">Proud member of</p>
          <a href="https://www.efc.aero" target="_blank" rel="noopener noreferrer"><img src="../images/efc-logo_white.webp" alt="Electric Flying Connection" class="footer-member-logo" /></a>
        </div>
      </div>
      <nav class="footer-nav" aria-label="Footer navigation">
        <h4>Pages</h4>
        <ul>
          <li><a href="../index.html">Home</a></li>
          <li><a href="../network.html">Join the Network</a></li>
          <li><a href="../about.html">About</a></li>
          <li><a href="../news.html">News</a></li>
          <li><a href="../whitepapers.html">Whitepapers</a></li>
          <li><a href="../jobs.html">Job Openings</a></li>
          <li><a href="../contact.html">Contact</a></li>
        </ul>
      </nav>
      <div class="footer-nav">
        <h4>Contact</h4>
        <ul>
          <li><a href="mailto:jacco@nrg2fly.com">jacco@nrg2fly.com</a></li>
          <li><a href="../contact.html">Send a Message</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; 2025 NRG2fly. All rights reserved.</span>
      <span>Lelystad Airport · Teuge Airport</span>
    </div>
  </footer>

  <div class="search-overlay" id="search-overlay" role="dialog" aria-modal="true" aria-label="Search site">
    <div class="search-box">
      <div class="search-input-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" id="search-input" placeholder="Search NRG2fly…" autocomplete="off" aria-label="Search query" />
        <button class="search-close" id="search-close" aria-label="Close search">&times;</button>
      </div>
      <div class="search-results" id="search-results"></div>
    </div>
  </div>

  <script src="../script.js"></script>
</body>
</html>"""


def generate_all_articles(articles):
    news_dir = BASE_DIR / "news"
    news_dir.mkdir(exist_ok=True)

    # Remove old generated files
    for f in news_dir.glob("*.html"):
        f.unlink()

    generated = []
    for article in articles:
        html = generate_article_html(article)
        path = news_dir / f"{article['slug']}.html"
        path.write_text(html, encoding="utf-8")
        generated.append((path, article["slug"]))
        print(f"    📄  news/{article['slug']}.html")

    return generated


# ===== STAP 4: news-data.json updaten met slug-URLs =====
def update_json_with_slugs(articles):
    path = BASE_DIR / "news-data.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)


# ===== STAP 5: FTP upload =====
def ftp_upload(files):
    print(f"\n🚀  Uploaden naar {FTP_HOST}…")
    try:
        ftp = ftplib.FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
        ftp.login(FTP_USER, FTP_PASS)

        for local_path, remote_path in files:
            remote_dir = remote_path.rsplit("/", 1)[0]
            try:
                ftp.mkd(remote_dir)
            except ftplib.error_perm:
                pass
            with open(local_path, "rb") as f:
                ftp.storbinary(f"STOR {remote_path}", f)
            print(f"    ✅  {remote_path}")

        ftp.quit()
    except Exception as e:
        print(f"❌  FTP fout: {e}")
        sys.exit(1)


# ===== MAIN =====
if __name__ == "__main__":
    # 1. Ophalen uit Notion
    articles = fetch_news()

    # 2. news-data.json opslaan
    save_json(articles)

    # 3. Statische artikelpagina's genereren
    print("\n📝  Artikelpagina's genereren…")
    generated = generate_all_articles(articles)

    # 4. Alles uploaden
    upload_files = [
        (BASE_DIR / "news-data.json",     f"{FTP_REMOTE}/news-data.json"),
        (BASE_DIR / "news.html",          f"{FTP_REMOTE}/news.html"),
    ]
    for local_path, slug in generated:
        upload_files.append((local_path, f"{FTP_REMOTE}/news/{slug}.html"))
    # Gedownloade Notion-afbeeldingen uploaden
    for a in articles:
        if a.get("image"):
            upload_files.append((BASE_DIR / a["image"], f"{FTP_REMOTE}/{a['image']}"))

    ftp_upload(upload_files)

    print(f"\n🎉  Klaar! {len(articles)} artikel(en) live op nrg2fly.com")
    for a in articles:
        print(f"    🔗  {SITE_URL}/news/{a['slug']}.html")
