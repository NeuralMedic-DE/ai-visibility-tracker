"""
Google AI Overviews via SerpAPI.

SerpAPI returns an `ai_overview` field in Google search results when
AI Overviews are triggered. If not triggered, we record `no_overview`.
"""
from __future__ import annotations
import os
import requests
from typing import Optional


SERPAPI_ENDPOINT = "https://serpapi.com/search"


def query(search_query: str) -> str:
    """
    Query Google via SerpAPI and return the AI Overview text if present,
    or a sentinel string if not triggered.

    Returns:
        str — AI Overview text, or "NO_AI_OVERVIEW" if not triggered,
              or raises on API/network error.
    """
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        raise EnvironmentError("SERPAPI_KEY not set")

    params = {
        "api_key": api_key,
        "engine": "google",
        "q": search_query,
        "gl": "us",
        "hl": "en",
        "num": 10,
    }

    resp = requests.get(SERPAPI_ENDPOINT, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    # SerpAPI returns AI Overviews under various keys depending on version
    # Try known paths
    ai_overview = (
        data.get("ai_overview")
        or data.get("answer_box", {}).get("snippet")
        or None
    )

    if ai_overview:
        if isinstance(ai_overview, dict):
            # Newer SerpAPI format: {"text_blocks": [...]}
            blocks = ai_overview.get("text_blocks", [])
            parts = []
            for block in blocks:
                if isinstance(block, dict):
                    parts.append(block.get("snippet", "") or block.get("text", ""))
                elif isinstance(block, str):
                    parts.append(block)
            text = "\n".join(filter(None, parts))
            return text if text else "NO_AI_OVERVIEW"
        elif isinstance(ai_overview, str):
            return ai_overview

    return "NO_AI_OVERVIEW"
