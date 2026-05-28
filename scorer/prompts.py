"""Prompt rendering — fills template variables for a given brand profile."""
from typing import List, Tuple
from .config import PROMPT_TEMPLATES
from .models import BrandProfile


def render_prompts(brand: BrandProfile) -> List[Tuple[str, str, str]]:
    """
    Return list of (prompt_id, rendered_prompt_text, prompt_category)
    for every template in the catalog.
    """
    vars_ = brand.template_vars()
    rendered = []
    for tpl in PROMPT_TEMPLATES:
        text = tpl["template"]
        for key, val in vars_.items():
            text = text.replace("{" + key + "}", val)
        rendered.append((tpl["id"], text, tpl["category"]))
    return rendered
