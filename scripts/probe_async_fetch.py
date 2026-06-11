"""Test whether SerpAPI's async google_ai_overview engine actually returns
useful text given a page_token. Costs 2 queries (one search + one async fetch)."""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.local"

if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

api_key = os.getenv("SERPAPI_KEY")
query = sys.argv[1] if len(sys.argv) > 1 else "how to choose a CRM for a startup"

print(f">>> step 1: regular search for {query!r}")
r1 = requests.get(
    "https://serpapi.com/search",
    params={"api_key": api_key, "engine": "google", "q": query, "gl": "us", "hl": "en", "num": 10},
    timeout=30,
)
r1.raise_for_status()
d1 = r1.json()
ai_meta = d1.get("ai_overview", {})
page_token = ai_meta.get("page_token") if isinstance(ai_meta, dict) else None
if not page_token:
    print(f"<<< no page_token returned. ai_overview shape: {type(ai_meta).__name__}")
    print(json.dumps(ai_meta, indent=2)[:500])
    sys.exit(1)
print(f"<<< got page_token (len={len(page_token)})")

# Step 2: fetch the AI Overview content
print(f">>> step 2: async fetch with page_token")
r2 = requests.get(
    "https://serpapi.com/search",
    params={"api_key": api_key, "engine": "google_ai_overview", "page_token": page_token},
    timeout=30,
)
print(f"<<< HTTP {r2.status_code}  {len(r2.content)} bytes")
r2.raise_for_status()
d2 = r2.json()

print()
print("=== top-level keys of async response ===")
for k in sorted(d2.keys()):
    v = d2[k]
    descr = type(v).__name__
    if isinstance(v, list): descr += f"[{len(v)}]"
    elif isinstance(v, dict): descr += f"{{{len(v)} keys}}"
    elif isinstance(v, str): descr += f"({len(v)} chars)"
    print(f"  {k}: {descr}")

print()
print("=== ai_overview field in async response ===")
ai = d2.get("ai_overview")
if not ai:
    print("  (empty)")
    sys.exit(2)
print(f"  type: {type(ai).__name__}")
if isinstance(ai, dict):
    for k in sorted(ai.keys()):
        v = ai[k]
        if k == "text_blocks" and isinstance(v, list):
            print(f"  text_blocks[{len(v)}]:")
            for i, blk in enumerate(v[:5]):
                if isinstance(blk, dict):
                    txt = blk.get("snippet") or blk.get("text") or json.dumps(blk)[:120]
                    print(f"    [{i}] type={blk.get('type','?')}  snippet={txt[:200]}")
                else:
                    print(f"    [{i}] {str(blk)[:200]}")
        elif k == "references" and isinstance(v, list):
            print(f"  references[{len(v)}]:")
            for i, ref in enumerate(v[:5]):
                print(f"    [{i}] {ref}")
        else:
            print(f"  {k}: {str(v)[:200]}")
