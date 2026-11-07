#!/usr/bin/env python3
"""Generate a share-ready DAVYLAB daily AI brief infographic and QR code."""
from __future__ import annotations
import datetime as dt
import json
import hashlib
import tempfile
import os
import re
import urllib.request
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    from radar.scripts.poster_style import poster_style_metadata
except ModuleNotFoundError:
    from poster_style import poster_style_metadata
try:
    from radar.scripts.visual_lock import validate_visual_lock
except ModuleNotFoundError:
    from visual_lock import validate_visual_lock
from PIL import Image, ImageDraw, ImageFont, ImageOps
import qrcode

ROOT = Path.cwd().resolve() if (Path.cwd() / "radar" / "data" / "latest.json").exists() else Path(__file__).resolve().parents[2]
DATA = ROOT / "radar" / "data"
POSTERS = ROOT / "radar" / "posters"
TZ = ZoneInfo("Asia/Shanghai")
PUBLIC_URL = "https://chenzhe223-tech.github.io/radar/daily/"
W, H = 1200, 1800
TEXT_BOUNDS: list[dict] = []
QR_SIZE = 240
QR_X, QR_Y = 912, 1302
NAVY = (8, 25, 48)
BLUE = (38, 119, 225)
INK = (18, 30, 48)
MUTED = (90, 105, 123)
PAPER = (255, 253, 248)
WHITE = (255, 255, 255)
GOLD = (230, 176, 53)

def font(size, bold=False):
    candidates = (
        ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"]
        if bold else
        ["/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"]
    )
    for path in candidates:
        if Path(path).exists():
            try: return ImageFont.truetype(path, size)
            except Exception: pass
    raise RuntimeError('P0: no supported CJK font installed; refusing to render poster with silent fallback')

def wrap(draw, text, fnt, max_width):
    words = list(str(text or ""))
    lines, line = [], ""
    for ch in words:
        if draw.textlength(line + ch, font=fnt) <= max_width or not line:
            line += ch
        else:
            lines.append(line); line = ch
    if line: lines.append(line)
    return lines

def record_text_bounds(draw, lines, xy, fnt, width, line_step, block, truncated=False):
    x, y = xy
    if not lines:
        return
    actual_width = max(float(draw.textlength(line, font=fnt)) for line in lines)
    height = len(lines) * line_step
    if x < 0 or y < 0 or x + width > W or y + height > H or actual_width > width + 1:
        raise RuntimeError(f"P0 text bounds overflow in {block}: x={x}, y={y}, width={width}, height={height}, actual_width={actual_width}")
    TEXT_BOUNDS.append({
        "block": block, "x": int(x), "y": int(y), "width": int(width),
        "height": int(height), "actual_width": round(actual_width, 1),
        "line_count": len(lines), "truncated": bool(truncated), "overflow": False
    })


def paragraph(draw, text, xy, fnt, fill, width, max_lines=3, line_gap=5):
    x, y = xy
    y0 = y
    all_lines = wrap(draw, text, fnt, width)
    lines = all_lines[:max_lines]
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    record_text_bounds(draw, lines, (x, y0), fnt, width, fnt.size + line_gap, "paragraph", len(all_lines) > len(lines))
    return y


def choose_mini_card_summary(draw, story: dict, width: int):
    """Select a complete, source-derived mini-card line without hidden clipping.

    The last two news cards have room for three small text lines. Prefer the
    editorial poster summary; when it exceeds that space, use a complete
    alternate or a complete first sentence, never a truncated display.
    """
    candidates = [
        str(story.get("poster_summary_zh") or "").strip(),
        str(story.get("poster_why_zh") or "").strip(),
        str(story.get("what_zh") or "").strip(),
    ]
    seen = set()
    # Preserve the most useful complete editorial wording first. Only if no
    # complete summary fits should a full first sentence be considered.
    for sentence_only in (False, True):
        for value in candidates:
            if not value:
                continue
            candidate = (
                re.split(r"[。！？；;\\n]", value, maxsplit=1)[0].strip()
                if sentence_only else value
            )
            if not candidate or candidate in seen:
                continue
            seen.add(candidate)
            for text_size in (14, 13):
                fnt = font(text_size)
                if len(wrap(draw, candidate, fnt, width)) <= 3:
                    return candidate, fnt
    # The complete headline remains on the card and the full story is online.
    return "完整信息与来源详见正式简报", font(14)


def layout_regions_for(style):
    if style == "geometric-navy":
        return {
            "masthead": [58, 42, 1152, 110],
            "geometric-hero": [0, 0, 1200, 425],
            "editorial-observation": [48, 450, 1152, 575],
            "three-column-news-grid": [50, 608, 1150, 1122],
            "two-news-summary-row": [50, 1136, 1150, 1280],
            "skill-recommendation": [48, 1324, 868, 1538],
            "right-qr-panel": [900, 1290, 1164, 1664],
            "brand-footer": [0, 1700, 1200, 1800],
        }
    if style == "mountain-editorial":
        return {
            "masthead": [48, 24, 1152, 104],
            "hero-title-date": [48, 145, 1152, 520],
            "five-column-news-grid": [48, 750, 1152, 1278],
            "today-insight-banner": [48, 1290, 868, 1425],
            "skill-recommendation": [48, 1440, 868, 1688],
            "right-qr-panel": [900, 1290, 1164, 1664],
            "brand-footer": [48, 1720, 1152, 1800],
        }
    raise RuntimeError(f"Unsupported poster layout style: {style}")


def news_image_evidence(stories):
    evidence = []
    for story in stories[:5]:
        source = str(story.get("image_source") or "")
        status = str(story.get("image_match_status") or "")
        label_required = (
            story.get("poster_image_material_type") == "thematic_fallback"
            or status in {"thematic_fallback", "openverse_topic", "wikimedia_topic", "web_search_topic"}
            or "topic image" in source.lower()
            or "topic illustration" in source.lower()
        )
        label_applied = bool(story.get("poster_image_label_applied"))
        evidence.append({
            "story_url": str(story.get("source_url") or story.get("url") or ""),
            "image_source": source,
            "image_match_status": status,
            "image_sha256": story.get("image_sha256"),
            "rendered_image_sha256": story.get("poster_image_sha256"),
            "label_required": label_required,
            "label_applied": label_applied,
            "label": "主题配图 · 非新闻现场" if label_required else None,
        })
    return evidence

def mark_topic_illustration(image, story):
    """Label generic thematic fallback images so they cannot be mistaken for event photography."""
    image_source = str(story.get("image_source") or "")
    status = str(story.get("image_match_status") or "")
    if status not in {"thematic_fallback", "openverse_topic", "wikimedia_topic", "web_search_topic"} and "topic image" not in image_source.lower() and "topic illustration" not in image_source.lower():
        return image
    canvas = image.convert("RGBA")
    small = canvas.width < 220
    lines = ["主题配图", "非新闻现场"] if small else ["主题配图 · 非新闻现场"]
    size = 11 if small else 15
    band_h = min(36 if small else 30, canvas.height)
    band = Image.new("RGBA", (canvas.width, band_h), (8, 25, 48, 235))
    canvas.alpha_composite(band, (0, canvas.height - band_h))
    overlay_draw = ImageDraw.Draw(canvas)
    for index, line in enumerate(lines):
        overlay_draw.text((4 if small else 10, canvas.height - band_h + 3 + index * 14), line, font=font(size, True), fill=WHITE)
    story["poster_image_label_applied"] = True
    return canvas.convert("RGB")

def composite_same_size(background: Image.Image, overlay: Image.Image) -> Image.Image:
    """Alpha-composite same-sized images with an explicit diagnostic on mismatch."""
    if background.size != overlay.size:
        raise ValueError(f"Alpha-composite size mismatch: background={background.size}, overlay={overlay.size}")
    base = background.convert("RGBA")
    top = overlay.convert("RGBA")
    if base.size != top.size:
        raise ValueError(f"RGBA conversion changed dimensions: base={base.size}, overlay={top.size}")
    return Image.alpha_composite(base, top).convert("RGB")

def image_for_story(story, idx):
    """Load only the image already accepted by the news/image quality gate."""
    url = str(story.get("image_url") or "").strip()
    if not url.startswith("https://"):
        raise RuntimeError("Missing verified story image; rerun image matching and P0 gates")
    expected = str(story.get("image_sha256") or "")
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise RuntimeError("Missing verified story image digest; rerun P0 quality gate")
    cache = Path(tempfile.gettempdir()) / "davylab-verified-images" / expected
    last_error = None
    for _ in range(2):
        try:
            if cache.is_file():
                raw = cache.read_bytes()
            else:
                req = urllib.request.Request(url, headers={"User-Agent": "DAVYLAB-Radar-Poster/1.0"})
                with urllib.request.urlopen(req, timeout=5) as response:
                    raw = response.read(8 * 1024 * 1024)
            if hashlib.sha256(raw).hexdigest() != expected:
                raise RuntimeError("Image bytes changed after the P0 quality gate")
            story["poster_image_sha256"] = expected
            return Image.open(BytesIO(raw)).convert("RGB")
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"Cannot load verified story image {url}; refusing unverified substitution") from last_error


def story_photo(story, idx, size):
    # Disclosure must be painted on the final crop, never on pixels that a later
    # cover-crop may discard. Evidence is set only by the drawing operation.
    story.pop("poster_image_label_applied", None)
    return mark_topic_illustration(crop_cover(image_for_story(story, idx), size), story)


def crop_cover(img, size):
    return ImageOps.fit(img, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def render_mountain_editorial(report: dict, date: str, top: list[dict], skill: dict) -> None:
    """Reference-aligned mountain editorial poster: masthead, oversized date, five equal news columns, insight, Skill and right-side QR."""
    canvas = Image.new("RGB", (W, H), (252, 250, 245))
    draw = ImageDraw.Draw(canvas)
    ink = (12, 31, 61)
    blue = (15, 79, 184)
    muted = (78, 91, 110)
    line = (192, 202, 211)
    orange = (244, 91, 48)
    paper = (252, 250, 245)

    hero = None
    try:
        url = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=88"
        req = urllib.request.Request(url, headers={"User-Agent": "DAVYLAB-Radar-Poster/2.3"})
        with urllib.request.urlopen(req, timeout=8) as response:
            hero = Image.open(BytesIO(response.read(12 * 1024 * 1024))).convert("RGB")
    except Exception:
        hero = None
    if hero is not None:
        canvas.paste(crop_cover(hero, (W, 520)), (0, 0))
        veil = Image.new("RGBA", canvas.size, (255, 255, 255, 0))
        vd = ImageDraw.Draw(veil)
        for xx in range(0, 900, 6):
            alpha = max(0, min(245, int(246 * (1 - xx / 980))))
            vd.rectangle((xx, 0, xx + 6, 520), fill=(255, 253, 248, alpha))
        canvas = composite_same_size(canvas, veil)
    else:
        draw.rectangle((0, 0, W, 520), fill=(238, 244, 247))
        draw.polygon([(0, 370), (150, 230), (310, 360), (490, 130), (670, 330), (840, 185), (1030, 315), (1200, 220), (1200, 520), (0, 520)], fill=(184, 205, 219))
        draw.polygon([(0, 425), (200, 315), (390, 410), (600, 270), (780, 420), (980, 300), (1200, 390), (1200, 520), (0, 520)], fill=(116, 150, 177))
    draw = ImageDraw.Draw(canvas)

    date_obj = dt.date.fromisoformat(date)
    weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    # Locked 2026-10-31 approved masthead hierarchy, adapted to the 1200x1800 website canvas.
    hero_white = (255, 253, 248)
    hero_soft = (244, 247, 250)
    draw.text((48, 24), "DAVYLAB", font=font(36, True), fill=hero_white)
    draw.text((50, 70), f"AI FRONTIER BRIEF  ·  {date_obj.strftime('%Y.%m.%d')}", font=font(16, True), fill=hero_soft)
    draw.line((50, 104, 96, 104), fill=orange, width=5)
    draw.text((1150, 30), "用 AI 打开更大的世界", font=font(18, True), fill=hero_white, anchor="ra")
    draw.text((1150, 61), "A WIDER WORLD", font=font(12, True), fill=hero_soft, anchor="ra")
    draw.text((1150, 79), "A BRIGHTER YOU", font=font(12, True), fill=hero_soft, anchor="ra")
    draw.text((48, 145), "AI 前沿简报", font=font(96, True), fill=hero_white)
    draw.text((52, 250), "AI FRONTIER BRIEF", font=font(29, True), fill=hero_white)
    draw.text((52, 305), "全球视野  ·  中国力量  ·  每日精选  ·  实用指南", font=font(20, True), fill=hero_soft)
    draw.text((1150, 150), date_obj.strftime("%Y"), font=font(25, True), fill=ink, anchor="ra")
    draw.text((1150, 180), date_obj.strftime("%m.%d"), font=font(50, True), fill=ink, anchor="ra")
    draw.text((1150, 236), weekdays[date_obj.weekday()], font=font(19, True), fill=ink, anchor="ra")
    draw.line((1075, 270, 1150, 270), fill=orange, width=5)
    draw.text((52, 405), "让 AI 成为更好的自己", font=font(31, True), fill=hero_white)
    draw.line((55, 454, 250, 454), fill=orange, width=6)

    editorial = report.get("editorial") or {}
    headline = str(editorial.get("headline_zh") or editorial.get("core_zh") or "AI 竞赛进入深水区：资本扩张与智能体安全并进")
    subline = str(editorial.get("poster_trend_zh") or editorial.get("trend_zh") or "AI 正从模型能力比拼走向任务执行、结果验证与真实场景落地。")
    draw.rectangle((48, 538, 118, 544), fill=orange)
    def clamped_lines(text, fnt, width, max_lines):
        lines = wrap(draw, str(text or ""), fnt, width)
        if len(lines) > max_lines:
            lines = lines[:max_lines]
            last = lines[-1]
            while last and draw.textlength(last + "…", font=fnt) > width:
                last = last[:-1]
            lines[-1] = (last or "") + "…"
        return lines
    y = 557
    headline_font = font(38, True)
    headline_lines = clamped_lines(headline, headline_font, 1100, 2)
    record_text_bounds(draw, headline_lines, (48, y), headline_font, 1100, 46, "hero_headline", len(wrap(draw, headline, headline_font, 1100)) > 2)
    for line_text in headline_lines:
        draw.text((48, y), line_text, font=headline_font, fill=ink)
        y += 46
    paragraph(draw, subline, (50, 651), font(18), muted, 1090, 2, 4)
    draw.text((48, 704), "今日精选", font=font(25, True), fill=ink)
    draw.text((195, 714), "THE SIGNALS  /  5 STORIES WORTH YOUR ATTENTION", font=font(12, True), fill=muted)
    draw.line((48, 739, 1152, 739), fill=line, width=2)

    # Five equal columns; each column uses a fixed title/summary/image area to avoid layout drift.
    margin, gap = 48, 13
    col_w = 210
    col_top, col_bottom = 750, 1278
    for idx, story in enumerate(top[:5]):
        x = margin + idx * (col_w + gap)
        if idx:
            draw.line((x - 7, col_top, x - 7, col_bottom), fill=line, width=1)
        draw.text((x, 748), f"{idx + 1:02d}", font=font(43, True), fill=blue)
        source = str(story.get("source") or "公开来源")
        if str(story.get("confidence") or "").lower() == "low":
            source += " · 低置信度"
        draw.text((x, 794), source[:24], font=font(11, True), fill=orange)
        title = str(story.get("title_zh") or story.get("original_title") or story.get("title") or "AI 新闻")
        ty = 817
        title_font = font(18, True)
        title_lines = clamped_lines(title, title_font, col_w - 4, 3)
        record_text_bounds(draw, title_lines, (x, ty), title_font, col_w - 4, 22, f"story_{idx + 1}_title", len(wrap(draw, title, title_font, col_w - 4)) > 3)
        for line_text in title_lines:
            draw.text((x, ty), line_text, font=title_font, fill=ink)
            ty += 22
        summary = str(story.get("poster_summary_zh") or story.get("what_zh") or story.get("summary_zh") or story.get("summary") or "")
        sy = 889
        summary_font = font(14)
        summary_lines = clamped_lines(summary, summary_font, col_w - 4, 4)
        record_text_bounds(draw, summary_lines, (x, sy), summary_font, col_w - 4, 18, f"story_{idx + 1}_summary", len(wrap(draw, summary, summary_font, col_w - 4)) > 4)
        for line_text in summary_lines:
            draw.text((x, sy), line_text, font=summary_font, fill=muted)
            sy += 18
        why = str(story.get("poster_why_zh") or story.get("why_zh") or story.get("why_it_matters_zh") or story.get("editor_judgment_zh") or "")
        wy = 968
        why_font = font(13, True)
        why_lines = clamped_lines(why, why_font, col_w - 4, 3)
        record_text_bounds(draw, why_lines, (x, wy), why_font, col_w - 4, 17, f"story_{idx + 1}_why", len(wrap(draw, why, why_font, col_w - 4)) > 3)
        for line_text in why_lines:
            draw.text((x, wy), line_text, font=why_font, fill=(52, 71, 96))
            wy += 17
        image_y, image_h = 1034, 154
        photo = story_photo(story, idx, (col_w, image_h))
        canvas.paste(photo, (x, image_y))
        draw.text((x, 1200), str(story.get("published") or "")[:10], font=font(11), fill=muted)
        draw.text((x, 1220), "阅读原文 ↗", font=font(12, True), fill=blue)

    # Insight banner: left-aligned copy, with a quiet editorial landscape panel on the right.
    draw.rounded_rectangle((48, 1290, 868, 1425), radius=12, fill=(231, 242, 250), outline=(211, 226, 238), width=1)
    draw.rounded_rectangle((64, 1306, 172, 1342), radius=4, fill=blue)
    draw.text((78, 1311), "今日观察", font=font(18, True), fill=WHITE)
    observation = str(editorial.get("poster_trend_zh") or editorial.get("trend_zh") or "AI 正从模型能力比拼走向任务执行、结果验证与真实场景落地。")
    paragraph(draw, observation, (190, 1305), font(19, True), ink, 650, 2, 4)
    next_q = str(editorial.get("next_question_zh") or "真正的价值，取决于能否在真实场景中完成任务并守住权限边界。")
    paragraph(draw, next_q, (66, 1362), font(14), muted, 780, 2, 3)

    # Skill recommendation card. The QR occupies its own white column at the right.
    draw.rounded_rectangle((48, 1440, 868, 1688), radius=12, fill=(255, 254, 250), outline=(211, 216, 220), width=1)
    draw.rounded_rectangle((48, 1440, 226, 1478), radius=5, fill=orange)
    draw.text((63, 1447), "本期推荐 Skill", font=font(18, True), fill=WHITE)
    skill_name = str(skill.get("name") or "Open-source AI Skill")
    skill_name_font = font(25, True)
    name_lines = clamped_lines(skill_name, skill_name_font, 555, 2)
    ny = 1490
    record_text_bounds(draw, name_lines, (80, ny), skill_name_font, 555, 30, "skill_name", len(wrap(draw, skill_name, skill_name_font, 555)) > 2)
    for line_text in name_lines:
        draw.text((80, ny), line_text, font=skill_name_font, fill=ink)
        ny += 30
    desc = str(skill.get("description_zh") or skill.get("description") or "一个可用于日常研发的开源 AI 工作流技能。")
    paragraph(draw, desc, (80, 1554), font(15), muted, 565, 3, 4)
    topics = "适用方向：" + " · ".join((skill.get("topics") or [])[:4])
    paragraph(draw, topics, (80, 1628), font(12, True), muted, 565, 2, 2)
    stars = skill.get("stars")
    star_label = f"★ {int(stars):,}" if isinstance(stars, (int, float)) else "热度未核实"
    draw.text((680, 1496), star_label, font=font(17, True), fill=blue)
    draw.text((680, 1530), "最近更新", font=font(11), fill=muted)
    draw.text((680, 1548), str(skill.get("updated") or skill.get("pushed_at") or "—")[:10], font=font(13, True), fill=ink)
    draw.text((680, 1584), str(skill.get("license") or skill.get("license_name") or "许可待确认")[:20], font=font(12, True), fill=blue)
    draw.text((680, 1614), "使用前核对权限", font=font(11), fill=muted)

    # Real, locally encoded QR. Keep its reserved tile fixed for the final-image verifier.
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(PUBLIC_URL)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((QR_SIZE, QR_SIZE), Image.Resampling.NEAREST)
    draw.rounded_rectangle((900, 1290, 1164, 1664), radius=12, fill=WHITE, outline=ink, width=2)
    canvas.paste(qr_img, (QR_X, QR_Y))
    draw.text((912, 1553), "扫码阅读完整简报", font=font(15, True), fill=ink)
    draw.text((912, 1578), "chenzhe223-tech.github.io", font=font(10), fill=blue)
    draw.text((912, 1595), "/radar/daily/", font=font(10), fill=blue)
    draw.text((912, 1623), "正式入口 · 已编码", font=font(11, True), fill=muted)

    draw.line((48, 1720, 1152, 1720), fill=line, width=1)
    draw.text((48, 1740), "DAVYLAB  ·  AI FRONTIER BRIEF", font=font(15, True), fill=ink)
    draw.line((410, 1751, 870, 1751), fill=line, width=1)
    draw.text((1152, 1740), "真实来源  |  趋势观察  |  创作机会", font=font(12, True), fill=ink, anchor="ra")

    POSTERS.mkdir(parents=True, exist_ok=True)
    out = POSTERS / f"{date}.png"
    canvas.save(out, format="PNG", optimize=True)
    canvas.save(POSTERS / "latest.png", format="PNG", optimize=True)
    manifest = {
        "report_date": date,
        "poster": str(out.relative_to(ROOT)),
        "qr_url": PUBLIC_URL,
        "news_count": 5,
        "news_urls": [str(s.get("source_url") or s.get("url") or "") for s in top[:5]],
        "news_titles": [str(s.get("title_zh") or s.get("original_title") or s.get("title") or "") for s in top[:5]],
        "news_image_evidence": news_image_evidence(top),
        "skill": skill_name,
        "design": "mountain-editorial",
        "format": "PNG",
        "canvas": [W, H],
        "layout_regions": layout_regions_for("mountain-editorial"),
        "text_bounds": list(TEXT_BOUNDS),
        **poster_style_metadata(date),
        "generated_at": dt.datetime.now(TZ).isoformat(),
    }
    (POSTERS / f"{date}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (POSTERS / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated mountain editorial poster {out} ({W}x{H}); QR target: {PUBLIC_URL}")


def render_alternating_template(report: dict, date: str, top: list[dict], skill: dict) -> bool:
    """Render the single template assigned to the ISO week; retries stay deterministic."""
    selected = poster_style_metadata(date)["design_variant"]
    if selected == "mountain-editorial":
        render_mountain_editorial(report, date, top, skill)
        return True
    if selected == "geometric-navy":
        return False  # main() below contains the complete geometric-navy template.
    raise RuntimeError(f"Unknown weekly poster style: {selected!r}")

def main():
    TEXT_BOUNDS.clear()
    report = json.loads((DATA / "latest.json").read_text(encoding="utf-8"))
    date = report.get("report_date", "")
    today = dt.datetime.now(TZ).date().isoformat()
    if date != today:
        raise SystemExit(f"Refusing to generate poster for stale report {date}; expected {today}")
    lock = validate_visual_lock(date)
    print("Visual lock PASS: " + lock["baseline_id"] + " / " + lock["design_variant"] + " / " + str(lock["canvas"]))

    raw_top = report.get("top5") or []
    news_by_url = {str(item.get("url") or "").rstrip("/"): item for item in (report.get("news") or [])}
    top = []
    for story in raw_top:
        url = str(story.get("source_url") or story.get("url") or "").rstrip("/")
        merged = dict(news_by_url.get(url, {}))
        merged.update(story)
        top.append(merged)
    if len(top) < 5:
        seen = {str(x.get("source_url") or x.get("url") or "").rstrip("/") for x in top}
        for item in report.get("news", []):
            url = str(item.get("url") or "").rstrip("/")
            if not url or url in seen:
                continue
            top.append({
                **item,
                "source_url": item.get("url"),
                "title_zh": item.get("title_zh") or item.get("title") or "AI 新闻",
                "what_zh": item.get("summary_zh") or item.get("summary") or "",
                "why_zh": item.get("why_it_matters_zh") or "",
            })
            seen.add(url)
            if len(top) >= 5:
                break
    if len(top) < 5:
        raise SystemExit("Poster needs five source-backed stories")

    skills = report.get("skills") or []
    if not skills:
        raise SystemExit("Poster needs one repository-backed Skill recommendation")
    skill = skills[0]

    if render_alternating_template(report, date, top, skill):
        return

    # ISO-selected geometric-navy template, aligned with the official 2026-10-23 reference:
    # deep-navy geometric mountain hero + warm-white editorial body + restrained orange accents.
    # Do not replace the hero with generic stock photography; the mountains are intentional geometric brand art.
    canvas = Image.new("RGB", (W, H), (250, 247, 239))
    draw = ImageDraw.Draw(canvas)
    dark = (16, 35, 61)
    navy2 = (28, 58, 82)
    blue = (43, 91, 126)
    orange = (232, 145, 93)
    paper = (250, 247, 239)
    ink = (25, 40, 57)
    muted = (82, 99, 116)
    light_line = (218, 219, 214)

    # Official geometric-navy hero: deep navy, warm amber sun, and layered geometric mountain silhouettes.
    # This composition is the approved reference treatment for geometric-navy (ISO week 43).
    for yy in range(0, 425):
        t = yy / 425
        c = (int(13 + 17*t), int(31 + 25*t), int(54 + 28*t))
        draw.line((0, yy, W, yy), fill=c)
    draw.ellipse((820, -190, 1190, 180), fill=(236, 165, 112))
    draw.ellipse((865, -145, 1145, 135), fill=(247, 198, 143))
    draw.polygon([(0, 350), (110, 280), (220, 330), (360, 235), (480, 315), (620, 215), (745, 330), (860, 250), (1000, 318), (1200, 250), (1200, 425), (0, 425)], fill=(56, 88, 111))
    draw.polygon([(0, 385), (165, 305), (300, 365), (455, 300), (590, 360), (725, 286), (865, 366), (1025, 300), (1200, 355), (1200, 425), (0, 425)], fill=(39, 65, 86))
    draw.polygon([(0, 408), (170, 365), (320, 395), (470, 350), (650, 405), (820, 352), (980, 394), (1100, 360), (1200, 390), (1200, 425), (0, 425)], fill=(27, 49, 70))
    draw.rectangle((58, 42, 66, 91), fill=orange)
    draw.text((84, 42), "DAVYLAB", font=font(34, True), fill=(255, 253, 248))
    draw.text((86, 85), "AI FRONTIER BRIEF  /  DAILY", font=font(13, True), fill=(207, 220, 228))
    draw.text((1135, 49), date.replace("-", "  /  "), font=font(24, True), fill=(255, 253, 248), anchor="ra")
    draw.text((1135, 83), "每日 AI 前沿观察", font=font(15), fill=(219, 229, 235), anchor="ra")
    draw.text((58, 135), "AI 前沿简报", font=font(72, True), fill=(255, 253, 248))
    draw.text((64, 224), "看见趋势  ·  发现机会  ·  打开新可能", font=font(23), fill=(227, 236, 240))
    draw.rounded_rectangle((62, 276, 220, 313), radius=6, fill=orange)
    draw.text((80, 282), "TODAY'S SIGNALS", font=font(15, True), fill=dark)
    hero_signal = str((report.get("editorial") or {}).get("poster_trend_zh") or (report.get("editorial") or {}).get("trend_zh") or (top[0].get("title_zh") if top else "") or "从最新 AI 新闻中发现值得关注的变化。")
    paragraph(draw, hero_signal, (64, 329), font(22, True), (255, 253, 248), 1070, 2, 3)

    # Today's observation is the editorial synthesis of the source-linked shortlist.
    draw.rounded_rectangle((48, 450, 1152, 575), radius=18, fill=(237, 239, 235), outline=(221, 225, 220), width=2)
    draw.rounded_rectangle((48, 450, 58, 575), radius=4, fill=orange)
    draw.text((82, 472), "今日推荐", font=font(25, True), fill=blue)
    observation = str((report.get("editorial") or {}).get("core_zh") or (top[0].get("why_zh") if top else "") or "从今日新闻中寻找可验证、可实践的 AI 机会。")
    paragraph(draw, observation, (250, 469), font(21), ink, 850, 3, 7)

    draw.text((50, 608), "今日精选", font=font(31, True), fill=ink)
    draw.text((240, 620), "THE SIGNALS  /  5 STORIES WORTH YOUR ATTENTION", font=font(15, True), fill=muted)
    draw.line((50, 650, 1150, 650), fill=light_line, width=2)

    card_w, card_y, card_h, gap = 350, 672, 450, 25
    xs = [50, 50 + card_w + gap, 50 + 2 * (card_w + gap)]
    for i, story in enumerate(top[:3]):
        x = xs[i]
        draw.rounded_rectangle((x, card_y, x + card_w, card_y + card_h), radius=16, fill=(255, 254, 250), outline=light_line, width=2)
        photo = story_photo(story, i, (card_w - 2, 132))
        canvas.paste(photo, (x + 1, card_y + 1))
        draw.rounded_rectangle((x + 13, card_y + 12, x + 54, card_y + 51), radius=8, fill=orange)
        draw.text((x + 25, card_y + 16), f"{i+1:02d}", font=font(21, True), fill=dark)
        title = story.get("title_zh") or story.get("original_title") or story.get("title") or "AI 新闻"
        yy = paragraph(draw, title, (x + 16, card_y + 151), font(21, True), ink, card_w - 32, 4, 4)
        summary = story.get("poster_summary_zh") or story.get("what_zh") or story.get("summary_zh") or story.get("summary") or ""
        yy = paragraph(draw, summary, (x + 16, yy + 8), font(16), muted, card_w - 32, 4, 5)
        source = str(story.get("source") or "公开来源")
        if str(story.get("confidence") or "").lower() == "low":
            source += " · 低置信度"
        source = source[:25]
        draw.line((x + 16, card_y + card_h - 48, x + card_w - 16, card_y + card_h - 48), fill=(228, 229, 224), width=1)
        draw.text((x + 16, card_y + card_h - 36), source, font=font(13, True), fill=blue)
        draw.text((x + card_w - 16, card_y + card_h - 36), "阅读原文 ↗", font=font(13), fill=orange, anchor="ra")

    # Two additional headlines maintain the five-story promise without squeezing the three-column layout.
    mini_y, mini_h, mini_w = 1136, 144, 537
    for index, story in enumerate(top[3:5], start=3):
        x = 50 + (index - 3) * (mini_w + 26)
        draw.rounded_rectangle((x, mini_y, x + mini_w, mini_y + mini_h), radius=14, fill=(255, 254, 250), outline=light_line, width=2)
        thumb = story_photo(story, index, (115, 118))
        canvas.paste(thumb, (x + 12, mini_y + 18))
        draw.text((x + 145, mini_y + 14), f"{index+1:02d}  /  {str(story.get('source') or '公开来源')[:22]}", font=font(13, True), fill=blue)
        title = story.get("title_zh") or story.get("original_title") or story.get("title") or "AI 新闻"
        yy = paragraph(draw, title, (x + 145, mini_y + 40), font(18, True), ink, mini_w - 165, 2, 3)
        summary, summary_font = choose_mini_card_summary(draw, story, mini_w - 165)
        # Three lines fit this fixed 144px card even when the headline uses two.
        paragraph(draw, summary, (x + 145, yy + 4), summary_font, muted, mini_w - 165, 3, 3)

    # Compact open-source recommendation panel with a reserved right-side QR column.
    draw.rounded_rectangle((48, 1324, 868, 1538), radius=18, fill=(245, 235, 215), outline=(232, 218, 191), width=2)
    draw.rectangle((48, 1324, 58, 1538), fill=orange)
    draw.text((82, 1345), "今日推荐  /  OPEN-SOURCE SKILL", font=font(19, True), fill=blue)
    skill_name = str(skill.get("name") or "Open-source AI Skill")
    paragraph(draw, skill_name, (82, 1380), font(24, True), ink, 550, 2, 3)
    desc = str(skill.get("poster_description_zh") or skill.get("description_zh") or skill.get("description") or "开源 AI 工作流与智能体工具。")
    # The featured Skill description may be longer than a single short blurb.
    # Keep the full text, but use the approved minimum body size and four-line
    # reserved area so it never silently clips or collides with the topics row.
    paragraph(draw, desc, (82, 1434), font(13), ink, 565, 4, 2)
    topics = "适用方向： " + " · ".join((skill.get("topics") or [])[:4]) or (skill.get("language") or "AI 工作流")
    paragraph(draw, topics, (82, 1500), font(12, True), muted, 550, 2, 2)
    stars = skill.get("stars")
    star_label = f"★ {int(stars):,}" if isinstance(stars, (int, float)) else "社区热度未核实"
    draw.text((680, 1386), star_label, font=font(17, True), fill=blue)
    draw.text((680, 1422), "最近更新", font=font(11), fill=muted)
    draw.text((680, 1440), (str(skill.get("updated") or "")[:10] or "—"), font=font(13, True), fill=ink)
    draw.text((680, 1472), str(skill.get("license") or skill.get("license_name") or "许可待确认")[:18], font=font(12, True), fill=blue)
    draw.text((680, 1502), "使用前查看 README 与权限", font=font(10), fill=muted)

    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(PUBLIC_URL)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((QR_SIZE, QR_SIZE), Image.Resampling.NEAREST)
    draw.rounded_rectangle((900, 1290, 1164, 1664), radius=12, fill=WHITE, outline=dark, width=2)
    canvas.paste(qr_img, (QR_X, QR_Y))
    draw.text((912, 1553), "扫码阅读完整简报", font=font(15, True), fill=(16, 35, 61))
    draw.text((912, 1578), "chenzhe223-tech.github.io", font=font(10), fill=blue)
    draw.text((912, 1595), "/radar/daily/", font=font(10), fill=blue)
    draw.text((912, 1623), "正式入口 · 已编码", font=font(11, True), fill=muted)

    draw.rectangle((0, 1700, W, H), fill=dark)
    draw.text((48, 1728), "DAVYLAB  ·  AI FRONTIER BRIEF", font=font(15, True), fill=(255, 253, 248))
    draw.line((410, 1740, 870, 1740), fill=orange, width=2)
    draw.text((1152, 1728), "真实来源  |  趋势观察  |  创作机会", font=font(12, True), fill=(225, 233, 238), anchor="ra")

    POSTERS.mkdir(parents=True, exist_ok=True)
    out = POSTERS / f"{date}.png"
    canvas.save(out, format="PNG", optimize=True)
    canvas.save(POSTERS / "latest.png", format="PNG", optimize=True)
    manifest = {
        "report_date": date,
        "poster": str(out.relative_to(ROOT)),
        "qr_url": PUBLIC_URL,
        "news_count": 5,
        "news_urls": [str(s.get("source_url") or s.get("url") or "") for s in top[:5]],
        "news_titles": [str(s.get("title_zh") or s.get("original_title") or s.get("title") or "") for s in top[:5]],
        "news_image_evidence": news_image_evidence(top),
        "skill": skill_name,
        "design": "geometric-navy",
        "format": "PNG",
        "canvas": [W, H],
        "layout_regions": layout_regions_for("geometric-navy"),
        "text_bounds": list(TEXT_BOUNDS),
        **poster_style_metadata(date),
        "generated_at": dt.datetime.now(TZ).isoformat(),
    }
    (POSTERS / f"{date}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (POSTERS / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated editorial poster {out} ({W}x{H}); QR target: {PUBLIC_URL}")

if __name__ == "__main__":
    main()
