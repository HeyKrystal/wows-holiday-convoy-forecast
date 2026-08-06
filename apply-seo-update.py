#!/usr/bin/env python3
"""Apply the Holiday Convoy SEO update without replacing the rest of index.html."""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

EVENT_YEAR = 2026
PAGE_TITLE = f"World of Warships Holiday Convoy Planner ({EVENT_YEAR})"
DESCRIPTION = (
    "Free unofficial World of Warships Holiday Convoy planner for 2026. "
    "Estimate Convoy Tokens, compare rewards, and save or share scenarios."
)
INTRO_HTML = """<p>
            Holiday Convoy Forecast is a free, unofficial World of Warships
            Holiday Convoy planner and token calculator for 2026. Estimate
            Convoy Tokens, compare reward costs, and save or share different
            what-if Scenarios before committing valuable resources in game.
          </p>"""
STRUCTURED_DATA_ID = "holiday-convoy-structured-data"
GITHUB_REPOSITORY = "https://github.com/HeyKrystal/wows-holiday-convoy-planner"
LAST_MODIFIED = "2026-08-06"


def replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.IGNORECASE | re.DOTALL)
    if count != 1:
        raise RuntimeError(f"Could not uniquely update {label}. Found {count} matches.")
    return updated


def replace_meta(text: str, attribute: str, key: str, value: str) -> str:
    escaped_key = re.escape(key)
    pattern = (
        rf'(<meta\s+{attribute}="{escaped_key}"\s+content=")[^"]*'
        rf'("\s*/?>)'
    )
    return replace_once(text, pattern, rf'\g<1>{value}\g<2>', f'{attribute}="{key}"')


def read_canonical_url(text: str) -> str:
    match = re.search(
        r'<link\s+rel="canonical"\s+href="([^"]+)"\s*/?>',
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        raise RuntimeError('Could not find <link rel="canonical"> in index.html.')
    return match.group(1).rstrip("/") + "/"


def read_social_image(text: str, canonical_url: str) -> str:
    match = re.search(
        r'<meta\s+property="og:image"\s+content="([^"]+)"\s*/?>',
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1)
    return canonical_url + "images/social-preview.png"


def build_structured_data(canonical_url: str, image_url: str) -> str:
    payload = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Holiday Convoy Forecast",
        "alternateName": [
            "World of Warships Holiday Convoy Planner",
            "WoWS Holiday Convoy Planner",
        ],
        "description": DESCRIPTION,
        "url": canonical_url,
        "image": image_url,
        "applicationCategory": "UtilitiesApplication",
        "operatingSystem": "Any",
        "browserRequirements": "Requires JavaScript and a modern web browser.",
        "isAccessibleForFree": True,
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD",
        },
        "author": {
            "@type": "Person",
            "name": "HeyKrystal",
            "url": "https://github.com/HeyKrystal",
        },
        "sameAs": GITHUB_REPOSITORY,
        "inLanguage": "en-US",
        "dateModified": LAST_MODIFIED,
    }
    json_text = json.dumps(payload, indent=2, ensure_ascii=False)
    indented = "\n".join(f"  {line}" for line in json_text.splitlines())
    return (
        f'  <script id="{STRUCTURED_DATA_ID}" type="application/ld+json">\n'
        f"{indented}\n"
        "  </script>"
    )


def upsert_structured_data(text: str, block: str) -> str:
    existing_pattern = (
        rf'\s*<script\s+id="{re.escape(STRUCTURED_DATA_ID)}"\s+'
        rf'type="application/ld\+json">.*?</script>\s*'
    )
    without_existing, count = re.subn(
        existing_pattern,
        "\n",
        text,
        count=1,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if count > 1:
        raise RuntimeError("Found more than one Holiday Convoy structured-data block.")

    head_script = re.search(r"\n\s*<script(?:\s|>)", without_existing, flags=re.IGNORECASE)
    if not head_script:
        raise RuntimeError("Could not find the first <script> element in <head>.")

    return (
        without_existing[: head_script.start()]
        + "\n\n"
        + block
        + without_existing[head_script.start() :]
    )


def update_index(index_path: Path) -> tuple[str, str]:
    original = index_path.read_text(encoding="utf-8")
    canonical_url = read_canonical_url(original)
    image_url = read_social_image(original, canonical_url)

    updated = replace_once(
        original,
        r'(<meta\s+name="description"\s+content=")[^"]*("\s*/?>)',
        rf'\g<1>{DESCRIPTION}\g<2>',
        "meta description",
    )
    updated = replace_once(
        updated,
        r"<title>.*?</title>",
        f"<title>{PAGE_TITLE}</title>",
        "document title",
    )
    updated = replace_meta(updated, "property", "og:title", PAGE_TITLE)
    updated = replace_meta(updated, "property", "og:description", DESCRIPTION)
    updated = replace_meta(updated, "name", "twitter:title", PAGE_TITLE)
    updated = replace_meta(updated, "name", "twitter:description", DESCRIPTION)

    structured_data = build_structured_data(canonical_url, image_url)
    updated = upsert_structured_data(updated, structured_data)

    intro_pattern = (
        r'(<div\s+class="about-intro">.*?'
        r'<h2>Plan before you spend</h2>\s*)'
        r'<p>.*?</p>'
    )
    updated = replace_once(
        updated,
        intro_pattern,
        rf"\g<1>{INTRO_HTML}",
        "About introduction",
    )

    backup_path = index_path.with_name("index.html.seo-backup")
    if not backup_path.exists():
        shutil.copy2(index_path, backup_path)

    index_path.write_text(updated, encoding="utf-8", newline="\n")
    return canonical_url, image_url


def write_sitemap(project_root: Path, canonical_url: str) -> Path:
    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{canonical_url}</loc>
    <lastmod>{LAST_MODIFIED}</lastmod>
  </url>
</urlset>
"""
    sitemap_path = project_root / "sitemap.xml"
    sitemap_path.write_text(sitemap, encoding="utf-8", newline="\n")
    return sitemap_path


def main() -> int:
    project_root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    index_path = project_root / "index.html"

    if not index_path.is_file():
        print(f"ERROR: No index.html found in {project_root}", file=sys.stderr)
        print("Run this script from the project root or pass the project path.", file=sys.stderr)
        return 1

    try:
        canonical_url, _ = update_index(index_path)
        sitemap_path = write_sitemap(project_root, canonical_url)
    except (OSError, RuntimeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("SEO update applied successfully.")
    print(f"Updated: {index_path}")
    print(f"Created: {sitemap_path}")
    print(f"Backup:  {project_root / 'index.html.seo-backup'}")
    print(f"Canonical URL: {canonical_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
