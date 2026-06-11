"""Google AI Overviews scoring — v2 with async fetch.

Lessons from v1:
  - "best X for Y" and "alternatives to X" do NOT reliably trigger AI Overviews.
  - "how to choose a {category} for {segment}" triggered 4/4 in testing.
  - SerpAPI returns AI Overview in 2 calls: search + async fetch via serpapi_link.

Budget: hard cap at 166 calls (leaves ~9 buffer of the 175 remaining).
Each brand costs up to 2 calls (1 if AI Overview doesn't trigger).

Scoring:
  - present: bool — brand or any alias appears in the AI Overview's text_blocks
    or in the references[] list.
  - google_aio: int — 100 if present, 0 if not. Binary signal.

Brands are picked in CSV order (top 83). Lower-ranked brands stay un-scored
and show `null` rather than `0` in the merged data, so the UI can render "—"
or hide them.

Incremental save every 5 brands.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent

# Load .env.local
for line in (ROOT / ".env.local").read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    os.environ.setdefault(k.strip(), v.strip())

API_KEY = os.getenv("SERPAPI_KEY")
if not API_KEY:
    print("ERROR: SERPAPI_KEY missing")
    sys.exit(1)

BRAND_CSV     = ROOT / "brands_100.csv"
PROGRESS_FILE = ROOT / "scripts" / "google_aio_v2_progress.json"
HARD_CAP      = 166
SAVE_EVERY    = 5
SLEEP_S       = 0.4


def brand_aliases(row: dict) -> list[str]:
    aliases = {row["brand"].strip()}
    if row.get("aliases"):
        for a in row["aliases"].split(","):
            a = a.strip()
            if a:
                aliases.add(a)
    if row.get("url"):
        stem = row["url"].split(".")[0]
        if stem and len(stem) >= 3:
            aliases.add(stem)
    return sorted(aliases, key=len, reverse=True)


def brand_mentioned_in(text: str, aliases: list[str]) -> bool:
    if not text:
        return False
    lower = text.lower()
    for alias in aliases:
        if re.search(r"\b" + re.escape(alias.lower()) + r"\b", lower):
            return True
    return False


def extract_text_from_overview(overview: dict) -> str:
    """Pull all text out of the ai_overview structure for brand-mention checking."""
    parts: list[str] = []
    blocks = overview.get("text_blocks", [])
    for block in blocks or []:
        if isinstance(block, dict):
            for key in ("snippet", "text", "title", "list_item_text"):
                if isinstance(block.get(key), str):
                    parts.append(block[key])
            # Nested lists
            for sub in block.get("list", []) or []:
                if isinstance(sub, dict):
                    for key in ("snippet", "text", "title"):
                        if isinstance(sub.get(key), str):
                            parts.append(sub[key])
        elif isinstance(block, str):
            parts.append(block)
    # Reference URLs/titles too — brands often appear in citations
    for ref in overview.get("references", []) or []:
        if isinstance(ref, dict):
            for key in ("title", "link", "source", "snippet"):
                if isinstance(ref.get(key), str):
                    parts.append(ref[key])
    return "\n".join(filter(None, parts))


def search_query(q: str) -> tuple[dict | None, str | None]:
    """First call. Returns (ai_overview_meta_or_None, error_or_None)."""
    try:
        r = requests.get(
            "https://serpapi.com/search",
            params={"api_key": API_KEY, "engine": "google", "q": q,
                    "gl": "us", "hl": "en", "num": 10},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        return data.get("ai_overview"), None
    except Exception as e:
        return None, str(e)


def async_fetch(serpapi_link: str) -> tuple[dict | None, str | None]:
    """Second call — fetch the AI Overview content via serpapi_link."""
    try:
        url = serpapi_link + f"&api_key={API_KEY}"
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        data = r.json()
        return data.get("ai_overview"), data.get("error")
    except Exception as e:
        return None, str(e)


def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        try:
            return json.loads(PROGRESS_FILE.read_text())
        except Exception:
            pass
    return {
        "brands": {},
        "calls_used": 0,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def save_progress(state: dict) -> None:
    PROGRESS_FILE.write_text(json.dumps(state, indent=2))


def main() -> int:
    with BRAND_CSV.open() as f:
        rows = list(csv.DictReader(f))
    print(f"loaded {len(rows)} brands")

    state = load_progress()
    done = set(state["brands"].keys())
    remaining = [r for r in rows if r["brand"] not in done]
    print(f"resuming — {len(done)} brands scored, {state['calls_used']} calls used")
    print(f"hard cap: {HARD_CAP} calls. budget remaining: {HARD_CAP - state['calls_used']}")
    print()

    for i, row in enumerate(remaining, start=1):
        if state["calls_used"] >= HARD_CAP:
            print(f"[stop] budget exhausted at {state['calls_used']}/{HARD_CAP}")
            break
        brand_name = row["brand"]
        aliases = brand_aliases(row)
        category = row.get("category", "B2B SaaS")
        segment = row.get("segment", "B2B teams")
        query = f"how to choose a {category} for {segment}"

        # Call 1: search
        ai_meta, err = search_query(query)
        state["calls_used"] += 1
        rec = {"brand": brand_name, "aliases": aliases, "query": query, "calls": 1}

        if err:
            rec["error"] = err
            print(f"[{i}/{len(remaining)}] ! {brand_name}: search error — {err}")
            state["brands"][brand_name] = rec
            if (i % SAVE_EVERY) == 0:
                save_progress(state)
            time.sleep(SLEEP_S)
            continue

        serpapi_link = (ai_meta or {}).get("serpapi_link") if isinstance(ai_meta, dict) else None
        if not serpapi_link:
            rec["triggered"] = False
            rec["present"] = False
            rec["score"] = 0
            print(f"[{i}/{len(remaining)}] · {brand_name}: no AI Overview triggered "
                  f"({state['calls_used']}/{HARD_CAP})")
            state["brands"][brand_name] = rec
            if (i % SAVE_EVERY) == 0:
                save_progress(state)
            time.sleep(SLEEP_S)
            continue

        # Call 2: async fetch
        if state["calls_used"] >= HARD_CAP:
            rec["triggered"] = True
            rec["present"] = None  # could not fetch — left unknown
            rec["score"] = None
            rec["note"] = "AI Overview triggered but budget exhausted before async fetch"
            state["brands"][brand_name] = rec
            print(f"[{i}/{len(remaining)}] ✋ {brand_name}: budget hit pre-fetch")
            break
        ai_full, err2 = async_fetch(serpapi_link)
        state["calls_used"] += 1
        rec["calls"] = 2

        if err2 or not ai_full:
            rec["triggered"] = True
            rec["present"] = None
            rec["score"] = None
            rec["fetch_error"] = err2 or "empty"
            print(f"[{i}/{len(remaining)}] ! {brand_name}: fetch error — {err2 or 'empty'}")
        else:
            text = extract_text_from_overview(ai_full)
            present = brand_mentioned_in(text, aliases)
            rec["triggered"] = True
            rec["present"] = present
            rec["score"] = 100 if present else 0
            rec["text_chars"] = len(text)
            rec["text_preview"] = text[:280]
            mark = "✓" if present else "·"
            print(f"[{i}/{len(remaining)}] {mark} {brand_name}: "
                  f"AI Overview ({len(text)} chars), brand {'mentioned' if present else 'not mentioned'} "
                  f"({state['calls_used']}/{HARD_CAP})")

        state["brands"][brand_name] = rec
        if (i % SAVE_EVERY) == 0:
            save_progress(state)
        time.sleep(SLEEP_S)

    save_progress(state)
    print(f"\nfinal: {len(state['brands'])} brands recorded, {state['calls_used']} SerpAPI calls used")
    triggered = sum(1 for r in state["brands"].values() if r.get("triggered"))
    present = sum(1 for r in state["brands"].values() if r.get("present"))
    print(f"AI Overviews triggered: {triggered}/{len(state['brands'])}")
    print(f"brands mentioned in AI Overview: {present}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
