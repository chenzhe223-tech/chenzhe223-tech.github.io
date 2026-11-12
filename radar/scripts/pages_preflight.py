"""Small contracts used by the GitHub Pages daily-refresh preflight."""

from __future__ import annotations

from typing import Any


def report_has_explicit_xnews_state(report: dict[str, Any]) -> bool:
    """True only when a report contains a nonblank X News status and a voice list.

    Empty voice lists are valid with a status such as no_recent or unavailable.
    Missing or blank status must trigger a fresh report build.
    """
    status = report.get("xnews_status")
    return isinstance(status, str) and bool(status.strip()) and isinstance(report.get("xnews_voices"), list)
