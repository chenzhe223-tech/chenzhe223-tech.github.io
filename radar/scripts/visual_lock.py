"""Runtime-enforced visual lock for DAVYLAB poster production."""
from __future__ import annotations
import json
from pathlib import Path
from .poster_style import poster_style_metadata

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "radar" / "config"

def load_json(name: str) -> dict:
    path = CONFIG / name
    if not path.is_file():
        raise RuntimeError(f"P0 visual-lock config missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))

def validate_visual_lock(report_date: str) -> dict:
    baseline = load_json("baseline.json")
    style_lock = load_json("style-lock.json")
    layout = load_json("layout-spec.json")
    qa = load_json("qa-rules.json")
    typography = load_json("typography.json")
    colors = load_json("color-tokens.json")
    meta = poster_style_metadata(report_date)
    if style_lock.get("lock_mode") != "deterministic":
        raise RuntimeError("P0: style lock must be deterministic")
    if meta["design_variant"] not in style_lock.get("allowed_design_variants", []):
        raise RuntimeError("P0: ISO-selected design is not allowed by style lock")
    if style_lock.get("approved_iso_week") == f'{meta["iso_year"]}-W{meta["iso_week"]:02d}':
        if meta["design_variant"] != style_lock.get("approved_weekly_style"):
            raise RuntimeError("P0: current approved ISO week style mismatch")
    website = layout["website_poster"]
    qa_website = qa["website_poster"]
    if [website["width"], website["height"]] != [qa_website["width"], qa_website["height"]]:
        raise RuntimeError("P0: layout and QA canvas dimensions disagree")
    if website["width"] != 1200 or website["height"] != 1800:
        raise RuntimeError("P0: website production canvas changed without approved migration")
    if qa_website["qr_url"] != "https://chenzhe223-tech.github.io/radar/daily/":
        raise RuntimeError("P0: QR target drift")
    if not baseline.get("reference_image", {}).get("sha256"):
        raise RuntimeError("P0: approved visual reference SHA256 missing")
    reference = baseline.get("reference_image", {})
    if reference.get("sha256") != "7ec1b618ff78cf40b8a46c346aff23a80f6dfe11b83b30485546cd5483e406bd":
        raise RuntimeError("P0: approved 2026-10-31 reference fingerprint changed")
    production_reference = baseline.get("production_reference", {})
    production_path = ROOT / str(production_reference.get("path") or "")
    if not production_path.is_file():
        raise RuntimeError(f"P0: approved production reference image missing: {production_path}")
    if production_reference.get("expected_dimensions") != [1200, 1800]:
        raise RuntimeError("P0: production reference dimensions conflict with the website poster contract")
    regions = layout.get("mountain_editorial", {}).get("regions", [])
    required_regions = ["masthead", "hero-title-date", "five-column-news-grid", "today-insight-banner", "skill-recommendation", "right-qr-panel", "brand-footer"]
    if regions != required_regions:
        raise RuntimeError("P0: approved mountain-editorial region order changed")
    if layout.get("mountain_editorial", {}).get("news_columns") != 5:
        raise RuntimeError("P0: mountain-editorial must retain five news columns")
    social = layout.get("wechat_social_pack", {})
    if [social.get("width"), social.get("height"), social.get("count")] != [900, 1200, 6]:
        raise RuntimeError("P0: WeChat six-image output contract changed")
    if not typography.get("cjk_candidates") or not typography.get("cjk_bold_candidates"):
        raise RuntimeError("P0: no approved CJK font candidates configured")
    if any("DejaVuSans" in str(p) for p in typography.get("cjk_candidates", []) + typography.get("cjk_bold_candidates", [])):
        raise RuntimeError("P0: Latin-only DejaVu font cannot be used as a CJK fallback")
    if typography.get("fallback_allowed_for_cjk") is not False:
        raise RuntimeError("P0: CJK font fallback must fail closed")
    if "mountain-editorial" not in colors:
        raise RuntimeError("P0: mountain-editorial color tokens missing")
    if qa.get("max_repair_rounds") != 3 or qa.get("fail_closed") is not True:
        raise RuntimeError("P0: repair/production gate policy invalid")
    return {**meta, "baseline_id": baseline["baseline_id"], "canvas": [website["width"], website["height"]], "template_version": meta["template_version"]}
