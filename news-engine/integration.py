"""Fail-closed, default-off bridge to a future DAVYLAB News Engine integration.

Does not import or modify Radar, WorldToon, Vibe Studio, or any production
scheduler. The legacy data producer is authoritative until real QA approves
an opt-in shadow integration and a rollback mechanism.
"""
from __future__ import annotations

import os


def use_news_engine(*, legacy, candidate, enabled=None, qa_approved=False):
    """Return (payload, status), reverting to legacy on any unsafe candidate."""
    enabled = os.environ.get("DAVYLAB_NEWS_ENGINE_ENABLED", "0") == "1" if enabled is None else bool(enabled)
    if not enabled or not qa_approved:
        return legacy(), {"used": "legacy", "reason": "disabled_or_unapproved"}
    try:
        result = candidate()
        if (not isinstance(result, dict)
                or result.get("schema_version") != 1
                or result.get("publishable") is not False
                or result.get("editorial_status") not in
                {"requires_human_review", "requires_human_fact_check", "research_candidate"}
                or not result.get("source_urls")):
            return legacy(), {"used": "legacy", "reason": "invalid_unreviewed_candidate"}
        return result, {"used": "news_engine_review_only", "reason": "approved_shadow_candidate"}
    except Exception:
        return legacy(), {"used": "legacy", "reason": "news_engine_failed"}


def public_payload(candidate):
    """Safe external research interface; never contains full documents or secrets."""
    if not isinstance(candidate, dict) or candidate.get("publishable") is not False:
        raise ValueError("only unpublishable reviewed candidates can be exposed")
    urls = candidate.get("source_urls")
    if not isinstance(urls, list) or not urls or any(not isinstance(url, str)
                                                     or not url.startswith("https://")
                                                     for url in urls):
        raise ValueError("source URLs required")
    return {"schema_version": 1, "id": str(candidate.get("id", ""))[:100],
            "title": str(candidate.get("title", ""))[:300],
            "source_urls": urls[:12],
            "verification_status": "not_independently_verified",
            "publishable": False,
            "external_copy_allowed": False}


if __name__ == "__main__":
    print("News Engine integration remains OFF. No production integration enabled.")
