"""Prompt rendering — fills template variables for a given brand profile."""
from typing import List, Optional, Tuple
from .config import PROMPT_TEMPLATES
from .models import BrandProfile


def render_prompts(
    brand: BrandProfile,
    limit: Optional[int] = None,
) -> List[Tuple[str, str, str]]:
    """
    Return list of (prompt_id, rendered_prompt_text, prompt_category).

    Args:
        brand: BrandProfile with all template variables.
        limit: Maximum number of prompts to render. None = all 100 templates.
               Pass PLAN_PROMPT_LIMITS[plan] to enforce per-plan quotas:
                 starter → 25,  pro → 100.
    """
    templates = PROMPT_TEMPLATES if limit is None else PROMPT_TEMPLATES[:limit]
    vars_ = brand.template_vars()
    rendered = []
    for tpl in templates:
        text = tpl["template"]
        for key, val in vars_.items():
            text = text.replace("{" + key + "}", val)
        rendered.append((tpl["id"], text, tpl["category"]))
    return rendered
