"""
Per-customer scoring entrypoint.

Usage:
    python -m scorer.run_for_customer --customer-id <uuid>
    python -m scorer.run_for_customer --customer-id <uuid> --dry-run
    python -m scorer.run_for_customer --customer-id <uuid> --llms openai anthropic

Reads:
    - tracked_brands row for the customer
    - customers row (to determine plan tier for fix_report_md)

Writes:
    - customer_scoring_runs row (upserted by run_date)

For Pro customers, also generates fix_report_md via claude-haiku-4-5 call.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

# ── Load .env.local before anything else ──────────────────────────────────────
def _load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    workspace = Path(__file__).parent.parent
    env_file = workspace / ".env.local"
    if env_file.exists():
        load_dotenv(env_file, override=False)
    else:
        load_dotenv(workspace / ".env", override=False)


_load_env()

# ── Imports (after env load) ──────────────────────────────────────────────────
from .config import LLM_CONFIGS, PLAN_PROMPT_LIMITS, PROMPT_TEMPLATES
from .models import BrandProfile, BrandScore
from .scorer import score_brand_async, PROVIDER_CONCURRENCY_CAPS
from .cost_tracker import total_cost, get_usage, reset as reset_cost

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stderr,
)


# ── Cost / quota constants ────────────────────────────────────────────────────

# Daily global spend ceiling (across ALL customers). Configurable via env var.
# Default $15 keeps a 30-customer day well under a $50 monthly API budget.
GLOBAL_DAILY_COST_LIMIT_USD = float(
    os.environ.get("SCORER_DAILY_COST_LIMIT_USD", "15.0")
)

# Approximate cost per scoring run by plan (USD). Used for the circuit-breaker
# pre-check and for recording estimated_cost_usd in customer_scoring_runs.
# Formula: prompts × LLMs × blended_cost_per_call
#   starter: 25 × 4 × ~$0.004 ≈ $0.40
#   pro:    100 × 4 × ~$0.004 ≈ $1.60
_ESTIMATED_RUN_COST: dict[str, float] = {
    "starter": 0.50,
    "pro": 2.00,
}

# ── Supabase REST helpers ─────────────────────────────────────────────────────

def _supa_headers() -> Dict[str, str]:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _supa_url(table: str) -> str:
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    return f"{base}/rest/v1/{table}"


def _get_row(table: str, filters: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """Fetch the first matching row from a Supabase table via REST."""
    import requests

    params: Dict[str, str] = {}
    for col, val in filters.items():
        params[col] = f"eq.{val}"
    params["limit"] = "1"

    resp = requests.get(_supa_url(table), headers=_supa_headers(), params=params)
    resp.raise_for_status()
    rows = resp.json()
    return rows[0] if rows else None


def _get_rows(table: str, filters: Dict[str, str], select: str = "*") -> List[Dict[str, Any]]:
    """Fetch all matching rows from a Supabase table via REST."""
    import requests

    params: Dict[str, str] = {"select": select}
    for col, val in filters.items():
        params[col] = f"eq.{val}"

    resp = requests.get(_supa_url(table), headers=_supa_headers(), params=params)
    resp.raise_for_status()
    return resp.json() or []


def _check_daily_spend_limit(today: str) -> None:
    """
    Query today's recorded spend from customer_scoring_runs.estimated_cost_usd.
    Raises RuntimeError if the global daily limit would be exceeded.

    Defensive: if the column doesn't exist yet (pre-migration), skip the check.
    """
    import requests
    try:
        params = {
            "select": "estimated_cost_usd",
            "run_date": f"eq.{today}",
        }
        resp = requests.get(
            _supa_url("customer_scoring_runs"),
            headers=_supa_headers(),
            params=params,
        )
        if resp.status_code == 400:
            # Column likely doesn't exist yet — migration pending. Skip check.
            logger.warning(
                "daily-spend check skipped: estimated_cost_usd column not found "
                "(run migration 0012_quota_controls)"
            )
            return
        resp.raise_for_status()
        rows = resp.json() or []
        daily_spent = sum(
            float(r.get("estimated_cost_usd") or 0) for r in rows
        )
        if daily_spent >= GLOBAL_DAILY_COST_LIMIT_USD:
            raise RuntimeError(
                f"Global daily spend limit reached: "
                f"${daily_spent:.2f} >= ${GLOBAL_DAILY_COST_LIMIT_USD:.2f}. "
                f"Scoring suspended until tomorrow. Set SCORER_DAILY_COST_LIMIT_USD "
                f"to increase the limit."
            )
        logger.info(
            f"Daily spend check OK: ${daily_spent:.2f} / ${GLOBAL_DAILY_COST_LIMIT_USD:.2f}"
        )
    except RuntimeError:
        raise
    except Exception as exc:
        # Non-fatal: log and continue rather than blocking legitimate runs
        logger.warning(f"Daily spend check failed (non-fatal): {exc}")


def _upsert_row(table: str, data: Dict[str, Any], on_conflict: str) -> None:
    """Upsert a row into a Supabase table via REST."""
    import requests

    headers = {**_supa_headers(), "Prefer": f"resolution=merge-duplicates,return=minimal"}
    resp = requests.post(
        _supa_url(table),
        headers=headers,
        params={"on_conflict": on_conflict},
        json=data,
    )
    if resp.status_code not in (200, 201, 204):
        raise RuntimeError(
            f"Supabase upsert failed ({resp.status_code}): {resp.text[:300]}"
        )


# ── BrandProfile construction ─────────────────────────────────────────────────

def _build_brand_profile(tb: Dict[str, Any]) -> BrandProfile:
    """
    Construct a BrandProfile from a tracked_brands row.
    Fields that the customer didn't fill in get sensible defaults.
    """
    brand_name: str = tb["brand_name"]
    brand_url: str = tb["brand_url"]
    competitors: List[Dict[str, str]] = tb.get("competitors") or []

    # Derive defaults from brand name / URL when optional fields are absent
    category: str = tb.get("category") or "SaaS tool"
    category_lower = category.lower()
    category_long: str = (
        category if "software" in category_lower or "tool" in category_lower
        else f"{category} software"
    )
    segment: str = tb.get("segment") or "B2B SaaS companies"

    # Competitors — use up to 2 for template vars
    comp_names = [c.get("name", "") for c in competitors if c.get("name")]
    competitor_1: str = comp_names[0] if len(comp_names) >= 1 else "leading vendors"
    competitor_2: str = comp_names[1] if len(comp_names) >= 2 else "established alternatives"

    # Use-cases derived from category
    use_case_1: str = tb.get("use_case_1") or f"manage {category_lower} workflows"
    use_case_2: str = tb.get("use_case_2") or "scale operations efficiently"

    # Integrations — sensible defaults that appear in many B2B stacks
    integration_1: str = tb.get("integration_1") or "Slack"
    integration_2: str = tb.get("integration_2") or "HubSpot"

    # Role
    role: str = tb.get("role_title") or "head of growth"

    return BrandProfile(
        brand=brand_name,
        url=brand_url,
        category=category,
        category_long=category_long,
        segment=segment,
        competitor_1=competitor_1,
        competitor_2=competitor_2,
        use_case_1=use_case_1,
        use_case_2=use_case_2,
        integration_1=integration_1,
        integration_2=integration_2,
        role=role,
        aliases=[],
    )


# ── Gap extraction ─────────────────────────────────────────────────────────────

def _extract_gap_prompts(brand_score: BrandScore) -> List[Dict[str, Any]]:
    """
    Return the top 3 prompts where the brand had presence=False across
    the most LLMs, sorted by total LLM misses descending.
    Each entry: {prompt_id, prompt_text, category, llms_missed: [str]}
    """
    # Map prompt_id → {text, category, llms_missed}
    gap_map: Dict[str, Dict[str, Any]] = {}

    for llm_key, llm_score in brand_score.llm_scores.items():
        for pr in llm_score.prompt_results:
            if pr.error:
                continue
            if not pr.presence:
                if pr.prompt_id not in gap_map:
                    gap_map[pr.prompt_id] = {
                        "prompt_id": pr.prompt_id,
                        "prompt_text": pr.prompt_text,
                        "category": pr.prompt_category,
                        "llms_missed": [],
                    }
                gap_map[pr.prompt_id]["llms_missed"].append(llm_key)

    # Sort by number of LLMs that missed (desc), then prompt_id for stability
    sorted_gaps = sorted(
        gap_map.values(),
        key=lambda g: (-len(g["llms_missed"]), g["prompt_id"]),
    )
    return sorted_gaps[:3]


# ── Fix report generation (Pro only) ─────────────────────────────────────────

FIX_REPORT_SYSTEM = """You are an AI visibility expert. Your job is to generate
a concrete, actionable fix report for a B2B SaaS brand that is missing from
AI search results on ChatGPT, Perplexity, Claude, and Google AI Overviews.

Focus on:
1. Structured data / schema.org markup (FAQPage, SoftwareApplication, Product)
2. Content gaps — what specific pages, blog posts, or docs are missing
3. Entity authority — Wikipedia presence, Wikidata, Crunchbase, G2 reviews
4. Prompt-specific recommendations for each gap prompt provided

Be specific, practical, and concise. Use markdown with ## headers and bullet lists."""


def _generate_fix_report(
    brand_name: str,
    brand_url: str,
    gap_prompts: List[Dict[str, Any]],
    avs_brand: float,
    per_llm: Dict[str, float],
) -> str:
    """Call claude-haiku-4-5 to generate a fix report. Returns markdown string."""
    try:
        import anthropic

        client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
            timeout=60.0,
        )

        # Build gap summary for the prompt
        gap_lines = []
        for g in gap_prompts:
            missed = ", ".join(g.get("llms_missed", []))
            gap_lines.append(
                f'- Prompt: "{g["prompt_text"]}" (category: {g["category"]})\n'
                f'  Missed by: {missed or "all LLMs"}'
            )
        gap_summary = "\n".join(gap_lines) if gap_lines else "No specific gaps identified."

        per_llm_lines = "\n".join(
            f"  - {k}: {v:.1f}/100" for k, v in per_llm.items()
        )

        user_prompt = f"""Brand: {brand_name}
Website: {brand_url}
Overall AI Visibility Score (AVS): {avs_brand:.1f}/100

Per-LLM scores:
{per_llm_lines}

Top gap prompts (where the brand was NOT mentioned):
{gap_summary}

Generate a focused Fix Report in markdown that explains exactly what this brand
should do to improve its AI search visibility. Structure it as:

## Overall Assessment
Brief 2-3 sentence summary of the visibility gap.

## Quick Wins (implement in 1-2 weeks)
3-5 specific, actionable items.

## Content & Entity Authority
What content to create and where to build citations.

## Prompt-Specific Fixes
For each gap prompt above, one concrete recommendation.

## Schema Markup
Specific schema.org types and properties to add.

Keep the total report under 500 words. Be direct and specific."""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=FIX_REPORT_SYSTEM,
            messages=[{"role": "user", "content": user_prompt}],
        )
        if message.content:
            return message.content[0].text
        return "Fix report generation returned empty response."

    except Exception as e:
        logger.warning(f"Fix report generation failed: {e}")
        return f"*Fix report unavailable — generation error: {e}*"


# ── Main runner ────────────────────────────────────────────────────────────────

async def run_for_customer(
    customer_id: str,
    llms: Optional[List[str]] = None,
    dry_run: bool = False,
) -> None:
    logger.info(f"Starting scoring run for customer_id={customer_id}")

    # 1. Load customer row
    customer = _get_row("customers", {"id": customer_id})
    if not customer:
        raise RuntimeError(f"No customer found with id={customer_id}")

    plan: str = customer.get("plan") or "starter"
    logger.info(f"Customer plan: {plan}")

    # 2. Resolve per-plan prompt limit
    prompt_limit: int = PLAN_PROMPT_LIMITS.get(plan, 25)
    logger.info(
        f"Prompt quota for plan={plan!r}: {prompt_limit} prompts "
        f"(PLAN_PROMPT_LIMITS={PLAN_PROMPT_LIMITS})"
    )

    # 3. Check subscription status — must be active or trialing with a payment method
    sub_status: str = customer.get("subscription_status") or "none"
    if sub_status not in ("active", "trialing"):
        raise RuntimeError(
            f"Customer {customer_id} subscription_status={sub_status!r} — "
            "only 'active' or 'trialing' subscriptions may run the scorer."
        )

    run_date_str = date.today().isoformat()

    # 4. Global daily spend circuit-breaker
    _check_daily_spend_limit(run_date_str)

    # 5. Load tracked_brands row
    tb = _get_row("tracked_brands", {"customer_id": customer_id})
    if not tb:
        raise RuntimeError(
            f"No tracked brand found for customer_id={customer_id}. "
            "The customer must complete onboarding first."
        )

    logger.info(f"Brand: {tb['brand_name']} ({tb['brand_url']})")

    # 6. Build BrandProfile
    brand_profile = _build_brand_profile(tb)

    # 7. Run scorer — reset cost tracker so this run's cost is isolated
    if llms is None:
        llms = list(LLM_CONFIGS.keys())

    reset_cost()
    logger.info(
        f"Running async scorer for {brand_profile.brand} "
        f"| plan={plan} | prompts={prompt_limit} | llms={llms} | dry_run={dry_run}"
    )
    brand_score: BrandScore = await score_brand_async(
        brand=brand_profile,
        run_date=run_date_str,
        llms=llms,
        dry_run=dry_run,
        concurrency=4,
        prompt_limit=prompt_limit,
    )
    actual_cost_usd = round(total_cost(), 4)
    logger.info(
        f"Scoring complete. AVS={brand_score.avs_brand:.1f}/100 "
        f"| actual_cost=${actual_cost_usd:.4f}"
    )

    # 8. Build per_llm map (key → avs score 0-100)
    per_llm: Dict[str, float] = {
        llm_key: round(llm_score.avs, 1)
        for llm_key, llm_score in brand_score.llm_scores.items()
    }

    # 9. Extract top-3 gap prompts
    gap_prompts = _extract_gap_prompts(brand_score)
    logger.info(f"Gap prompts identified: {len(gap_prompts)}")
    for g in gap_prompts:
        logger.info(f"  {g['prompt_id']}: missed by {g['llms_missed']}")

    # 10. Generate fix report for Pro tier
    fix_report_md: Optional[str] = None
    if plan == "pro":
        logger.info("Generating fix report for Pro customer…")
        fix_report_md = _generate_fix_report(
            brand_name=brand_profile.brand,
            brand_url=brand_profile.url,
            gap_prompts=gap_prompts,
            avs_brand=brand_score.avs_brand,
            per_llm=per_llm,
        )
        logger.info("Fix report generated.")
    else:
        logger.info("Starter plan — skipping fix report generation.")

    # 11. Upsert customer_scoring_runs row
    # prompt_count and estimated_cost_usd require migration 0012_quota_controls;
    # they are included here and will be ignored if the columns don't exist yet.
    estimated_cost = actual_cost_usd if actual_cost_usd > 0 else _ESTIMATED_RUN_COST.get(plan, 0.50)
    total_prompts_run = sum(
        s.prompts_scored + s.prompts_skipped
        for s in brand_score.llm_scores.values()
    )
    run_row: Dict[str, Any] = {
        "customer_id": customer_id,
        "run_date": run_date_str,
        "avs_brand": round(brand_score.avs_brand, 2),
        "per_llm": per_llm,
        "gap_prompts": gap_prompts,
        "fix_report_md": fix_report_md,
        "prompt_count": total_prompts_run,
        "estimated_cost_usd": estimated_cost,
    }
    logger.info(
        f"Writing scoring run to DB: {run_date_str} "
        f"| prompts={total_prompts_run} | cost=${estimated_cost:.4f}"
    )
    try:
        _upsert_row("customer_scoring_runs", run_row, on_conflict="customer_id,run_date")
    except RuntimeError as exc:
        err_msg = str(exc)
        # Graceful fallback: if migration 0012 hasn't been applied yet,
        # PostgREST returns 400 "column not found". Retry without the
        # new quota-tracking columns so the core score is never lost.
        if "400" in err_msg and (
            "prompt_count" in err_msg or "estimated_cost_usd" in err_msg
        ):
            logger.warning(
                "Migration 0012 not yet applied — retrying upsert without "
                "prompt_count/estimated_cost_usd columns (apply 0012_quota_controls.sql)"
            )
            fallback_row = {k: v for k, v in run_row.items()
                            if k not in ("prompt_count", "estimated_cost_usd")}
            _upsert_row("customer_scoring_runs", fallback_row, on_conflict="customer_id,run_date")
        else:
            raise
    logger.info("Done — scoring run written to customer_scoring_runs.")


# ── CLI entrypoint ─────────────────────────────────────────────────────────────

def _cli() -> None:
    parser = argparse.ArgumentParser(
        description="Run AI visibility scoring for a single customer.",
    )
    parser.add_argument(
        "--customer-id",
        required=True,
        help="UUID of the customer to score (must exist in customers table).",
    )
    parser.add_argument(
        "--llms",
        nargs="+",
        choices=list(LLM_CONFIGS.keys()),
        default=None,
        help="Subset of LLMs to run (default: all).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip real API calls; use mock responses (still writes to DB).",
    )
    args = parser.parse_args()

    try:
        asyncio.run(
            run_for_customer(
                customer_id=args.customer_id,
                llms=args.llms,
                dry_run=args.dry_run,
            )
        )
    except Exception as exc:
        logger.error(f"run_for_customer failed: {exc}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    _cli()
