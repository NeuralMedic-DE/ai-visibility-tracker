"""Disk-based cache for LLM responses — keyed by SHA-256 of (brand, prompt_id, llm, text)."""
from __future__ import annotations
import hashlib
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any

from .config import CACHE_DIR


def _cache_key(brand: str, prompt_id: str, llm: str, prompt_text: str) -> str:
    raw = f"{brand}|{prompt_id}|{llm}|{prompt_text}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_path(key: str) -> Path:
    return CACHE_DIR / f"{key}.json"


def get_cached(brand: str, prompt_id: str, llm: str, prompt_text: str) -> Optional[Dict[str, Any]]:
    """Return cached response dict or None if not cached."""
    key = _cache_key(brand, prompt_id, llm, prompt_text)
    path = _cache_path(key)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return None
    return None


def set_cache(
    brand: str,
    prompt_id: str,
    llm: str,
    prompt_text: str,
    response_text: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Persist a response to disk cache."""
    key = _cache_key(brand, prompt_id, llm, prompt_text)
    path = _cache_path(key)
    data = {
        "brand": brand,
        "prompt_id": prompt_id,
        "llm": llm,
        "prompt_text": prompt_text,
        "response": response_text,
        "cached_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "metadata": metadata or {},
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def cache_stats() -> Dict[str, int]:
    """Return count of cached entries."""
    entries = list(CACHE_DIR.glob("*.json"))
    return {"total_cached": len(entries)}
