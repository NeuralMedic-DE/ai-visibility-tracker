"""
Smoke test for raw LLM response preservation (AC #5 from T-e57d6bc0).

Verifies that running the scorer in dry_run mode against a single brand × single
prompt produces a PromptResult where:
  - response_text is non-empty
  - response_text appears in the serialised JSON output
  - response_truncated_at is None (dry-run responses are tiny, well under 16 KB)

Runs entirely offline (dry_run=True) — no API calls, no cost.
"""
import asyncio
import json
from datetime import date

import pytest

from scorer.models import BrandProfile, PromptResult
from scorer.scorer import score_brand_async, _build_response_text, _get_response_max_bytes


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _minimal_brand() -> BrandProfile:
    """Minimal BrandProfile sufficient for a dry-run scoring run."""
    return BrandProfile(
        brand="Acme",
        url="acme.com",
        category="project management",
        category_long="project management software",
        segment="SMB",
        competitor_1="Asana",
        competitor_2="Monday",
        use_case_1="task tracking",
        use_case_2="sprint planning",
        integration_1="Slack",
        integration_2="GitHub",
        role="engineering manager",
        aliases=[],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests for _build_response_text
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildResponseText:
    def test_no_truncation_for_short_text(self):
        text = "Hello, world!"
        result, trunc_at = _build_response_text(text, store=True)
        assert result == text
        assert trunc_at is None

    def test_truncates_at_cap(self):
        import os
        cap = _get_response_max_bytes()
        # Build a string that is cap + 100 bytes when UTF-8-encoded.
        big = "x" * (cap + 100)
        result, trunc_at = _build_response_text(big, store=True)
        assert len(result.encode("utf-8")) <= cap
        assert trunc_at == cap

    def test_store_false_returns_empty(self):
        result, trunc_at = _build_response_text("anything", store=False)
        assert result == ""
        assert trunc_at is None

    def test_multibyte_safe(self):
        """Truncation should not split a multi-byte UTF-8 character."""
        cap = _get_response_max_bytes()
        # Japanese characters are 3 bytes each; build a string just over cap.
        japanese = "あ" * (cap // 3 + 1)
        result, trunc_at = _build_response_text(japanese, store=True)
        # Result must be valid UTF-8 (no UnicodeDecodeError raised).
        assert isinstance(result, str)
        assert trunc_at == cap


# ─────────────────────────────────────────────────────────────────────────────
# Integration smoke test: dry-run scorer → response_text populated
# ─────────────────────────────────────────────────────────────────────────────

class TestResponseTextPopulated:
    def test_dry_run_response_text_nonempty(self):
        """
        Running the async scorer in dry_run mode with a single brand × all LLMs
        must produce PromptResults where response_text is non-empty and
        response_truncated_at is None (dry-run payloads are tiny).
        """
        brand = _minimal_brand()
        run_date = date.today().isoformat()

        brand_score = asyncio.run(
            score_brand_async(
                brand=brand,
                run_date=run_date,
                llms=["openai"],          # one LLM to keep the test fast
                dry_run=True,
                prompt_limit=1,           # one prompt — smoke test only
                store_response=True,
            )
        )

        assert "openai" in brand_score.llm_scores, "openai LLM missing from results"
        prompt_results = brand_score.llm_scores["openai"].prompt_results
        assert len(prompt_results) >= 1, "No prompt results returned"

        for pr in prompt_results:
            assert isinstance(pr, PromptResult)
            assert pr.response_text, (
                f"response_text is empty for prompt {pr.prompt_id!r} — "
                "AC #1 requires non-empty response_text"
            )
            assert pr.response_truncated_at is None, (
                f"response_truncated_at should be None for tiny dry-run response, "
                f"got {pr.response_truncated_at!r}"
            )

    def test_no_store_response_gives_empty(self):
        """When store_response=False, response_text must be empty."""
        brand = _minimal_brand()
        run_date = date.today().isoformat()

        brand_score = asyncio.run(
            score_brand_async(
                brand=brand,
                run_date=run_date,
                llms=["openai"],
                dry_run=True,
                prompt_limit=1,
                store_response=False,
            )
        )

        prompt_results = brand_score.llm_scores["openai"].prompt_results
        for pr in prompt_results:
            assert pr.response_text == "", (
                f"Expected empty response_text when store_response=False, "
                f"got {pr.response_text!r}"
            )
            assert pr.response_truncated_at is None

    def test_response_text_in_serialised_json(self):
        """
        response_text must appear in the JSON produced by BrandScore.to_dict()
        so the output file is self-auditable without reading the cache.
        """
        brand = _minimal_brand()
        run_date = date.today().isoformat()

        brand_score = asyncio.run(
            score_brand_async(
                brand=brand,
                run_date=run_date,
                llms=["openai"],
                dry_run=True,
                prompt_limit=1,
                store_response=True,
            )
        )

        serialised = brand_score.to_dict()
        json_str = json.dumps(serialised)

        # response_text key must appear in the JSON.
        assert '"response_text"' in json_str, (
            "response_text key missing from serialised BrandScore JSON"
        )

    def test_old_json_loads_without_crash(self):
        """
        Deserialising a PromptResult dict that lacks response_text /
        response_truncated_at (pre-2026-06-11 format) must not raise.
        """
        old_format = {
            "prompt_id": "CD-01",
            "prompt_text": "What CRM do you recommend?",
            "prompt_category": "category_discovery",
            "presence": True,
            "rank": 2,
            "sentiment": "positive",
            "has_link": False,
            "score": 7.0,
            "raw_response": "Close CRM is great.",
            "cached": True,
            "error": None,
        }
        # Constructing from dict: mimic what a loader would do.
        # The dataclass has defaults, so missing keys just use defaults.
        pr = PromptResult(
            prompt_id=old_format["prompt_id"],
            prompt_text=old_format["prompt_text"],
            prompt_category=old_format["prompt_category"],
            presence=old_format["presence"],
            rank=old_format["rank"],
            sentiment=old_format["sentiment"],
            has_link=old_format["has_link"],
            score=old_format["score"],
            raw_response=old_format["raw_response"],
            cached=old_format["cached"],
            error=old_format["error"],
            # response_text and response_truncated_at omitted → use defaults
        )
        assert pr.response_text == ""
        assert pr.response_truncated_at is None
