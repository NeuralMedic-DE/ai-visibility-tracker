"""
CLI entry point for the NeuralReach scorer.

Usage:
    python -m scorer.run --brands sample.csv
    python -m scorer.run --brands sample.csv --llms openai anthropic
    python -m scorer.run --brands sample.csv --dry-run
    python -m scorer.run --brands sample.csv --no-sentiment
    python -m scorer.run --brands sample.csv --concurrency 4
    python -m scorer.run --brands sample.csv --dry-run --simulate-latency 0.5
"""
from __future__ import annotations
import argparse
import asyncio
import json
import logging
import os
import sys
import time
from datetime import date
from pathlib import Path

# Load .env.local from workspace root before anything else
def _load_env():
    try:
        from dotenv import load_dotenv
    except ImportError:
        print("Warning: python-dotenv not installed. Using system env vars only.")
        return
    workspace = Path(__file__).parent.parent
    env_file = workspace / ".env.local"
    if env_file.exists():
        load_dotenv(env_file)
    else:
        # Fallback: try .env
        load_dotenv(workspace / ".env")

_load_env()

from .config import LLM_CONFIGS, OUTPUT_DIR
from .csv_loader import load_brands
from .scorer import score_brand_async, PROVIDER_CONCURRENCY_CAPS
from .cache import cache_stats
from .cost_tracker import total_cost, get_usage, reset as reset_cost


import sys as _sys
# Force unbuffered output — critical when stderr is redirected to a file
_sys.stdout.reconfigure(line_buffering=True) if hasattr(_sys.stdout, "reconfigure") else None
_sys.stderr.reconfigure(line_buffering=True) if hasattr(_sys.stderr, "reconfigure") else None

_stderr_handler = logging.StreamHandler(_sys.stderr)
_stderr_handler.setFormatter(logging.Formatter(
    fmt="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
))
logging.basicConfig(
    level=logging.INFO,
    handlers=[_stderr_handler],
    force=True,
)
logger = logging.getLogger(__name__)


def _check_available_llms(requested: list[str]) -> list[str]:
    """Filter out LLMs whose API keys are missing, warn for each."""
    available = []
    key_map = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "perplexity": "PERPLEXITY_API_KEY",
        "google": "SERPAPI_KEY",
    }
    for llm in requested:
        env_var = key_map.get(llm)
        if env_var and not os.getenv(env_var):
            logger.warning(f"Skipping {llm}: {env_var} not set")
        else:
            available.append(llm)
    return available


async def _run_async(
    brands,
    active_llms: list[str],
    run_date: str,
    output_dir: Path,
    dry_run: bool,
    concurrency: int,
    simulate_latency: float,
    include_raw: bool,
) -> tuple[list, float]:
    """
    Async runner: brands are processed sequentially (preserves cost guard),
    but each brand's LLMs × prompts run concurrently via per-provider semaphores.

    Semaphores are shared across brands so total provider concurrency is capped
    globally — e.g., we never have >4 simultaneous OpenAI calls even across brands.
    """
    HARD_COST_LIMIT_USD = 65.0
    reset_cost()

    all_scores = []
    t_start = time.monotonic()

    # Create semaphores once, shared across all brands
    semaphores = {
        llm: asyncio.Semaphore(
            min(concurrency, PROVIDER_CONCURRENCY_CAPS.get(llm, concurrency))
        )
        for llm in active_llms
    }
    caps = {llm: min(concurrency, PROVIDER_CONCURRENCY_CAPS.get(llm, concurrency))
            for llm in active_llms}
    logger.info(f"Concurrency caps: { {k: v for k, v in caps.items()} }")

    for i, brand in enumerate(brands, start=1):
        # Check cumulative cost before each brand (cost guard)
        current_cost = total_cost()
        if current_cost >= HARD_COST_LIMIT_USD:
            logger.error(
                f"HARD COST LIMIT REACHED: ${current_cost:.4f} >= ${HARD_COST_LIMIT_USD:.2f}. "
                f"Stopping after {i-1} brands."
            )
            break

        logger.info(
            f"[{i}/{len(brands)}] Scoring: {brand.brand} ({brand.url})  "
            f"[cumulative cost: ${current_cost:.4f}]"
        )
        brand_score = await score_brand_async(
            brand=brand,
            run_date=run_date,
            llms=active_llms,
            dry_run=dry_run,
            concurrency=concurrency,
            simulate_latency=simulate_latency,
            semaphores=semaphores,
        )

        # Write per-brand JSON
        brand_file = output_dir / f"{brand.brand.lower().replace(' ', '_')}.json"
        with open(brand_file, "w", encoding="utf-8") as f:
            json.dump(
                brand_score.to_dict(include_raw_responses=include_raw),
                f,
                ensure_ascii=False,
                indent=2,
            )
        cost_now = total_cost()
        logger.info(
            f"  → AVS = {brand_score.avs_brand:.1f}/100 | "
            f"cost so far: ${cost_now:.4f} | saved to {brand_file}"
        )
        all_scores.append(brand_score)

    return all_scores, time.monotonic() - t_start


def main():
    parser = argparse.ArgumentParser(
        description="NeuralReach AI Visibility Scorer — score brands across multiple LLMs"
    )
    parser.add_argument(
        "--brands",
        required=True,
        help="Path to CSV file with brand profiles",
    )
    parser.add_argument(
        "--llms",
        nargs="+",
        choices=list(LLM_CONFIGS.keys()),
        default=list(LLM_CONFIGS.keys()),
        help="LLMs to query (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip API calls; use mock responses (for testing pipeline)",
    )
    parser.add_argument(
        "--no-sentiment",
        action="store_true",
        help="Disable LLM-based sentiment (use keyword fallback only)",
    )
    parser.add_argument(
        "--output-dir",
        default=str(OUTPUT_DIR),
        help=f"Output directory (default: {OUTPUT_DIR})",
    )
    parser.add_argument(
        "--include-raw",
        action="store_true",
        help="Include raw LLM responses in output JSON",
    )
    parser.add_argument(
        "--run-date",
        default=None,
        help="Override run date (ISO format YYYY-MM-DD, default: today)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=4,
        help=(
            "Max concurrent API calls per provider (default: 4). "
            "Per-provider hard caps: openai=4, anthropic=4, perplexity=2, google=2. "
            "Effective concurrency = min(--concurrency, per-provider cap)."
        ),
    )
    parser.add_argument(
        "--simulate-latency",
        type=float,
        default=0.0,
        metavar="SECONDS",
        help=(
            "Simulate API latency in dry-run mode (seconds per call). "
            "Useful for benchmarking async speedup without real API keys. "
            "Default: 0.0 (no simulation)."
        ),
    )
    args = parser.parse_args()

    # Validate concurrency range
    if args.concurrency < 1 or args.concurrency > 20:
        parser.error("--concurrency must be between 1 and 20")

    # Override sentiment LLM with keyword-only if requested
    if args.no_sentiment:
        os.environ["_SCORER_NO_SENTIMENT"] = "1"

    run_date = args.run_date if args.run_date else date.today().isoformat()
    output_dir = Path(args.output_dir) / run_date
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Load brands ────────────────────────────────────────────────────────────
    logger.info(f"Loading brands from {args.brands}")
    brands = load_brands(args.brands)
    logger.info(f"Loaded {len(brands)} brand(s)")

    # ── Check API keys ─────────────────────────────────────────────────────────
    active_llms = args.llms if args.dry_run else _check_available_llms(args.llms)
    if not active_llms:
        logger.error("No LLMs available (all API keys missing). Exiting.")
        sys.exit(1)
    logger.info(f"Active LLMs: {', '.join(active_llms)}")

    # ── Cache info ─────────────────────────────────────────────────────────────
    stats = cache_stats()
    logger.info(f"Cache: {stats['total_cached']} entries on disk")

    # ── Run async scorer ───────────────────────────────────────────────────────
    all_scores, elapsed = asyncio.run(
        _run_async(
            brands=brands,
            active_llms=active_llms,
            run_date=run_date,
            output_dir=output_dir,
            dry_run=args.dry_run,
            concurrency=args.concurrency,
            simulate_latency=args.simulate_latency,
            include_raw=args.include_raw,
        )
    )

    # ── Write summary JSON ─────────────────────────────────────────────────────
    final_cost = total_cost()
    cost_breakdown = get_usage()
    summary = {
        "run_date": run_date,
        "total_brands": len(all_scores),
        "active_llms": active_llms,
        "elapsed_seconds": round(elapsed, 1),
        "concurrency": args.concurrency,
        "dry_run": args.dry_run,
        "total_cost_usd": round(final_cost, 4),
        "cost_breakdown": {
            k: {
                "requests": v["requests"],
                "input_tokens": v["input_tokens"],
                "output_tokens": v["output_tokens"],
                "cost_usd": round(v["cost_usd"], 4),
            }
            for k, v in cost_breakdown.items()
        },
        "brands": sorted(
            [
                {
                    "brand": s.brand,
                    "url": s.url,
                    "avs": round(s.avs_brand, 1),
                    "avs_per_llm": {
                        k: round(v.avs, 1) for k, v in s.llm_scores.items()
                    },
                }
                for s in all_scores
            ],
            key=lambda x: x["avs"],
            reverse=True,
        ),
    }

    summary_file = output_dir / "summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # ── Print leaderboard to stdout ────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"  NeuralReach AI Visibility Score — {run_date}")
    print("=" * 60)
    print(f"  {'Brand':<20} {'AVS':>6}  {'LLM breakdown'}")
    print("-" * 60)
    for entry in summary["brands"]:
        llm_str = "  ".join(
            f"{k.upper()[:4]}={v}" for k, v in entry["avs_per_llm"].items()
        )
        print(f"  {entry['brand']:<20} {entry['avs']:>5.1f}  {llm_str}")
    print("=" * 60)
    print(f"  Output: {output_dir}")
    print(f"  Elapsed: {elapsed:.1f}s  (concurrency={args.concurrency})")
    print(f"  Total cost: ${final_cost:.4f} USD")
    for llm_k, u in cost_breakdown.items():
        print(f"    {llm_k}: {u['requests']} reqs, {u['input_tokens']}+{u['output_tokens']} tok → ${u['cost_usd']:.4f}")
    print()


if __name__ == "__main__":
    main()
