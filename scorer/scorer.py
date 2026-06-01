"""
Core scoring pipeline: takes a BrandProfile, runs all 25 prompts against
all configured LLMs, scores each response, and returns a BrandScore.

Supports both synchronous (backward-compatible) and async (parallel) execution.
Use score_brand() for sequential runs; score_brand_async() for parallel runs.
"""
from __future__ import annotations
import asyncio
import time
import logging
from typing import Dict, List, Optional, Tuple

from .config import LLM_CONFIGS
from .models import BrandProfile, BrandScore, LLMScore, PromptResult
from .prompts import render_prompts
from .parser import detect_presence, extract_rank, detect_link, compute_score
from .cache import get_cached, set_cache

logger = logging.getLogger(__name__)


# ── Per-provider concurrency caps ─────────────────────────────────────────────
# These respect each provider's rate-limit tiers.
# The --concurrency CLI flag sets a global cap; per-provider caps are the ceiling.
PROVIDER_CONCURRENCY_CAPS: Dict[str, int] = {
    "openai":     4,   # GPT-4o tier-3: generous RPM; 4 concurrent is safe
    "anthropic":  4,   # Claude Haiku: high RPM; 4 concurrent is fine
    "perplexity": 2,   # sonar-pro: tighter limits; keep to 2
    "google":     2,   # SerpAPI: 100 req/hr on free plan; 2 concurrent
}


# ── Sentiment (lazy-loaded to avoid import cost when not needed) ──────────────

def _classify_sentiment(response: str, brand: str) -> str:
    """Classify sentiment with fallback to keyword heuristic."""
    import os
    # Respect --no-sentiment flag
    if os.getenv("_SCORER_NO_SENTIMENT"):
        return _keyword_sentiment(response, brand)
    if not os.getenv("OPENAI_API_KEY"):
        return _keyword_sentiment(response, brand)
    try:
        from .clients.openai_client import classify_sentiment
        return classify_sentiment(response, brand)
    except Exception as e:
        logger.warning(f"Sentiment LLM call failed: {e}. Falling back to keywords.")
        return _keyword_sentiment(response, brand)


def _keyword_sentiment(response: str, brand: str) -> str:
    """
    Keyword-based sentiment fallback. Scans the sentence(s) containing the
    brand mention for positive/negative signal words.
    """
    import re
    resp_lower = response.lower()
    brand_lower = brand.lower()

    # Find sentences containing the brand
    sentences = re.split(r"(?<=[.!?])\s+", response)
    relevant = [s for s in sentences if brand_lower in s.lower()]
    if not relevant:
        return "neutral"

    text = " ".join(relevant).lower()

    positive_words = [
        "best", "great", "excellent", "recommend", "winner", "top", "ideal",
        "perfect", "powerful", "loved", "popular", "praised", "fast", "easy",
        "wins", "built for", "purpose-built", "native", "seamless",
    ]
    negative_words = [
        "worst", "avoid", "expensive", "legacy", "limited", "poor", "bad",
        "costly", "complex", "outdated", "cancelled", "problematic", "overpriced",
    ]

    pos_count = sum(1 for w in positive_words if w in text)
    neg_count = sum(1 for w in negative_words if w in text)

    if pos_count > neg_count:
        return "positive"
    elif neg_count > pos_count:
        return "negative"
    return "neutral"


# ── Per-LLM query dispatcher ──────────────────────────────────────────────────

def _query_llm(llm_key: str, prompt_text: str, model: str) -> str:
    """Route a prompt to the appropriate LLM client (synchronous)."""
    if llm_key == "openai":
        from .clients.openai_client import query
        return query(prompt_text, model=model)
    elif llm_key == "anthropic":
        from .clients.anthropic_client import query
        return query(prompt_text, model=model)
    elif llm_key == "perplexity":
        from .clients.perplexity_client import query
        return query(prompt_text, model=model)
    elif llm_key == "google":
        from .clients.google_client import query
        return query(prompt_text)
    else:
        raise ValueError(f"Unknown LLM key: {llm_key}")


# ── Shared result-parsing logic ───────────────────────────────────────────────

def _parse_response(
    raw_response: str,
    llm_key: str,
    prompt_id: str,
    prompt_text: str,
    prompt_category: str,
    brand: BrandProfile,
    brand_names: List[str],
    was_cached: bool,
) -> PromptResult:
    """Parse a raw LLM response into a PromptResult (sync, no I/O)."""
    # Special handling for Google no-overview
    if llm_key == "google" and raw_response == "NO_AI_OVERVIEW":
        return PromptResult(
            prompt_id=prompt_id,
            prompt_text=prompt_text,
            prompt_category=prompt_category,
            presence=False,
            rank=None,
            sentiment="neutral",
            has_link=False,
            score=0.0,
            raw_response=raw_response,
            cached=was_cached,
            error="no_ai_overview",
        )

    presence = detect_presence(raw_response, brand_names)
    rank = extract_rank(raw_response, brand_names, prompt_id, presence)
    has_link = detect_link(raw_response, brand.url)

    if presence:
        sentiment = _classify_sentiment(raw_response, brand.brand)
    else:
        sentiment = "neutral"

    score = compute_score(presence, rank, sentiment, has_link)

    return PromptResult(
        prompt_id=prompt_id,
        prompt_text=prompt_text,
        prompt_category=prompt_category,
        presence=presence,
        rank=rank,
        sentiment=sentiment,
        has_link=has_link,
        score=score,
        raw_response=raw_response,
        cached=was_cached,
    )


def _aggregate_llm_score(
    llm_key: str,
    cfg: dict,
    results: List[PromptResult],
) -> LLMScore:
    """Aggregate per-prompt results into an LLMScore."""
    scored_results = [r for r in results if r.error is None]
    if scored_results:
        avs_raw = sum(r.score for r in scored_results) / len(scored_results)
    else:
        avs_raw = 0.0
    avs = avs_raw * 10
    skipped = [r for r in results if r.error is not None]

    return LLMScore(
        llm_key=llm_key,
        model=cfg["model"],
        label=cfg["label"],
        avs=avs,
        avs_raw=avs_raw,
        prompt_results=results,
        prompts_scored=len(scored_results),
        prompts_skipped=len(skipped),
    )


# ── Synchronous scorer (backward-compatible) ──────────────────────────────────

def score_brand(
    brand: BrandProfile,
    run_date: str,
    llms: Optional[List[str]] = None,
    dry_run: bool = False,
    simulate_latency: float = 0.0,
    prompt_limit: Optional[int] = None,
) -> BrandScore:
    """
    Score a brand across all configured LLMs (or a subset).

    Args:
        brand: BrandProfile with all template variables.
        run_date: ISO date string (YYYY-MM-DD).
        llms: subset of LLM keys to run (default: all configured).
        dry_run: if True, skip API calls and return mock 0-scores.
        simulate_latency: seconds to sleep per prompt in dry-run mode
                          (used for benchmark comparisons; ignored in real mode).
        prompt_limit: max prompts to run (slices PROMPT_TEMPLATES[:limit]).
                      None = all 100. Pass PLAN_PROMPT_LIMITS[plan] to enforce
                      per-plan quotas (starter=25, pro=100).

    Returns:
        BrandScore with per-LLM and aggregate scores.
    """
    if llms is None:
        llms = list(LLM_CONFIGS.keys())

    prompts = render_prompts(brand, limit=prompt_limit)
    brand_names = brand.all_names()
    llm_scores: Dict[str, LLMScore] = {}

    for llm_key in llms:
        cfg = LLM_CONFIGS[llm_key]
        model = cfg["model"]
        delay = cfg["rate_limit_delay"]

        results: List[PromptResult] = []

        logger.info(f"  [{llm_key}] Scoring {brand.brand} across {len(prompts)} prompts…")

        for prompt_id, prompt_text, prompt_category in prompts:
            # ── Cache lookup ──────────────────────────────────────────────
            cached_entry = get_cached(brand.brand, prompt_id, llm_key, prompt_text)

            if cached_entry:
                raw_response = cached_entry["response"]
                was_cached = True
            elif dry_run:
                if simulate_latency > 0:
                    time.sleep(simulate_latency)
                raw_response = f"[DRY RUN — no API call made for {prompt_id}]"
                was_cached = False
            else:
                try:
                    raw_response = _query_llm(llm_key, prompt_text, model)
                    set_cache(brand.brand, prompt_id, llm_key, prompt_text, raw_response)
                    was_cached = False
                    time.sleep(delay)
                except Exception as e:
                    logger.warning(f"    [{llm_key}] {prompt_id} error: {e}")
                    results.append(PromptResult(
                        prompt_id=prompt_id,
                        prompt_text=prompt_text,
                        prompt_category=prompt_category,
                        presence=False,
                        rank=None,
                        sentiment="neutral",
                        has_link=False,
                        score=0.0,
                        raw_response="",
                        cached=False,
                        error=str(e),
                    ))
                    continue

            results.append(
                _parse_response(
                    raw_response, llm_key, prompt_id, prompt_text, prompt_category,
                    brand, brand_names, was_cached,
                )
            )

        llm_scores[llm_key] = _aggregate_llm_score(llm_key, cfg, results)
        s = llm_scores[llm_key]
        logger.info(f"  [{llm_key}] AVS = {s.avs:.1f}/100 (raw {s.avs_raw:.2f}/10)")

    # ── Aggregate AVS across LLMs ──────────────────────────────────────────
    valid_llm_avs = [s.avs_raw for s in llm_scores.values() if s.prompts_scored > 0]
    avs_brand_raw = sum(valid_llm_avs) / len(valid_llm_avs) if valid_llm_avs else 0.0
    avs_brand = avs_brand_raw * 10

    return BrandScore(
        brand=brand.brand,
        url=brand.url,
        run_date=run_date,
        avs_brand=avs_brand,
        avs_brand_raw=avs_brand_raw,
        llm_scores=llm_scores,
    )


# ── Async scorer ───────────────────────────────────────────────────────────────

async def _score_single_prompt_async(
    *,
    llm_key: str,
    model: str,
    delay: float,
    prompt_id: str,
    prompt_text: str,
    prompt_category: str,
    brand: BrandProfile,
    brand_names: List[str],
    dry_run: bool,
    simulate_latency: float,
    semaphore: asyncio.Semaphore,
) -> PromptResult:
    """
    Score one (prompt × LLM) pair asynchronously.

    Real API calls are gated behind `semaphore` to respect provider rate limits.
    Dry-run simulated calls also go through the semaphore so that benchmark
    timings faithfully model real concurrency behavior.
    """
    # Fast path: cache hit (no semaphore needed — pure local I/O)
    cached_entry = get_cached(brand.brand, prompt_id, llm_key, prompt_text)
    if cached_entry:
        raw_response = cached_entry["response"]
        return _parse_response(
            raw_response, llm_key, prompt_id, prompt_text, prompt_category,
            brand, brand_names, was_cached=True,
        )

    # Slow path: gate on per-provider semaphore for both real and simulated calls
    async with semaphore:
        if dry_run:
            if simulate_latency > 0:
                await asyncio.sleep(simulate_latency)
            raw_response = f"[DRY RUN — no API call for {prompt_id}]"
        else:
            try:
                # Run synchronous client call in a thread pool
                raw_response = await asyncio.to_thread(
                    _query_llm, llm_key, prompt_text, model
                )
                set_cache(brand.brand, prompt_id, llm_key, prompt_text, raw_response)
                # Small residual delay to smooth burst traffic within the semaphore window
                await asyncio.sleep(delay * 0.2)
            except Exception as e:
                logger.warning(f"    [{llm_key}] {prompt_id} error: {e}")
                return PromptResult(
                    prompt_id=prompt_id,
                    prompt_text=prompt_text,
                    prompt_category=prompt_category,
                    presence=False,
                    rank=None,
                    sentiment="neutral",
                    has_link=False,
                    score=0.0,
                    raw_response="",
                    cached=False,
                    error=str(e),
                )

    # Parse outside the semaphore (pure CPU, no I/O)
    if presence := (llm_key == "google" and raw_response == "NO_AI_OVERVIEW"):
        # Google-specific: return early with error sentinel
        _ = presence  # silence unused var warning
        return _parse_response(
            raw_response, llm_key, prompt_id, prompt_text, prompt_category,
            brand, brand_names, was_cached=False,
        )

    return _parse_response(
        raw_response, llm_key, prompt_id, prompt_text, prompt_category,
        brand, brand_names, was_cached=False,
    )


async def score_brand_async(
    brand: BrandProfile,
    run_date: str,
    llms: Optional[List[str]] = None,
    dry_run: bool = False,
    concurrency: int = 4,
    simulate_latency: float = 0.0,
    semaphores: Optional[Dict[str, asyncio.Semaphore]] = None,
    prompt_limit: Optional[int] = None,
) -> BrandScore:
    """
    Async version of score_brand — parallelizes all LLMs and prompts concurrently.

    Concurrency is bounded by per-provider semaphores:
      - openai: min(concurrency, 4)
      - anthropic: min(concurrency, 4)
      - perplexity: min(concurrency, 2)
      - google: min(concurrency, 2)

    For multi-brand runs, pass shared `semaphores` created once by the caller
    so global provider load is capped across all brands.

    Args:
        brand: BrandProfile with all template variables.
        run_date: ISO date string (YYYY-MM-DD).
        llms: subset of LLM keys to run (default: all configured).
        dry_run: if True, skip real API calls; use mock responses.
        concurrency: global concurrency cap (overridden by per-provider caps).
        simulate_latency: seconds to sleep per slot in dry-run mode (for benchmarks).
        semaphores: pre-created semaphores to share across brands. If None,
                    brand-local semaphores are created.
        prompt_limit: max prompts to run (slices PROMPT_TEMPLATES[:limit]).
                      None = all 100. Pass PLAN_PROMPT_LIMITS[plan] to enforce
                      per-plan quotas (starter=25, pro=100).

    Returns:
        BrandScore with per-LLM and aggregate scores.
    """
    if llms is None:
        llms = list(LLM_CONFIGS.keys())

    prompts = render_prompts(brand, limit=prompt_limit)
    brand_names = brand.all_names()

    # Create brand-local semaphores if caller didn't supply shared ones
    if semaphores is None:
        semaphores = {
            llm: asyncio.Semaphore(
                min(concurrency, PROVIDER_CONCURRENCY_CAPS.get(llm, concurrency))
            )
            for llm in llms
        }

    async def _score_llm(llm_key: str) -> Tuple[str, LLMScore]:
        cfg = LLM_CONFIGS[llm_key]
        sem = semaphores[llm_key]
        cap = min(concurrency, PROVIDER_CONCURRENCY_CAPS.get(llm_key, concurrency))

        logger.info(
            f"  [{llm_key}] Scoring {brand.brand} "
            f"({len(prompts)} prompts, async, cap={cap})…"
        )

        # Launch all prompts concurrently — semaphore limits actual parallelism
        tasks = [
            _score_single_prompt_async(
                llm_key=llm_key,
                model=cfg["model"],
                delay=cfg["rate_limit_delay"],
                prompt_id=pid,
                prompt_text=ptext,
                prompt_category=pcat,
                brand=brand,
                brand_names=brand_names,
                dry_run=dry_run,
                simulate_latency=simulate_latency,
                semaphore=sem,
            )
            for pid, ptext, pcat in prompts
        ]
        results = list(await asyncio.gather(*tasks))

        llm_score = _aggregate_llm_score(llm_key, cfg, results)
        logger.info(
            f"  [{llm_key}] AVS = {llm_score.avs:.1f}/100 "
            f"(raw {llm_score.avs_raw:.2f}/10)"
        )
        return llm_key, llm_score

    # Run all LLMs concurrently for this brand
    llm_results = await asyncio.gather(*[_score_llm(llm) for llm in llms])
    llm_scores: Dict[str, LLMScore] = dict(llm_results)

    # Aggregate across LLMs
    valid_llm_avs = [s.avs_raw for s in llm_scores.values() if s.prompts_scored > 0]
    avs_brand_raw = sum(valid_llm_avs) / len(valid_llm_avs) if valid_llm_avs else 0.0
    avs_brand = avs_brand_raw * 10

    return BrandScore(
        brand=brand.brand,
        url=brand.url,
        run_date=run_date,
        avs_brand=avs_brand,
        avs_brand_raw=avs_brand_raw,
        llm_scores=llm_scores,
    )
