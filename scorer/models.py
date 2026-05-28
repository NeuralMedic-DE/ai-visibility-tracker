"""Data models for the scorer pipeline."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


@dataclass
class BrandProfile:
    """Represents a tracked brand with all template variables."""
    brand: str
    url: str
    category: str
    category_long: str
    segment: str
    competitor_1: str
    competitor_2: str
    use_case_1: str
    use_case_2: str
    integration_1: str
    integration_2: str
    role: str
    # aliases for mention detection (comma-separated in CSV → list here)
    aliases: List[str] = field(default_factory=list)

    def all_names(self) -> List[str]:
        """All brand name variants used for mention detection."""
        names = [self.brand] + self.aliases
        # also add bare domain without TLD, e.g. "close" from "close.com"
        domain_bare = self.url.split(".")[0].lower()
        if domain_bare not in [n.lower() for n in names]:
            names.append(domain_bare)
        return list(dict.fromkeys(names))  # dedup, preserve order

    def template_vars(self) -> Dict[str, str]:
        return {
            "BRAND": self.brand,
            "CATEGORY": self.category,
            "CATEGORY_LONG": self.category_long,
            "SEGMENT": self.segment,
            "COMPETITOR_1": self.competitor_1,
            "COMPETITOR_2": self.competitor_2,
            "USE_CASE_1": self.use_case_1,
            "USE_CASE_2": self.use_case_2,
            "INTEGRATION_1": self.integration_1,
            "INTEGRATION_2": self.integration_2,
            "ROLE": self.role,
        }


@dataclass
class PromptResult:
    """Scored result for a single prompt × LLM combination."""
    prompt_id: str
    prompt_text: str
    prompt_category: str
    presence: bool
    rank: Any  # int, "unranked", "na", or None
    sentiment: str  # "positive" | "neutral" | "negative"
    has_link: bool
    score: float
    raw_response: str
    cached: bool = False
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "prompt_id": self.prompt_id,
            "prompt_text": self.prompt_text,
            "prompt_category": self.prompt_category,
            "presence": self.presence,
            "rank": self.rank,
            "sentiment": self.sentiment,
            "has_link": self.has_link,
            "score": self.score,
            "cached": self.cached,
            "error": self.error,
            # omit raw_response in summary; included in full output
        }


@dataclass
class LLMScore:
    """Aggregated score for one brand across one LLM."""
    llm_key: str
    model: str
    label: str
    avs: float  # 0-100 scale (AVS per LLM × 10)
    avs_raw: float  # 0-10 scale
    prompt_results: List[PromptResult] = field(default_factory=list)
    prompts_scored: int = 0
    prompts_skipped: int = 0  # errors / no_response

    def to_dict(self, include_raw_responses: bool = False) -> Dict[str, Any]:
        results = []
        for r in self.prompt_results:
            d = r.to_dict()
            if include_raw_responses:
                d["raw_response"] = r.raw_response
            results.append(d)
        return {
            "llm_key": self.llm_key,
            "model": self.model,
            "label": self.label,
            "avs": round(self.avs, 1),
            "avs_raw": round(self.avs_raw, 2),
            "prompts_scored": self.prompts_scored,
            "prompts_skipped": self.prompts_skipped,
            "prompt_results": results,
        }


@dataclass
class BrandScore:
    """Full score for one brand across all LLMs."""
    brand: str
    url: str
    run_date: str
    avs_brand: float   # 0-100
    avs_brand_raw: float  # 0-10
    llm_scores: Dict[str, LLMScore] = field(default_factory=dict)

    def to_dict(self, include_raw_responses: bool = False) -> Dict[str, Any]:
        return {
            "brand": self.brand,
            "url": self.url,
            "run_date": self.run_date,
            "avs_brand": round(self.avs_brand, 1),
            "avs_brand_raw": round(self.avs_brand_raw, 2),
            "llms": {
                k: v.to_dict(include_raw_responses=include_raw_responses)
                for k, v in self.llm_scores.items()
            },
        }
