"""
Parallel completion runner for the 100-brand scoring run.

This script is designed to be run repeatedly until all brands are scored.
It is idempotent: already-scored brands (per-brand JSON files present) are
skipped, and the cache handles deduplication of API calls.

Usage:
    python -m scorer.complete_run --brands brands_100.csv --run-date 2026-05-30
    python -m scorer.complete_run --brands brands_100.csv --run-date 2026-05-30 --workers 4
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


# Load .env.local
def _load_env():
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    workspace = Path(__file__).parent.parent
    for name in (".env.local", ".env"):
        f = workspace / name
        if f.exists():
            load_dotenv(f)
            break

_load_env()

from .config import LLM_CONFIGS, OUTPUT_DIR
from .csv_loader import load_brands
from .scorer import score_brand_async, PROVIDER_CONCURRENCY_CAPS
from .cost_tracker import total_cost, get_usage, reset as reset_cost

_sys = sys
_sys.stdout.reconfigure(line_buffering=True) if hasattr(_sys.stdout, "reconfigure") else None
_sys.stderr.reconfigure(line_buffering=True) if hasattr(_sys.stderr, "reconfigure") else None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stderr,
    force=True,
)
logger = logging.getLogger(__name__)

HARD_COST_LIMIT_USD = 65.0


def _check_available_llms(requested: list[str]) -> list[str]:
    key_map = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "perplexity": "PERPLEXITY_API_KEY",
    }
    available = []
    for llm in requested:
        env_var = key_map.get(llm)
        if env_var and not os.getenv(env_var):
            logger.warning(f"Skipping {llm}: {env_var} not set")
        else:
            available.append(llm)
    return available


def _load_existing_scores(output_dir: Path) -> dict[str, dict]:
    """Load all per-brand JSON files already written in output_dir."""
    scores = {}
    for f in output_dir.glob("*.json"):
        if f.name == "summary.json":
            continue
        try:
            data = json.loads(f.read_text())
            if "brand" in data and "avs_brand" in data:
                scores[data["brand"]] = data
        except Exception:
            pass
    return scores


def _write_summary(
    output_dir: Path,
    all_brand_data: list[dict],
    active_llms: list[str],
    run_date: str,
    elapsed: float,
    dry_run: bool,
    concurrency: int,
    workers: int,
    cost_breakdown: dict,
    total_cost_usd: float,
) -> Path:
    """Write summary.json from aggregated brand data."""
    summary = {
        "run_date": run_date,
        "total_brands": len(all_brand_data),
        "active_llms": active_llms,
        "elapsed_seconds": round(elapsed, 1),
        "concurrency": concurrency,
        "brand_workers": workers,
        "dry_run": dry_run,
        "total_cost_usd": round(total_cost_usd, 4),
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
                    "brand": d["brand"],
                    "url": d["url"],
                    "avs": round(d["avs_brand"], 1),
                    "avs_per_llm": {
                        k: round(v["avs"], 1)
                        for k, v in d.get("llms", {}).items()
                    },
                }
                for d in all_brand_data
            ],
            key=lambda x: x["avs"],
            reverse=True,
        ),
    }
    summary_path = output_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary_path


async def _run_parallel(
    brands_to_score,
    active_llms: list[str],
    run_date: str,
    output_dir: Path,
    dry_run: bool,
    concurrency: int,
    workers: int,
    perplexity_cap: int,
) -> list[dict]:
    """
    Score brands in parallel batches of `workers`.

    Each batch of `workers` brands runs concurrently; within each brand,
    all LLMs × prompts run concurrently via shared semaphores.
    Shared semaphores are scoped to the whole run (not per-brand) so total
    provider load is capped globally across concurrent brands.
    """
    reset_cost()

    # Per-provider semaphores — shared across all concurrent brands
    # Use elevated caps for Perplexity when running with multiple workers
    effective_perplexity_cap = min(perplexity_cap, 10)  # safety ceiling
    provider_caps = {
        "openai":     min(concurrency * workers, PROVIDER_CONCURRENCY_CAPS.get("openai", 4) * workers),
        "anthropic":  min(concurrency * workers, PROVIDER_CONCURRENCY_CAPS.get("anthropic", 4) * workers),
        "perplexity": effective_perplexity_cap,
        "google":     min(concurrency, PROVIDER_CONCURRENCY_CAPS.get("google", 2)),
    }
    semaphores = {
        llm: asyncio.Semaphore(provider_caps.get(llm, concurrency))
        for llm in active_llms
    }
    logger.info(f"Effective provider caps (across {workers} parallel brands): {provider_caps}")

    scored_data: list[dict] = []
    total = len(brands_to_score)

    async def _score_one(brand, idx: int) -> dict | None:
        current_cost = total_cost()
        if current_cost >= HARD_COST_LIMIT_USD:
            logger.error(
                f"HARD COST LIMIT ${HARD_COST_LIMIT_USD}: hit at ${current_cost:.4f}. "
                f"Skipping {brand.brand}."
            )
            return None
        logger.info(
            f"[{idx}/{total}] → {brand.brand}  [cost: ${current_cost:.4f}]"
        )
        brand_score = await score_brand_async(
            brand=brand,
            run_date=run_date,
            llms=active_llms,
            dry_run=dry_run,
            concurrency=concurrency,
            semaphores=semaphores,
        )
        brand_data = brand_score.to_dict(include_raw_responses=False)
        brand_file = output_dir / f"{brand.brand.lower().replace(' ', '_')}.json"
        brand_file.write_text(json.dumps(brand_data, ensure_ascii=False, indent=2))
        cost_now = total_cost()
        logger.info(
            f"  ✓ {brand.brand} AVS={brand_score.avs_brand:.1f}  cost=${cost_now:.4f}  → {brand_file.name}"
        )
        return brand_data

    # Process in batches of `workers`
    for batch_start in range(0, total, workers):
        batch = brands_to_score[batch_start: batch_start + workers]
        batch_indices = list(range(batch_start + 1, batch_start + len(batch) + 1))
        logger.info(
            f"── Batch {batch_start // workers + 1}: brands "
            f"{[b.brand for b in batch]} ──"
        )
        results = await asyncio.gather(
            *[_score_one(b, i) for b, i in zip(batch, batch_indices)],
            return_exceptions=False,
        )
        for r in results:
            if r is not None:
                scored_data.append(r)

        # Check cost after each batch
        if total_cost() >= HARD_COST_LIMIT_USD:
            logger.error(f"HARD COST LIMIT reached after batch. Stopping.")
            break

    return scored_data


def main():
    parser = argparse.ArgumentParser(
        description="Parallel completion runner — scores remaining unscored brands."
    )
    parser.add_argument("--brands", required=True)
    parser.add_argument(
        "--llms", nargs="+",
        choices=list(LLM_CONFIGS.keys()),
        default=["openai", "anthropic", "perplexity"],
    )
    parser.add_argument("--run-date", default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-sentiment", action="store_true")
    parser.add_argument(
        "--workers", type=int, default=4,
        help="Number of brands to score in parallel (default: 4)",
    )
    parser.add_argument(
        "--concurrency", type=int, default=4,
        help="Per-provider concurrency cap per brand (default: 4)",
    )
    parser.add_argument(
        "--perplexity-cap", type=int, default=8,
        help=(
            "Total Perplexity concurrency cap shared across all parallel brands. "
            "Default: 8 (= 4 brands × cap-2-equivalent, doubles throughput vs cap=2)."
        ),
    )
    parser.add_argument(
        "--force-rescore", action="store_true",
        help="Re-score brands that already have JSON files (default: skip them)",
    )
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR))
    args = parser.parse_args()

    if args.no_sentiment:
        os.environ["_SCORER_NO_SENTIMENT"] = "1"

    run_date = args.run_date or date.today().isoformat()
    output_dir = Path(args.output_dir) / run_date
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Loading brands from {args.brands}")
    all_brands = load_brands(args.brands)
    logger.info(f"Loaded {len(all_brands)} brands")

    active_llms = args.llms if args.dry_run else _check_available_llms(args.llms)
    if not active_llms:
        logger.error("No LLMs available. Exiting.")
        sys.exit(1)
    logger.info(f"Active LLMs: {', '.join(active_llms)}")

    # ── Check which brands are already scored ────────────────────────────────
    existing = _load_existing_scores(output_dir)
    logger.info(f"Already scored in {output_dir.name}: {len(existing)}/{len(all_brands)} brands")

    if args.force_rescore:
        brands_to_score = all_brands
    else:
        already_done = set(existing.keys())
        brands_to_score = [b for b in all_brands if b.brand not in already_done]
        if not brands_to_score:
            logger.info("All brands already scored! Assembling final summary.json…")
        else:
            logger.info(
                f"Remaining to score: {len(brands_to_score)} brands "
                f"({[b.brand for b in brands_to_score[:5]]}{'...' if len(brands_to_score) > 5 else ''})"
            )

    t_start = time.monotonic()

    if brands_to_score:
        new_data = asyncio.run(
            _run_parallel(
                brands_to_score=brands_to_score,
                active_llms=active_llms,
                run_date=run_date,
                output_dir=output_dir,
                dry_run=args.dry_run,
                concurrency=args.concurrency,
                workers=args.workers,
                perplexity_cap=args.perplexity_cap,
            )
        )
        # Merge with existing
        for d in new_data:
            existing[d["brand"]] = d
    else:
        new_data = []

    elapsed = time.monotonic() - t_start
    final_cost = total_cost()
    cost_breakdown = get_usage()

    # ── Assemble summary.json from all brand data ────────────────────────────
    all_brand_data = list(existing.values())
    missing = [b.brand for b in all_brands if b.brand not in existing]
    if missing:
        logger.warning(
            f"INCOMPLETE: {len(missing)} brands still missing from output: {missing[:10]}"
        )
    else:
        logger.info(f"All {len(all_brands)} brands scored. Writing summary.json…")

    summary_path = _write_summary(
        output_dir=output_dir,
        all_brand_data=all_brand_data,
        active_llms=active_llms,
        run_date=run_date,
        elapsed=elapsed,
        dry_run=args.dry_run,
        concurrency=args.concurrency,
        workers=args.workers,
        cost_breakdown=cost_breakdown,
        total_cost_usd=final_cost,
    )

    # ── Print leaderboard ────────────────────────────────────────────────────
    summary = json.loads(summary_path.read_text())
    print("\n" + "=" * 65)
    print(f"  NeuralReach AI Visibility Score — {run_date}")
    print(f"  ({len(all_brand_data)}/{len(all_brands)} brands scored)")
    print("=" * 65)
    print(f"  {'Brand':<22} {'AVS':>6}  {'LLM breakdown'}")
    print("-" * 65)
    for entry in summary["brands"]:
        llm_str = "  ".join(
            f"{k.upper()[:4]}={v}" for k, v in entry["avs_per_llm"].items()
        )
        print(f"  {entry['brand']:<22} {entry['avs']:>5.1f}  {llm_str}")
    print("=" * 65)
    print(f"  Output: {output_dir}")
    print(f"  Elapsed: {elapsed:.1f}s  (workers={args.workers}, concurrency={args.concurrency})")
    print(f"  Cost this session: ${final_cost:.4f} USD")
    for llm_k, u in cost_breakdown.items():
        print(
            f"    {llm_k}: {u['requests']} reqs, "
            f"{u['input_tokens']}+{u['output_tokens']} tok → ${u['cost_usd']:.4f}"
        )
    if missing:
        print(f"\n  ⚠ Still missing: {missing}")
        print("  Re-run this script to score remaining brands (cache handles deduplication).")
    else:
        print(f"\n  ✅ Complete! summary.json has all {len(all_brands)} brands.")
    print()


if __name__ == "__main__":
    main()
