"""Deterministic ISO-week alternating DAVYLAB poster style schedule."""
from __future__ import annotations
from datetime import date, timedelta

# Monday of ISO 2026-W01. Fixed forever so consecutive weeks alternate,
# including the ISO week-year boundary (e.g. ISO 2026-W53 -> ISO 2027-W01).
ANCHOR_MONDAY = date(2025, 12, 29)
STYLE_GEOMETRIC = "geometric-navy"
STYLE_MOUNTAIN = "mountain-editorial"
STYLE_CYCLE = "ISO-WEEK-ALTERNATING-V1"
TEMPLATE_VERSION = "2.3.0"

def poster_style_metadata(value: str | date) -> dict:
    """Return deterministic style and ISO-week metadata for a date."""
    day = date.fromisoformat(value) if isinstance(value, str) else value
    monday = day - timedelta(days=day.weekday())
    week_index = (monday - ANCHOR_MONDAY).days // 7
    iso = day.isocalendar()
    variant = STYLE_GEOMETRIC if week_index % 2 == 0 else STYLE_MOUNTAIN
    return {
        "design_variant": variant,
        "iso_year": iso.year,
        "iso_week": iso.week,
        "iso_weekday": iso.weekday,
        "style_cycle_index": week_index,
        "style_cycle": STYLE_CYCLE,
        "template_version": TEMPLATE_VERSION,
    }
