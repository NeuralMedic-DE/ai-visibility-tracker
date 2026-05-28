"""Perplexity sonar-pro client (OpenAI-compatible API)."""
from __future__ import annotations
import os


PERPLEXITY_BASE_URL = "https://api.perplexity.ai"


REQUEST_TIMEOUT = 90.0  # seconds — prevents hung connections from stalling the run

def get_client():
    """Return an OpenAI client pointed at Perplexity, or raise if key missing."""
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("openai package required: pip install openai")
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        raise EnvironmentError("PERPLEXITY_API_KEY not set")
    return OpenAI(api_key=api_key, base_url=PERPLEXITY_BASE_URL, timeout=REQUEST_TIMEOUT)


def query(prompt_text: str, model: str = "sonar-pro") -> str:
    """
    Send a single user prompt to Perplexity and return the text response.
    """
    from ..cost_tracker import record as _record
    client = get_client()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "Be precise and concise.",
            },
            {"role": "user", "content": prompt_text},
        ],
        max_tokens=1024,
        temperature=0.3,
    )
    if response.usage:
        _record("perplexity", response.usage.prompt_tokens, response.usage.completion_tokens)
    return response.choices[0].message.content or ""
