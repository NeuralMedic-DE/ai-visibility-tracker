"""Load brand profiles from a CSV file."""
from __future__ import annotations
import csv
from pathlib import Path
from typing import List
from .models import BrandProfile


REQUIRED_COLUMNS = {
    "brand", "url", "category", "category_long", "segment",
    "competitor_1", "competitor_2",
    "use_case_1", "use_case_2",
    "integration_1", "integration_2",
    "role",
}


def load_brands(csv_path: str | Path) -> List[BrandProfile]:
    """
    Load brands from a CSV. Returns list of BrandProfile.
    The 'aliases' column is optional (comma-separated list in a single cell).
    """
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")

    brands = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError("CSV appears to be empty")

        headers = set(reader.fieldnames)
        missing = REQUIRED_COLUMNS - headers
        if missing:
            raise ValueError(f"CSV missing required columns: {missing}")

        for i, row in enumerate(reader, start=2):  # row 1 is header
            aliases_raw = row.get("aliases", "")
            aliases = [a.strip() for a in aliases_raw.split(",") if a.strip()]
            brands.append(BrandProfile(
                brand=row["brand"].strip(),
                url=row["url"].strip(),
                category=row["category"].strip(),
                category_long=row["category_long"].strip(),
                segment=row["segment"].strip(),
                competitor_1=row["competitor_1"].strip(),
                competitor_2=row["competitor_2"].strip(),
                use_case_1=row["use_case_1"].strip(),
                use_case_2=row["use_case_2"].strip(),
                integration_1=row["integration_1"].strip(),
                integration_2=row["integration_2"].strip(),
                role=row["role"].strip(),
                aliases=aliases,
            ))

    if not brands:
        raise ValueError(f"No brands found in {path}")

    return brands
