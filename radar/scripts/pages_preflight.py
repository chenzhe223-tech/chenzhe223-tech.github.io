"""Small contracts used by the GitHub Pages daily-refresh preflight."""

from __future__ import annotations

from typing import Any


EXPLICIT_XNEWS_STATUSES = frozenset({
    "ok",
    "no_recent",
    "incompatible_schema",
    "incompatible_feed",
    "invalid_xml",
    "unavailable",
    "disabled",
})


def report_has_explicit_xnews_state(report: dict[str, Any]) -> bool:
    """True only for a recognized status paired with a voice list.

    Empty voice lists are valid for explicit states such as no_recent or unavailable.
    Missing, blank or unknown status must trigger a fresh report build.
    """
    status = report.get("xnews_status")
    return isinstance(status, str) and status.strip() in EXPLICIT_XNEWS_STATUSES and isinstance(report.get("xnews_voices"), list)
