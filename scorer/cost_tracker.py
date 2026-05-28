"""
Thread-safe cost tracking for API calls.
Records input/output tokens per LLM and computes cumulative USD cost.
"""
from __future__ import annotations
import threading

# Pricing per 1M tokens (USD) — as of 2026-05
PRICING = {
    "openai":     {"input": 2.50, "output": 10.00},   # GPT-4o
    "anthropic":  {"input": 3.00, "output": 15.00},   # Claude 3.5 Sonnet
    "perplexity": {"input": 1.00,  "output": 1.00},   # sonar-pro (approx blended)
    "google":     {"input": 0.00,  "output": 0.00},   # SerpAPI → per-request fee
}

SERPAPI_COST_PER_REQUEST = 0.001   # $0.001 per SerpAPI call

_lock = threading.Lock()
_usage: dict[str, dict] = {}


def record(llm: str, input_tokens: int, output_tokens: int) -> None:
    """Record API usage for a single LLM call and accumulate cost."""
    with _lock:
        if llm not in _usage:
            _usage[llm] = {
                "input_tokens": 0,
                "output_tokens": 0,
                "requests": 0,
                "cost_usd": 0.0,
            }
        pricing = PRICING.get(llm, {"input": 0.0, "output": 0.0})
        if llm == "google":
            cost = SERPAPI_COST_PER_REQUEST
        else:
            cost = (
                input_tokens * pricing["input"]
                + output_tokens * pricing["output"]
            ) / 1_000_000
        _usage[llm]["input_tokens"] += input_tokens
        _usage[llm]["output_tokens"] += output_tokens
        _usage[llm]["requests"] += 1
        _usage[llm]["cost_usd"] += cost


def total_cost() -> float:
    """Return cumulative cost in USD across all LLMs."""
    with _lock:
        return sum(v["cost_usd"] for v in _usage.values())


def get_usage() -> dict[str, dict]:
    """Return a deep copy of all usage data."""
    with _lock:
        return {k: dict(v) for k, v in _usage.items()}


def reset() -> None:
    """Reset all counters (call at start of each run)."""
    with _lock:
        _usage.clear()
