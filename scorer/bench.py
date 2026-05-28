#!/usr/bin/env python3
"""
NeuralReach Parallelism Benchmark
==================================
Compares sequential vs async scoring wall-clock time using simulated API latency
(--simulate-latency N) so the benchmark runs offline without real API keys.

Usage:
    # From workspace root:
    python -m scorer.bench --brands sample.csv

    # Full benchmark with custom settings:
    python -m scorer.bench --brands sample.csv \\
        --simulate-latency 0.5 --concurrency 4 \\
        --brands-count 5 --llms openai anthropic perplexity

    # Quick smoke-test (tiny latency):
    python -m scorer.bench --brands sample.csv --simulate-latency 0.05

Implementation notes
--------------------
* The benchmark monkeypatches get_cached() → always-None to force the simulated-
  latency code path (otherwise real cached LLM responses skip the sleep entirely).
* Sets _SCORER_NO_SENTIMENT=1 so that cached real responses don't trigger live
  OpenAI sentiment API calls that would contaminate timing.
* Neither change affects production scoring behavior.
"""
from __future__ import annotations
import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

# ── Isolate the benchmark from real API side-effects ──────────────────────────
# Must happen BEFORE any scorer imports that read env vars at import time.
os.environ["_SCORER_NO_SENTIMENT"] = "1"   # keyword-only sentiment, no OpenAI call

# Ensure workspace root is on the path when run as a script
_workspace = Path(__file__).parent.parent
if str(_workspace) not in sys.path:
    sys.path.insert(0, str(_workspace))


def _load_env() -> None:
    try:
        from dotenv import load_dotenv
        env = _workspace / ".env.local"
        if env.exists():
            load_dotenv(env)
    except ImportError:
        pass


def _load_brands(csv_path: str, n: int):
    from scorer.csv_loader import load_brands
    brands = load_brands(csv_path)
    return brands[:n]


def _patch_cache_off():
    """
    Monkeypatch scorer.cache.get_cached to always return None.

    This forces all calls through the semaphore + simulate_latency path,
    even when the on-disk cache has entries for these brands.
    Without this, cached real LLM responses bypass the simulated sleep entirely,
    making the benchmark measure parse/sentiment overhead rather than scheduling.
    """
    import scorer.cache as _cache_mod
    _orig = _cache_mod.get_cached

    def _always_miss(*args, **kwargs):
        return None

    _cache_mod.get_cached = _always_miss
    return _orig  # caller restores if desired


def _run_sequential(brands, llms: list[str], simulate_latency: float, run_date: str):
    """Run the sync scorer sequentially (current baseline)."""
    from scorer.scorer import score_brand
    results = []
    for brand in brands:
        score = score_brand(
            brand,
            run_date,
            llms=llms,
            dry_run=True,
            simulate_latency=simulate_latency,
        )
        results.append(score)
    return results


async def _run_async(brands, llms: list[str], simulate_latency: float,
                     concurrency: int, run_date: str):
    """Run the async scorer (new parallel path)."""
    from scorer.scorer import score_brand_async, PROVIDER_CONCURRENCY_CAPS

    # Shared semaphores across brands — same as production run.py
    semaphores = {
        llm: asyncio.Semaphore(
            min(concurrency, PROVIDER_CONCURRENCY_CAPS.get(llm, concurrency))
        )
        for llm in llms
    }
    results = []
    for brand in brands:
        score = await score_brand_async(
            brand,
            run_date,
            llms=llms,
            dry_run=True,
            concurrency=concurrency,
            simulate_latency=simulate_latency,
            semaphores=semaphores,
        )
        results.append(score)
    return results


def _project_100_brands(
    speedup: float,
    n_llms: int,
    avg_call_seconds: float = 1.8,
) -> dict:
    """
    Project wall-clock for a 100-brand, 25-prompt run at real API latency.

    avg_call_seconds includes both API response time and the rate-limit delay.
    Empirical estimates (as of 2026-05):
      openai (gpt-4o):   ~1.5s call + 1.0s delay = 2.5s/prompt
      anthropic (haiku): ~0.5s call + 0.5s delay = 1.0s/prompt
      perplexity (sonar): ~1.5s call + 1.5s delay = 3.0s/prompt
    Blended avg ≈ 1.8s — conservative figure used for projection.
    """
    total_calls = 100 * n_llms * 25
    sequential_s = total_calls * avg_call_seconds
    async_s = sequential_s / speedup if speedup > 0 else sequential_s
    return {
        "total_calls": total_calls,
        "avg_call_s": avg_call_seconds,
        "sequential_hours": round(sequential_s / 3600, 2),
        "async_hours": round(async_s / 3600, 2),
        "under_5h_target": async_s < 5 * 3600,
    }


def main():
    parser = argparse.ArgumentParser(
        description="NeuralReach parallelism benchmark (dry-run with simulated latency)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--brands", required=True,
                        help="Path to brands CSV file")
    parser.add_argument("--brands-count", type=int, default=5,
                        help="Number of brands to benchmark (uses first N rows)")
    parser.add_argument("--llms", nargs="+",
                        default=["openai", "anthropic", "perplexity"],
                        help="LLM providers to include")
    parser.add_argument("--simulate-latency", type=float, default=0.5,
                        metavar="SECONDS",
                        help="Simulated API call duration per prompt slot")
    parser.add_argument("--concurrency", type=int, default=4,
                        help="Global concurrency cap for async run")
    parser.add_argument("--avg-real-call", type=float, default=1.8,
                        metavar="SECONDS",
                        help="Avg real API call+delay time for 100-brand projection")
    parser.add_argument("--output-json", default=None,
                        help="Write benchmark results to this JSON file")
    args = parser.parse_args()

    _load_env()

    # ── Disable cache: force simulate_latency path for all calls ──────────────
    _patch_cache_off()

    run_date = "2026-05-28"
    brands = _load_brands(args.brands, args.brands_count)
    n_brands = len(brands)
    n_llms = len(args.llms)
    n_prompts = 25
    total_simulated_calls = n_brands * n_llms * n_prompts

    # Theoretical expected times (for sanity-checking results)
    from scorer.scorer import PROVIDER_CONCURRENCY_CAPS
    t_seq_expected = total_simulated_calls * args.simulate_latency

    def _expected_async_per_brand(llm_list, concurrency, latency):
        """Expected wall-clock per brand: max(LLM times), where each LLM time
        = ceil(25 / cap) * latency."""
        import math
        times = []
        for llm in llm_list:
            cap = min(concurrency, PROVIDER_CONCURRENCY_CAPS.get(llm, concurrency))
            rounds = math.ceil(n_prompts / cap)
            times.append(rounds * latency)
        return max(times)

    t_async_expected = n_brands * _expected_async_per_brand(
        args.llms, args.concurrency, args.simulate_latency
    )

    print()
    print("=" * 64)
    print("  NeuralReach Parallelism Benchmark")
    print("=" * 64)
    print(f"  Brands:            {n_brands}  ({', '.join(b.brand for b in brands)})")
    print(f"  LLMs:              {', '.join(args.llms)}")
    print(f"  Prompts per brand: {n_prompts}")
    print(f"  Total sim calls:   {total_simulated_calls}")
    print(f"  Simulated latency: {args.simulate_latency}s/slot")
    print(f"  Concurrency:       {args.concurrency}")
    from scorer.scorer import PROVIDER_CONCURRENCY_CAPS as CAPS
    caps = {llm: min(args.concurrency, CAPS.get(llm, args.concurrency)) for llm in args.llms}
    print(f"  Effective caps:    { {k: v for k, v in caps.items()} }")
    print(f"  Cache:             DISABLED (forced misses for clean benchmark)")
    print(f"  Sentiment:         keyword-only (no real API calls)")
    print()

    # ── Sequential baseline ────────────────────────────────────────────────────
    print("▶  Running SEQUENTIAL baseline…", flush=True)
    t0 = time.monotonic()
    _run_sequential(brands, args.llms, args.simulate_latency, run_date)
    t_seq = time.monotonic() - t0
    seq_ok = abs(t_seq - t_seq_expected) / max(t_seq_expected, 0.001) < 0.35
    print(f"   Sequential wall-clock: {t_seq:.2f}s  (expected ≈{t_seq_expected:.1f}s  "
          f"{'✓' if seq_ok else 'WARN: deviation >35%'})")

    # ── Async parallel ─────────────────────────────────────────────────────────
    print(f"\n▶  Running ASYNC (concurrency={args.concurrency})…", flush=True)
    t0 = time.monotonic()
    asyncio.run(
        _run_async(brands, args.llms, args.simulate_latency, args.concurrency, run_date)
    )
    t_async = time.monotonic() - t0
    async_ok = abs(t_async - t_async_expected) / max(t_async_expected, 0.001) < 0.35
    print(f"   Async wall-clock:      {t_async:.2f}s  (expected ≈{t_async_expected:.1f}s  "
          f"{'✓' if async_ok else 'WARN: deviation >35%'})")

    # ── Speedup ────────────────────────────────────────────────────────────────
    speedup = t_seq / t_async if t_async > 1e-6 else float("inf")
    target_met = speedup >= 3.0

    print()
    print("-" * 64)
    print(f"  Speedup:  {speedup:.1f}×  ({'✓ ≥3× target met' if target_met else '✗ below 3× target'})")
    print("-" * 64)

    # ── 100-brand projection ───────────────────────────────────────────────────
    proj = _project_100_brands(speedup, n_llms, args.avg_real_call)
    print()
    print("  100-brand projection (real API, avg "
          f"{args.avg_real_call}s/call per provider):")
    print(f"    Sequential:      {proj['sequential_hours']:.1f} hours  "
          f"({proj['total_calls']:,} calls × {args.avg_real_call}s)")
    print(f"    Async (×{speedup:.1f}): {proj['async_hours']:.2f} hours")
    print(f"    Under 5-hour target: {'✓ YES' if proj['under_5h_target'] else '✗ NO'}")

    # ── Rate-limit warnings observed ───────────────────────────────────────────
    # (In dry-run mode, no real rate-limit errors are expected)
    print()
    print("  Rate-limit warnings: none (dry-run benchmark, no real API calls)")

    # ── Results dict ───────────────────────────────────────────────────────────
    results = {
        "benchmark_date": run_date,
        "config": {
            "brands": n_brands,
            "brand_names": [b.brand for b in brands],
            "llms": args.llms,
            "prompts_per_brand": n_prompts,
            "total_simulated_calls": total_simulated_calls,
            "simulate_latency_s": args.simulate_latency,
            "concurrency": args.concurrency,
            "effective_caps": caps,
        },
        "timings": {
            "sequential_s": round(t_seq, 3),
            "async_s": round(t_async, 3),
            "expected_sequential_s": round(t_seq_expected, 1),
            "expected_async_s": round(t_async_expected, 1),
            "speedup_x": round(speedup, 2),
            "target_met_3x": target_met,
        },
        "projection_100_brands": proj,
        "rate_limit_warnings": 0,
    }

    print()
    if args.output_json:
        out = Path(args.output_json)
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w") as f:
            json.dump(results, f, indent=2)
        print(f"  Results written to: {out}")

    return results


if __name__ == "__main__":
    main()
