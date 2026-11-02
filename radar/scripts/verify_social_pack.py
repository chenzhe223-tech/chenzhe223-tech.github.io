#!/usr/bin/env python3
"""Fail-closed QA for the six-image DAVYLAB WeChat social pack."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import urllib.request
import zipfile
from pathlib import Path
from zoneinfo import ZoneInfo

import cv2
import numpy as np
from PIL import Image, ImageDraw

from radar.scripts.generate_poster import font as poster_font
from radar.scripts.poster_style import poster_style_metadata
from radar.scripts.generate_social_pack import select_topic_stories, story_url, social_layout_regions

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "radar" / "data" / "latest.json"
BASE = ROOT / "radar" / "social"
PUBLIC_URL = "https://chenzhe223-tech.github.io/radar/daily/"
W, H = 900, 1200
QR_X, QR_Y, QR_SIZE = 610, 880, 180
TZ = ZoneInfo("Asia/Shanghai")


def fail(message: str):
    raise RuntimeError(message)


def check_destination(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "DAVYLAB-Social-Pack-QA/1.0", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(request, timeout=20) as response:
        response.read(512)
        status = int(response.status)
        final_url = response.geturl()
    if status < 200 or status >= 400:
        fail(f"Formal brief returned HTTP {status}: {final_url}")
    return {"requested_url": url, "http_status": status, "final_url": final_url, "status": "PASS"}


def verify_main_qr(path: Path) -> dict:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        fail("Main social poster cannot be opened by OpenCV")
    decoded, points, _ = cv2.QRCodeDetector().detectAndDecode(image)
    if decoded != PUBLIC_URL or points is None:
        fail(f"Final social poster QR mismatch: decoded={decoded!r}")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    tile = gray[QR_Y:QR_Y + QR_SIZE, QR_X:QR_X + QR_SIZE]
    if tile.shape != (QR_SIZE, QR_SIZE):
        fail(f"QR tile has invalid dimensions: {tile.shape}")
    contrast = int(np.percentile(tile, 99) - np.percentile(tile, 1))
    if contrast < 220:
        fail(f"QR contrast too low: {contrast}")
    dark_y, dark_x = np.where(tile < 128)
    if len(dark_x) == 0:
        fail("No dark QR modules found in reserved tile")
    quiet = {
        "top_px": int(dark_y.min()),
        "bottom_px": int(QR_SIZE - 1 - dark_y.max()),
        "left_px": int(dark_x.min()),
        "right_px": int(QR_SIZE - 1 - dark_x.max())
    }
    if min(quiet.values()) < 12:
        fail(f"QR quiet zone too small: {quiet}")
    pts = points[0]
    bbox = [round(float(max(pts[:, 0]) - min(pts[:, 0])), 1), round(float(max(pts[:, 1]) - min(pts[:, 1])), 1)]
    if min(bbox) < 100:
        fail(f"QR detected size too small: {bbox}")
    return {"decoded_url": decoded, "qr_tile_px": [QR_SIZE, QR_SIZE], "detected_qr_px": bbox,
            "contrast_percentile_range": contrast, "quiet_zone_px": quiet, "status": "PASS"}


def verify_cjk_font() -> dict:
    sample = "中文字体覆盖验证"
    fnt = poster_font(24, True)
    image = Image.new("RGB", (420, 80), "white")
    draw = ImageDraw.Draw(image)
    bbox = draw.textbbox((0, 0), sample, font=fnt)
    if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
        fail("CJK font did not render the verification sample")
    return {"font_family": fnt.getname()[0], "sample": sample, "bbox": list(bbox), "status": "PASS"}


def verify_image_layout(entry: dict) -> dict:
    image_type = str(entry.get("image_type") or "")
    expected_regions = social_layout_regions(image_type)
    regions = entry.get("layout_regions") or {}
    if regions != expected_regions:
        fail(f"Social image region specification mismatch for {image_type}")
    for name, box in regions.items():
        if not isinstance(box, list) or len(box) != 4:
            fail(f"Invalid social image region: {name}")
        x1, y1, x2, y2 = [int(v) for v in box]
        if x1 < 0 or y1 < 0 or x2 > W or y2 > H or x2 <= x1 or y2 <= y1:
            fail(f"Social image region outside canvas: {name}={box}")
    blocks = entry.get("text_bounds") or []
    if not blocks:
        fail(f"Social image text-bounds metadata missing: {entry.get('filename')}")
    for block in blocks:
        x, y = int(block.get("x", -1)), int(block.get("y", -1))
        width, height = int(block.get("width", -1)), int(block.get("height", -1))
        if block.get("overflow") or x < 0 or y < 0 or width <= 0 or height <= 0 or x + width > W or y + height > H:
            fail(f"Social image text overflow: {entry.get('filename')} / {block}")
        if float(block.get("actual_width", 0)) > width + 1:
            fail(f"Social image text exceeds width: {entry.get('filename')} / {block}")
    return {"region_count": len(regions), "text_block_count": len(blocks),
            "truncated_text_blocks": sum(1 for b in blocks if b.get("truncated")), "status": "PASS"}


def main() -> int:
    report = json.loads(DATA.read_text(encoding="utf-8"))
    report_date = str(report.get("report_date") or "")
    today = dt.datetime.now(TZ).date().isoformat()
    if report_date != today:
        raise SystemExit(f"Social QA date mismatch: {report_date} != {today}")
    folder = BASE / report_date
    manifest_path = folder / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit("Social pack manifest missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected_style = poster_style_metadata(report_date)
    if manifest.get("public_url") != PUBLIC_URL:
        fail("Social manifest public URL drift")
    for key, value in expected_style.items():
        if manifest.get("style", {}).get(key) != value:
            fail(f"Social style mismatch: {key}")
    if manifest.get("canvas") != [W, H] or manifest.get("required_count") != 6:
        fail("Social canvas/count contract mismatch")
    featured_skill = manifest.get("skill") or {}
    if not (featured_skill.get("official_website_verified") and featured_skill.get("official_website") and featured_skill.get("readme_verified") and featured_skill.get("skill_file_paths") and featured_skill.get("evidence_verified") and featured_skill.get("license")):
        fail("Featured Skill official project page, README, SKILL.md evidence or license verification is missing")
    top = report.get("top5") or []
    if len(top) != 5:
        fail("Formal report Top 5 count is not five")
    urls = [str(s.get("source_url") or s.get("url") or "") for s in top]
    if manifest.get("story_urls") != urls:
        fail("Social pack story URLs differ from the formal Top 5")
    entries = manifest.get("images") or []
    if len(entries) != 6 or len({e.get("filename") for e in entries}) != 6:
        fail("Six independent image entries are required")
    try:
        selected_topics = select_topic_stories(top)
    except Exception as exc:
        fail(f"Top 5 cannot satisfy the 2-global/2-China topic-image contract: {exc}")
    expected_topic_urls = [story_url(story) for _, story in selected_topics]
    if manifest.get("topic_story_urls") != expected_topic_urls:
        fail("Topic image story selection differs from the required two global and two China Top 5 stories")
    if manifest.get("topic_categories") != {"global_news": 2, "china_ai_news": 2, "skill": 1}:
        fail("Topic image category counts are not 2 global + 2 China + 1 Skill")
    skill = (report.get("skills") or [{}])[0]
    if (manifest.get("skill") or {}).get("url") != skill.get("url"):
        fail("Skill feature metadata does not match the formal report recommendation")

    font_result = verify_cjk_font()
    checks = []
    hashes = set()
    verified_images = []
    layout_results = []
    for index, entry in enumerate(entries):
        path = folder / str(entry.get("filename") or "")
        if path.parent.resolve() != folder.resolve() or not path.is_file():
            fail(f"Missing or unsafe image path: {path}")
        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            if im.format != "PNG" or im.size != (W, H):
                fail(f"Image contract failed for {path.name}: {im.format} {im.size}")
        size = path.stat().st_size
        if size < 8000:
            fail(f"Image is suspiciously small: {path.name} ({size} bytes)")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest in hashes:
            fail(f"Duplicate image content detected: {path.name}")
        hashes.add(digest)
        if index == 0:
            if entry.get("image_type") != "main_poster":
                fail(f"Main poster manifest type mismatch: {path.name}")
        elif 1 <= index <= 4:
            expected_category, expected_story = selected_topics[index - 1]
            if entry.get("image_type") != "topic_illustration" or entry.get("label") != "主题插画 · 非新闻现场":
                fail(f"News topic illustration disclosure missing: {path.name}")
            if entry.get("source_url") != story_url(expected_story) or entry.get("category") != expected_category:
                fail(f"Topic image source/category mismatch: {path.name}")
        else:
            if entry.get("image_type") != "skill_feature" or entry.get("label") != "主题插画 · 非产品截图":
                fail(f"Standalone Skill illustration disclosure missing: {path.name}")
            if entry.get("source_url") != skill.get("url"):
                fail(f"Skill image source mismatch: {path.name}")
        layout_results.append({"filename": path.name, **verify_image_layout(entry)})
        verified_images.append({
            "filename": path.name, "width": W, "height": H, "format": "PNG",
            "file_size_bytes": size, "sha256": digest, "theme": entry.get("theme"),
            "image_type": entry.get("image_type"), "category": entry.get("category"),
            "material_type": entry.get("material_type"), "status": "PASS"
        })
    main_path = folder / entries[0]["filename"]
    qr = verify_main_qr(main_path)
    destination = check_destination(PUBLIC_URL)
    copy_path = folder / "wechat-copy.md"
    moments_path = folder / "moments-copy.md"
    if not copy_path.is_file() or not moments_path.is_file():
        fail("Copy files missing")
    copy = copy_path.read_text(encoding="utf-8")
    required = ["💡 DAVYLAB 观察", "❓", "作者：DAVYLAB｜让可能发生", PUBLIC_URL]
    if any(item not in copy for item in required):
        fail("WeChat copy is missing a required section")
    if not all(title in copy for title in manifest.get("story_titles", [])):
        fail("WeChat copy does not match all five selected stories")

    result = {
        "report_date": report_date,
        "checked_at": dt.datetime.now(TZ).isoformat(),
        "style": manifest["style"],
        "expected_url": PUBLIC_URL,
        "destination": destination,
        "qr": qr,
        "font_coverage": font_result,
        "layout_results": layout_results,
        "images": verified_images,
        "checks": [
            {"name": "font_coverage", "status": "PASS"},
            {"name": "text_bounds_and_region_presence", "status": "PASS"},
            {"name": "six_independent_png_files", "status": "PASS"},
            {"name": "900x1200_3x4_dimensions", "status": "PASS"},
            {"name": "unique_image_hashes", "status": "PASS"},
            {"name": "two_global_two_china_one_skill_topic_distribution", "status": "PASS"},
            {"name": "topic_story_source_consistency", "status": "PASS"},
            {"name": "skill_feature_source_consistency", "status": "PASS"},
            {"name": "final_png_qr_exact_decode", "status": "PASS"},
            {"name": "qr_contrast_quiet_zone_and_size", "status": "PASS"},
            {"name": "formal_url_http_and_redirect", "status": "PASS"},
            {"name": "wechat_copy_matches_top5", "status": "PASS"}
        ],
        "phone_camera_scan": "NOT_TESTED",
        "wechat_editor_preview": "NOT_TESTED",
        "status": "PASS"
    }
    (folder / "verification.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    archive = folder / f"wechat-pack-{report_date}.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as zf:
        for path in sorted(folder.iterdir()):
            if path.is_file() and path != archive:
                zf.write(path, arcname=path.name)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"Created downloadable package: {archive.relative_to(ROOT)} ({archive.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
