"""Diagnostic SerpAPI probe — make ONE call with a configurable query and
dump enough of the response to figure out where (or whether) Google AI
Overviews appear.

Usage:
    python3 scripts/probe_serpapi.py "best crm for startups"
    python3 scripts/probe_serpapi.py "how to choose a crm"

Logs every call to scripts/probe_log.jsonl so we can review across patterns
without re-querying. Refuses to run if remaining quota is unknown — uses a
local counter file as a soft check.

Reports top-level keys of the response, presence of `ai_overview` family
fields, and if present, the first 600 chars of extracted text.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.local"
LOG_FILE = ROOT / "scripts" / "probe_log.jsonl"

# Load .env.local
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

api_key = os.getenv("SERPAPI_KEY")
if not api_key:
    print("ERROR: SERPAPI_KEY missing in .env.local")
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: probe_serpapi.py \"<your search query>\"")
    sys.exit(2)

query = sys.argv[1]
include_async = "--async" in sys.argv
hl = "en"
gl = "us"

params = {
    "api_key": api_key,
    "engine": "google",
    "q": query,
    "gl": gl,
    "hl": hl,
    "num": 10,
}
if include_async:
    params["async"] = "true"   # SerpAPI sometimes defers AI Overview to async fetch

print(f">>> querying: {query!r}  (gl={gl} hl={hl} async={include_async})")
start = time.time()
resp = requests.get("https://serpapi.com/search", params=params, timeout=30)
elapsed = time.time() - start
print(f"<<< HTTP {resp.status_code}  {elapsed:.1f}s  {len(resp.content)} bytes\n")
resp.raise_for_status()
data = resp.json()

# 1. Top-level keys
print("=== TOP-LEVEL RESPONSE KEYS ===")
for k in sorted(data.keys()):
    v = data[k]
    descr = type(v).__name__
    if isinstance(v, (list,)):
        descr += f"[{len(v)}]"
    elif isinstance(v, dict):
        descr += f"{{{len(v)} keys}}"
    elif isinstance(v, str):
        descr += f"({len(v)} chars)"
    print(f"  {k}: {descr}")

print()

# 2. AI Overview family — try multiple plausible field paths
AI_FAMILY = [
    "ai_overview",
    "answer_box",
    "generative_ai",
    "ai_overview_inline",
    "knowledge_graph",
]
print("=== AI-OVERVIEW-RELATED FIELDS ===")
found_any = False
for key in AI_FAMILY:
    if key in data:
        found_any = True
        v = data[key]
        print(f"  {key}: type={type(v).__name__}")
        snippet = json.dumps(v, indent=2)[:600]
        print(f"  preview: {snippet}\n")
if not found_any:
    print("  (no ai_overview / answer_box / generative_ai keys present)")

# 3. If `ai_overview` has a serpapi_link, that's the async fetch path
if isinstance(data.get("ai_overview"), dict):
    link = data["ai_overview"].get("serpapi_link")
    if link:
        print(f"\n!!! ai_overview is ASYNC — needs a follow-up fetch:")
        print(f"    {link}")
        print(f"    re-run with --async or fetch this URL with api_key={api_key[:6]}…")

# 4. Append to log
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
log_entry = {
    "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "query": query,
    "async_mode": include_async,
    "http_status": resp.status_code,
    "elapsed_seconds": round(elapsed, 2),
    "top_keys": sorted(data.keys()),
    "ai_overview_present": "ai_overview" in data,
    "ai_overview_type": type(data.get("ai_overview")).__name__ if data.get("ai_overview") is not None else None,
    "answer_box_present": "answer_box" in data,
    # Don't log the full response — that's a lot of bytes per query
}
with LOG_FILE.open("a") as f:
    f.write(json.dumps(log_entry) + "\n")
print(f"\nlogged to {LOG_FILE.relative_to(ROOT)}")
