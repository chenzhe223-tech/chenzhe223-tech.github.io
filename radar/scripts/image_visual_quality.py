"""Deterministic news-image display safety for DAVYLAB Radar.

This does not pretend to provide semantic computer vision. Without a verified
product/visual match, clearly identified stock art is replaced by a source-
backed information card. Basic pixel/layout checks guard actual article photos.
"""
from __future__ import annotations
import hashlib
import io
from pathlib import Path
from PIL import Image, ImageStat

THEMATIC_STATUSES = {"thematic_fallback", "openverse_topic", "wikimedia_topic", "web_search_topic"}
POLICY_VERSION = "2026-11-07.1"


def assess_bytes(raw: bytes, story: dict) -> dict:
    """Return an auditable presentation decision for the already verified bytes."""
    if not raw or len(raw) > 8 * 1024 * 1024:
        raise ValueError("unusable_image_bytes")
    with Image.open(io.BytesIO(raw)) as image:
        image.verify()
    with Image.open(io.BytesIO(raw)) as image:
        width, height = image.size
        if width < 1 or height < 1 or width * height > 45_000_000:
            raise ValueError("invalid_image_dimensions")
        thumb = image.convert("L")
        thumb.thumbnail((180, 180))
        contrast = round(float(ImageStat.Stat(thumb).stddev[0]), 2)
    ratio = round(width / height, 3)
    status = str(story.get("image_match_status") or "")
    url = str(story.get("image_url") or "")
    source = str(story.get("image_source") or "").lower()
    reasons = []
    if status in THEMATIC_STATUSES or "images.unsplash.com/" in url or "topic illustration" in source or "topic image" in source:
        reasons.append("unverified_generic_topic_art")
    if min(width, height) < 230 or width * height < 100_000:
        reasons.append("thumbnail_too_small")
    if ratio > 3.3 or ratio < 0.55:
        reasons.append("unsafe_extreme_aspect_ratio")
    if contrast < 8:
        reasons.append("low_visual_contrast")
    # A portrait can be legitimate article photography, but is unsuitable for
    # a 3:1 horizontal news thumbnail without either huge bars or face cropping.
    if ratio < 0.78:
        reasons.append("portrait_in_landscape_card")
    return {
        "policy_version": POLICY_VERSION,
        "display_mode": "info_card" if reasons else "verified_photo",
        "reasons": reasons or ["source_image_passes_basic_pixel_layout_checks"],
        "width": width,
        "height": height,
        "aspect_ratio": ratio,
        "luminance_stddev": contrast,
        "content_digest_sha256": hashlib.sha256(raw).hexdigest(),
        "semantic_match_model_verified": False,
    }


def assess_cached_image(digest: str, story: dict, cache_root: Path) -> dict:
    if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
        raise ValueError("invalid_verified_digest")
    raw = (cache_root / digest).read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError("verified_image_bytes_mismatch")
    return assess_bytes(raw, story)
