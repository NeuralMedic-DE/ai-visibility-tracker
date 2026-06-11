"""
Explicit cache pruning CLI — the ONLY approved way to delete scorer cache entries.

The scorer/.cache/ directory is the canonical store of full LLM responses and must
NOT be auto-pruned by scoring runs. Use this script when disk usage is a concern.

Usage:
    python -m scorer.cli.prune_cache --dry-run
    python -m scorer.cli.prune_cache --older-than 30
    python -m scorer.cli.prune_cache --older-than 60 --dry-run

Arguments:
    --older-than N   Delete cache entries whose cached_at timestamp is older than
                     N days. Required (no default — must be explicit to avoid
                     accidental deletion).
    --dry-run        Print what would be deleted without removing any files.
    --verbose        Print one line per file (default: summary only).
"""
from __future__ import annotations
import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Load .env.local so CACHE_DIR resolves correctly when run as a script.
def _load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    workspace = Path(__file__).parent.parent.parent
    for candidate in (".env.local", ".env"):
        env_file = workspace / candidate
        if env_file.exists():
            load_dotenv(env_file)
            return


_load_env()

from scorer.config import CACHE_DIR  # noqa: E402  (after env load)


def _cached_at_to_epoch(entry: dict) -> float | None:
    """Return POSIX timestamp from a cache entry's cached_at field, or None."""
    raw = entry.get("cached_at", "")
    if not raw:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S+00:00"):
        try:
            dt = datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except ValueError:
            continue
    return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prune scorer/.cache/ entries older than N days.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--older-than",
        type=int,
        metavar="DAYS",
        required=True,
        help="Delete entries whose cached_at is older than DAYS days.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be deleted; do not remove files.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print one line per file being deleted.",
    )
    args = parser.parse_args()

    if not CACHE_DIR.exists():
        print(f"Cache directory does not exist: {CACHE_DIR}")
        sys.exit(0)

    cutoff = time.time() - args.older_than * 86_400
    all_files = sorted(CACHE_DIR.glob("*.json"))
    to_delete: list[Path] = []
    unknown_age: list[Path] = []

    for cache_file in all_files:
        try:
            with open(cache_file, "r", encoding="utf-8") as fh:
                entry = json.load(fh)
        except (OSError, json.JSONDecodeError):
            unknown_age.append(cache_file)
            continue

        ts = _cached_at_to_epoch(entry)
        if ts is None:
            unknown_age.append(cache_file)
            continue

        if ts < cutoff:
            to_delete.append(cache_file)

    print(f"Cache directory : {CACHE_DIR}")
    print(f"Total entries   : {len(all_files)}")
    print(f"Older than {args.older_than:>3}d : {len(to_delete)} entries to delete")
    print(f"Unknown age     : {len(unknown_age)} entries (skipped)")

    if not to_delete:
        print("Nothing to delete.")
        return

    if args.dry_run:
        print("\n[DRY RUN] Would delete:")
        for p in to_delete:
            print(f"  {p.name}")
        return

    deleted = 0
    for p in to_delete:
        try:
            p.unlink()
            deleted += 1
            if args.verbose:
                print(f"  deleted {p.name}")
        except OSError as exc:
            print(f"  WARNING: could not delete {p.name}: {exc}", file=sys.stderr)

    print(f"\nDeleted {deleted} / {len(to_delete)} entries.")


if __name__ == "__main__":
    main()
