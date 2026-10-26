#!/usr/bin/env python3
"""Fail-closed validation for the final DAVYLAB poster QR and destination."""
from __future__ import annotations

import datetime as dt
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    from radar.scripts.poster_style import poster_style_metadata
except ModuleNotFoundError:
    from poster_style import poster_style_metadata

import cv2
import numpy as np
from PIL import Image

ROOT = Path.cwd().resolve() if (Path.cwd() / "radar" / "data" / "latest.json").exists() else Path(__file__).resolve().parents[2]
POSTERS = ROOT / "radar" / "posters"
PUBLIC_URL = "https://chenzhe223-tech.github.io/radar/daily/"
QR_SIZE = 240
QR_X, QR_Y = 912, 1302
TZ = ZoneInfo("Asia/Shanghai")


def fail(message: str) -> None:
    raise RuntimeError(message)


def decode_poster(path: Path, expected_url: str) -> dict:
    if not path.is_file() or path.stat().st_size < 10_000:
        fail(f"Poster missing or suspiciously small: {path}")
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        fail(f"Final poster cannot be opened by OpenCV: {path}")
    height, width = image.shape[:2]
    if width < 1080 or height < 1600:
        fail(f"Poster dimensions are too small: {width}x{height}")

    decoded, points, _ = cv2.QRCodeDetector().detectAndDecode(image)
    if not decoded:
        # Secondary scan of the reserved lower-left QR zone; it is still cropped
        # from the final composed image, not from a standalone QR source file.
        roi = image[QR_Y:QR_Y + QR_SIZE, QR_X:QR_X + QR_SIZE]
        decoded_roi, points_roi, _ = cv2.QRCodeDetector().detectAndDecode(roi)
        if decoded_roi:
            decoded, points = decoded_roi, points_roi
    if not decoded:
        fail(f"QR could not be decoded from final poster: {path}")
    if decoded != expected_url:
        fail(f"QR URL mismatch in {path}: decoded={decoded!r}, expected={expected_url!r}")
    if points is None or len(points) == 0:
        fail(f"QR decoded but no QR geometry was detected in {path}")

    # The generator reserves a 240 x 240 px, lower-left QR tile in a 1200 x 1800
    # poster. Check the actual final image region for contrast and quiet zone.
    qr_x, qr_y, qr_size = QR_X, QR_Y, QR_SIZE
    if qr_y < 0 or qr_x + qr_size > width or qr_y + qr_size > height:
        fail(f"Expected QR tile lies outside the final poster: {path}")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    tile = gray[qr_y:qr_y + qr_size, qr_x:qr_x + qr_size]
    if tile.shape != (qr_size, qr_size):
        fail(f"QR tile dimensions are invalid in {path}: {tile.shape}")
    contrast = int(np.percentile(tile, 99) - np.percentile(tile, 1))
    if contrast < 220:
        fail(f"QR contrast is too low in {path}: percentile range={contrast}")

    dark_y, dark_x = np.where(tile < 128)
    if len(dark_x) == 0:
        fail(f"No dark QR modules found in final QR tile: {path}")
    quiet = {
        "top_px": int(dark_y.min()),
        "bottom_px": int(qr_size - 1 - dark_y.max()),
        "left_px": int(dark_x.min()),
        "right_px": int(qr_size - 1 - dark_x.max()),
    }
    min_quiet = min(quiet.values())
    if min_quiet < 12:
        fail(f"QR quiet zone is too narrow in {path}: {quiet}; require at least 12 px")

    pts = points[0]
    bbox_width = float(max(pts[:, 0]) - min(pts[:, 0]))
    bbox_height = float(max(pts[:, 1]) - min(pts[:, 1]))
    if min(bbox_width, bbox_height) < 100:
        fail(f"Detected QR is too small for a robust scan in {path}: {bbox_width:.1f}x{bbox_height:.1f}")

    return {
        "path": str(path.relative_to(ROOT)),
        "decoded_url": decoded,
        "url_matches": decoded == expected_url,
        "width": width,
        "height": height,
        "qr_tile_px": [qr_size, qr_size],
        "detected_qr_px": [round(bbox_width, 1), round(bbox_height, 1)],
        "contrast_percentile_range": contrast,
        "quiet_zone_px": quiet,
        "status": "PASS",
    }


def check_destination(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "DAVYLAB-Radar-Poster-QA/1.0", "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        # Consume a small portion so the connection proves a real HTTP response.
        response.read(512)
        status = int(response.status)
        final_url = response.geturl()
    if status < 200 or status >= 400:
        fail(f"Destination returned HTTP {status}: {final_url}")
    return {"requested_url": url, "final_url": final_url, "http_status": status, "status": "PASS"}


def main() -> int:
    manifest_path = POSTERS / "latest.json"
    if not manifest_path.is_file():
        print(f"ERROR: poster manifest not found: {manifest_path}", file=sys.stderr)
        return 1
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    today = dt.datetime.now(TZ).date().isoformat()
    expected_style = poster_style_metadata(today)
    record = {
        "report_date": today,
        "expected_url": PUBLIC_URL,
        "checked_at": dt.datetime.now(TZ).isoformat(),
        **expected_style,
        "checks": [],
        "status": "FAILED",
    }
    try:
        if manifest.get("report_date") != today:
            fail(f"Poster manifest date {manifest.get('report_date')!r} is not today ({today})")
        if manifest.get("qr_url") != PUBLIC_URL:
            fail(f"Manifest QR target mismatch: {manifest.get('qr_url')!r}")
        for key, expected in expected_style.items():
            if manifest.get(key) != expected:
                fail(f"Poster style metadata mismatch for {key}: got {manifest.get(key)!r}, expected {expected!r}")
        dated_path = ROOT / str(manifest.get("poster", ""))
        if dated_path.resolve().parent != POSTERS.resolve() or dated_path.suffix.lower() != ".png":
            fail(f"Manifest poster path is outside radar/posters or is not a PNG: {dated_path}")
        record["destination"] = check_destination(PUBLIC_URL)
        record["checks"].append({"name": "destination_reachable", "status": "PASS"})
        image_results = [
            decode_poster(dated_path, PUBLIC_URL),
            decode_poster(POSTERS / "latest.png", PUBLIC_URL),
        ]
        record["images"] = image_results
        record["checks"].extend([
            {"name": "weekly_style_matches_iso_week", "status": "PASS"},
            {"name": "dated_poster_final_image_qr_decode", "status": "PASS"},
            {"name": "latest_poster_final_image_qr_decode", "status": "PASS"},
            {"name": "exact_url_match", "status": "PASS"},
            {"name": "qr_size_contrast_quiet_zone", "status": "PASS"},
        ])
        record["status"] = "PASS"
    except Exception as exc:
        record["error"] = f"{type(exc).__name__}: {exc}"
        print(f"::error::Poster QR validation failed: {record['error']}", file=sys.stderr)
    finally:
        serialized = json.dumps(record, ensure_ascii=False, indent=2) + "\n"
        (POSTERS / f"{today}.qr-verification.json").write_text(serialized, encoding="utf-8")
        (POSTERS / "latest.qr-verification.json").write_text(serialized, encoding="utf-8")

    print(json.dumps(record, ensure_ascii=False, indent=2))
    return 0 if record["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
