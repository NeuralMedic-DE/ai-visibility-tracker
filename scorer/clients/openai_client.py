"""OpenAI GPT-4o client for prompt execution + sentiment classification."""
from __future__ import annotations
import os
from typing import Optional


REQUEST_TIMEOUT = 90.0  # seconds — prevents hung connections from stalling the run

def get_client():
    """Return an openai.OpenAI client, or raise if key missing."""
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("openai package required: pip install openai")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key, timeout=REQUEST_TIMEOUT)


def query(prompt_text: str, model: str = "gpt-4o") -> str:
    """
    Send a single user prompt and return the text response.
    Raises on API error.
    """
    from ..cost_tracker import record as _record
    client = get_client()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant. Answer the user's question "
                    "clearly and concisely, as you normally would."
                ),
            },
            {"role": "user", "content": prompt_text},
        ],
        max_tokens=1024,
        temperature=0.3,
    )
    if response.usage:
        _record("openai", response.usage.prompt_tokens, response.usage.completion_tokens)
    return response.choices[0].message.content or ""


def classify_sentiment(
    response_excerpt: str,
    brand: str,
    model: str = "gpt-4o-mini",
) -> str:
    """
    Classify the sentiment of a brand mention in a response excerpt.
    Returns: "positive", "neutral", or "negative".
    """
    client = get_client()
    prompt = (
        f'Given this AI-generated text, what is the sentiment toward "{brand}"?\n\n'
        f'Text:\n"""\n{response_excerpt[:1500]}\n"""\n\n'
        f'Reply with exactly one word: positive, neutral, or negative.'
    )
    result = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=10,
        temperature=0,
    )
    raw = (result.choices[0].message.content or "neutral").strip().lower()
    if raw in ("positive", "neutral", "negative"):
        return raw
    # Fallback parsing
    if "positive" in raw:
        return "positive"
    if "negative" in raw:
        return "negative"
    return "neutral"
