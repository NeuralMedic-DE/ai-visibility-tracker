"""Anthropic Claude client for prompt execution."""
from __future__ import annotations
import os


REQUEST_TIMEOUT = 30.0  # seconds — Haiku is fast; 30s is generous

def get_client():
    """Return an anthropic.Anthropic client, or raise if key missing."""
    try:
        import anthropic
    except ImportError:
        raise ImportError("anthropic package required: pip install anthropic")
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=api_key, timeout=REQUEST_TIMEOUT)


def query(prompt_text: str, model: str = "claude-haiku-4-5-20251001") -> str:
    """
    Send a single user prompt to Claude and return the text response.
    """
    from ..cost_tracker import record as _record
    client = get_client()
    message = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt_text}],
    )
    if hasattr(message, "usage") and message.usage:
        _record("anthropic", message.usage.input_tokens, message.usage.output_tokens)
    if message.content and len(message.content) > 0:
        return message.content[0].text
    return ""
