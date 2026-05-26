#!/usr/bin/env python3
"""
Calibre asset downloader — Nigeria-first launch build.

Run from your project root:
    python3 scripts/calibre_download_assets_nigeria_first_FIXED.py

This script always writes assets into the PROJECT ROOT images/ folder,
even when the script itself lives inside scripts/.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, Optional, Tuple

USER_AGENT = "CalibreFootballAssetBot/1.0 (local project asset downloader)"

# If this file is inside /scripts, project root is one level up.
SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parent.parent if SCRIPT_PATH.parent.name == "scripts" else Path.cwd().resolve()

IMAGES_DIR = PROJECT_ROOT / "images"
LEAGUES_DIR = IMAGES_DIR / "leagues"
PATHWAYS_DIR = IMAGES_DIR / "pathways"
PLAYERS_DIR = IMAGES_DIR / "players"

for d in (LEAGUES_DIR, PATHWAYS_DIR, PLAYERS_DIR):
    d.mkdir(parents=True, exist_ok=True)


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = text.replace("&", "and")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def http_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.loads(response.read().decode("utf-8"))


def download_url(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=35) as response:
            content = response.read()
        if not content or len(content) < 100:
            return False
        dest.write_bytes(content)
        return True
    except Exception as exc:
        print(f"   ! download failed: {exc}")
        return False


def wikimedia_original_file_url(query: str) -> Optional[Tuple[str, str]]:
    """Search Commons for a file and return (url, title)."""
    api = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"file:{query}",
        "gsrnamespace": "6",
        "gsrlimit": "5",
        "prop": "imageinfo",
        "iiprop": "url|mime",
    }
    url = api + "?" + urllib.parse.urlencode(params)
    try:
        data = http_json(url)
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            info = (page.get("imageinfo") or [{}])[0]
            file_url = info.get("url")
            mime = info.get("mime", "")
            title = page.get("title", query)
            if file_url and (mime.startswith("image/") or file_url.lower().endswith((".svg", ".png", ".jpg", ".jpeg", ".webp"))):
                return file_url, title
    except Exception as exc:
        print(f"   ! Wikimedia search failed for {query}: {exc}")
    return None


def wikipedia_page_image(title: str) -> Optional[Tuple[str, str]]:
    """Use Wikipedia pageimage first; good for player portraits."""
    api = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "pageimages",
        "piprop": "original",
        "redirects": "1",
    }
    url = api + "?" + urllib.parse.urlencode(params)
    try:
        data = http_json(url)
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            original = page.get("original", {})
            source = original.get("source")
            if source:
                return source, page.get("title", title)
    except Exception as exc:
        print(f"   ! Wikipedia image lookup failed for {title}: {exc}")
    return None


def svg_fallback_badge(label: str, sublabel: str = "CALIBRE", accent: str = "#9dff3a") -> str:
    initials = "".join(word[0] for word in re.findall(r"[A-Za-z0-9]+", label)[:3]).upper() or "C"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="{label}">
  <defs>
    <radialGradient id="g" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="{accent}" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#05070a"/>
    </radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="512" height="512" rx="116" fill="#05070a"/>
  <circle cx="256" cy="256" r="194" fill="url(#g)" opacity=".92"/>
  <circle cx="256" cy="256" r="160" fill="none" stroke="{accent}" stroke-width="10" opacity=".55"/>
  <text x="256" y="248" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="96" font-weight="900" fill="#f7ffe8" filter="url(#glow)">{initials}</text>
  <text x="256" y="314" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" letter-spacing="5" fill="{accent}">{sublabel}</text>
</svg>'''


def svg_pathway(region: str, headline: str, nodes: list[str]) -> str:
    node_text = "".join(
        f'<text x="{130 + i*125}" y="365" text-anchor="middle" font-family="Inter, Arial" font-size="20" font-weight="800" fill="#eaffd5">{n}</text>'
        for i, n in enumerate(nodes[:4])
    )
    circles = "".join(
        f'<circle cx="{130 + i*125}" cy="285" r="38" fill="#0e1511" stroke="#9dff3a" stroke-width="4"/><circle cx="{130+i*125}" cy="285" r="9" fill="#9dff3a"/>'
        for i in range(min(4, len(nodes)))
    )
    lines = "".join(
        f'<line x1="{168 + i*125}" y1="285" x2="{92 + (i+1)*125}" y2="285" stroke="#9dff3a" stroke-width="4" opacity=".55"/>'
        for i in range(min(3, len(nodes)-1))
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="{region} scouting pathway">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101813"/><stop offset="1" stop-color="#05070a"/></linearGradient></defs>
  <rect width="640" height="420" rx="42" fill="url(#bg)"/>
  <text x="56" y="74" font-family="Inter, Arial" font-size="24" font-weight="900" letter-spacing="4" fill="#9dff3a">CALIBRE PATHWAY</text>
  <text x="56" y="132" font-family="Inter, Arial" font-size="46" font-weight="950" fill="#ffffff">{region}</text>
  <text x="56" y="174" font-family="Inter, Arial" font-size="22" font-weight="700" fill="#b9c7b1">{headline}</text>
  {lines}{circles}{node_text}
</svg>'''


def svg_player_fallback(name: str, role: str = "TALENT") -> str:
    initials = "".join(part[0] for part in name.split()[:2]).upper()
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 800" role="img" aria-label="{name}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#172018"/><stop offset="1" stop-color="#05070a"/></linearGradient>
    <radialGradient id="halo" cx="50%" cy="28%" r="45%"><stop stop-color="#9dff3a" stop-opacity=".65"/><stop offset="100%" stop-color="#9dff3a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="640" height="800" rx="72" fill="url(#bg)"/>
  <circle cx="320" cy="230" r="210" fill="url(#halo)"/>
  <circle cx="320" cy="260" r="104" fill="#dbe7d5" opacity=".92"/>
  <path d="M132 720c24-184 120-286 188-286s164 102 188 286" fill="#111827" stroke="#9dff3a" stroke-width="8"/>
  <text x="320" y="560" text-anchor="middle" font-family="Inter, Arial" font-size="92" font-weight="950" fill="#9dff3a">{initials}</text>
  <text x="320" y="636" text-anchor="middle" font-family="Inter, Arial" font-size="38" font-weight="900" fill="#fff">{name}</text>
  <text x="320" y="686" text-anchor="middle" font-family="Inter, Arial" font-size="24" font-weight="800" letter-spacing="5" fill="#b9c7b1">{role}</text>
</svg>'''


LEAGUES: Dict[str, str] = {
    "Nigeria Premier Football League": "npfl.svg",
    "Zimbabwe Premier Soccer League": "zimbabwe-psl.svg",
    "UEFA Champions League logo": "champions-league.svg",
    "EFL Championship logo": "efl-championship.svg",
    "Premier League logo": "premier-league.svg",
    "La Liga logo": "laliga.svg",
    "Bundesliga logo": "bundesliga.svg",
    "Serie A logo": "serie-a.svg",
    "Ligue 1 logo": "ligue-1.svg",
}

PATHWAYS = {
    "nigeria": ("Nigeria", "NPFL to Europe: the launch wedge.", ["NPFL", "U20", "Europe", "World Cup"]),
    "zimbabwe": ("Zimbabwe", "Cameo pipeline: keep the local signal alive.", ["PSL", "Warriors", "SA", "Europe"]),
    "africa": ("Africa+", "High-upside regions before the market catches up.", ["West", "South", "North", "Europe"]),
    "south-america": ("South America", "Creators and duel-winners before the premium move.", ["Academy", "First XI", "Export", "Elite"]),
    "europe": ("Europe", "Known leagues, hidden role fits.", ["U19", "B-Team", "Loan", "Breakout"]),
    "asia": ("Asia", "Technical markets with rising tactical value.", ["J-League", "K-League", "AFC", "Europe"]),
}

PLAYERS: Dict[str, str] = {
    "Pedri": "pedri.jpg",
    "Jude Bellingham": "jude-bellingham.jpg",
    "Vinícius Júnior": "vinicius-junior.jpg",
    "Lamine Yamal": "lamine-yamal.jpg",
    "Florian Wirtz": "florian-wirtz.jpg",
}

manifest = {"project_root": str(PROJECT_ROOT), "leagues": {}, "pathways": {}, "players": {}}

print(f"Project root → {PROJECT_ROOT}")
print(f"Images folder → {IMAGES_DIR}")
print("")

for query, filename in LEAGUES.items():
    dest = LEAGUES_DIR / filename
    print(f"League: {query} → {dest.relative_to(PROJECT_ROOT)}")
    found = wikimedia_original_file_url(query)
    ok = False
    if found:
        url, title = found
        ok = download_url(url, dest)
        if ok:
            print(f"   ✓ downloaded from Wikimedia: {title}")
    if not ok:
        dest.write_text(svg_fallback_badge(query.replace(" logo", ""), "LEAGUE"), encoding="utf-8")
        print("   ! fallback generated instead")
    manifest["leagues"][query] = str(dest.relative_to(PROJECT_ROOT))
    time.sleep(0.3)

print("")
for slug, (region, headline, nodes) in PATHWAYS.items():
    dest = PATHWAYS_DIR / f"{slug}.svg"
    dest.write_text(svg_pathway(region, headline, nodes), encoding="utf-8")
    manifest["pathways"][slug] = str(dest.relative_to(PROJECT_ROOT))
    print(f"Pathway: {slug} → {dest.relative_to(PROJECT_ROOT)} ✓ generated")

print("")
for name, filename in PLAYERS.items():
    dest = PLAYERS_DIR / filename
    print(f"Player: {name} → {dest.relative_to(PROJECT_ROOT)}")
    found = wikipedia_page_image(name)
    ok = False
    if found:
        url, title = found
        ok = download_url(url, dest)
        if ok:
            print(f"   ✓ downloaded from Wikipedia: {title}")
    if not ok:
        commons_found = wikimedia_original_file_url(name + " footballer portrait")
        if commons_found:
            url, title = commons_found
            ok = download_url(url, dest)
            if ok:
                print(f"   ✓ downloaded from Wikimedia: {title}")
    if not ok:
        fallback = dest.with_suffix(".svg")
        fallback.write_text(svg_player_fallback(name, "ELITE TALENT"), encoding="utf-8")
        print(f"   ! fallback generated instead → {fallback.relative_to(PROJECT_ROOT)}")
        manifest["players"][name] = str(fallback.relative_to(PROJECT_ROOT))
    else:
        manifest["players"][name] = str(dest.relative_to(PROJECT_ROOT))
    time.sleep(0.3)

manifest_path = IMAGES_DIR / "calibre-assets-manifest.json"
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

print("")
print(f"Manifest written → {manifest_path.relative_to(PROJECT_ROOT)}")
print("Done. Commit the images/ folder with your index.html.")
