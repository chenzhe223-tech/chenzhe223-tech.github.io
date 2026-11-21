"""Read-only import of traceable Radar archives into isolated News Engine dedupe state.

Never modifies radar/, main, existing history, or news publication. Imports exact URL
and normalized-title keys only; historical content is not asserted as factual.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

import collector
from history_backend import StateConflict, history_weeks, read_week, write_week, week_key

MAX_ARCHIVE_BYTES = 4_000_000
MAX_REPORT_DAYS = 100


def archive_history(data_dir: Path, now: dt.datetime):
    """Generate per-week first-observed keys from the exact archive manifest."""
    if now.tzinfo is None:
        raise ValueError("timezone-aware now required")
    manifest = json.loads((data_dir / "history.json").read_text(encoding="utf-8"))
    days = manifest.get("days")
    if not isinstance(days, list) or len(days) > MAX_REPORT_DAYS or not days:
        raise ValueError("invalid or empty Radar history manifest")
    if len(set(days)) != len(days):
        raise ValueError("duplicate archived day")
    cutoff = (now - dt.timedelta(days=collector.HISTORY_DAYS)).date()
    by_week, report_days, skipped = {}, set(), 0
    first_seen = set()
    for filename in sorted(days):
        if not isinstance(filename, str) or len(filename) != 15 or not filename.endswith(".json"):
            raise ValueError("invalid day filename")
        try:
            report_date = dt.date.fromisoformat(filename[:-5])
        except ValueError as exc:
            raise ValueError("invalid day date") from exc
        if report_date < cutoff or report_date > now.date():
            continue
        file = data_dir / "archive" / filename
        if not file.is_file() or file.stat().st_size > MAX_ARCHIVE_BYTES:
            raise ValueError(f"missing or oversized Radar archive: {filename}")
        record = json.loads(file.read_text(encoding="utf-8"))
        if not isinstance(record, dict) or record.get("report_date") != report_date.isoformat():
            raise ValueError(f"archive date mismatch: {filename}")
        groups = [record.get("news"), record.get("top5"), record.get("china_ai_news")]
        for group in groups:
            if group is not None and not isinstance(group, list):
                raise ValueError(f"invalid archived stories: {filename}")
        report_days.add(report_date.isoformat())
        stamp = dt.datetime.combine(report_date, dt.time(12, 0), dt.timezone.utc).isoformat()
        current = by_week.setdefault(week_key(report_date), {})
        for item in (groups[0] or []) + (groups[1] or []) + (groups[2] or []):
            if not isinstance(item, dict):
                skipped += 1
                continue
            url = item.get("source_url") or item.get("url") or ""
            canon = collector.canonical_url(url)
            title = item.get("title_en") or item.get("original_title") or item.get("title") or item.get("title_zh") or ""
            norm = collector.normalized_title(title) if isinstance(title, str) else ""
            keys = ([f"url:{canon}"] if canon else []) + ([f"title:{norm}"] if norm else [])
            if not keys:
                skipped += 1
            for key in keys:
                if key not in first_seen:
                    current[key] = stamp
                    first_seen.add(key)
    if not report_days:
        raise ValueError("no history in 90-day window")
    missing = sorted({(cutoff + dt.timedelta(days=i)).isoformat()
                      for i in range((now.date() - cutoff).days + 1)} - report_days)
    return by_week, {
        "archive_earliest": min(report_days), "archive_latest": max(report_days),
        "archive_days": len(report_days), "available_keys": len(first_seen),
        "unavailable_dates_in_90_day_window": len(missing),
        "unavailable_oldest_date": missing[0] if missing else None,
        "skipped_rows": skipped,
        "status": "partial_observed_archive_history" if missing else "complete_archive_window",
    }


def persist_backfill(by_week, *, repo, token, read=read_week, write=write_week):
    """CAS/merge retry per shard; preserve existing engine keys and earlier date stamps."""
    written = 0
    present = 0
    for week in sorted(by_week):
        additions = by_week[week]
        for attempt in range(3):
            current, sha = read(repo, token, week)
            delta = {k: stamp for k, stamp in additions.items() if k not in current}
            present += len(additions) - len(delta) if attempt == 0 else 0
            if not delta:
                break
            try:
                write(repo, token, week, {**current, **delta}, sha)
                written += len(delta)
                break
            except StateConflict:
                if attempt == 2:
                    raise
    return {"new_keys": written, "already_present_keys": present, "weeks": len(by_week)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--radar-data", type=Path, required=True)
    p.add_argument("--out", type=Path, default=Path("news-engine/data/backfill-audit.json"))
    p.add_argument("--commit", action="store_true", help="write only to isolated news-engine-state")
    args = p.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    shards, audit = archive_history(args.radar_data, now)
    audit["source"] = "radar/data/history.json and referenced archive files (read-only)"
    audit["target"] = "news-engine-state:news-engine/state/weeks/"
    audit["verified_facts"] = False
    audit["published"] = False
    if args.commit:
        import os
        token = os.environ.get("GITHUB_TOKEN", "")
        if not token:
            raise ValueError("GitHub token unavailable; no partial audit may imply success")
        audit["persistence"] = persist_backfill(shards, repo=os.environ["GITHUB_REPOSITORY"], token=token)
    else:
        audit["persistence"] = {"dry_run": True}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False))


if __name__ == "__main__":
    main()
