#!/usr/bin/env python3
"""Generate a share-ready DAVYLAB daily AI brief infographic and QR code."""
from __future__ import annotations
import datetime as dt
import json
import os
import re
import urllib.request
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo
from PIL import Image, ImageDraw, ImageFont, ImageOps
import qrcode

ROOT = Path.cwd().resolve() if (Path.cwd() / "radar" / "data" / "latest.json").exists() else Path(__file__).resolve().parents[2]
DATA = ROOT / "radar" / "data"
POSTERS = ROOT / "radar" / "posters"
TZ = ZoneInfo("Asia/Shanghai")
PUBLIC_URL = "https://davylab.github.io/radar/daily/"
W, H = 1200, 1800
NAVY = (8, 25, 48)
BLUE = (38, 119, 225)
INK = (18, 30, 48)
MUTED = (90, 105, 123)
PAPER = (255, 253, 248)
WHITE = (255, 255, 255)
GOLD = (230, 176, 53)

def font(size, bold=False):
    candidates = (
        ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
        if bold else
        ["/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    for path in candidates:
        if Path(path).exists():
            try: return ImageFont.truetype(path, size)
            except Exception: pass
    return ImageFont.load_default()

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

def paragraph(draw, text, xy, fnt, fill, width, max_lines=3, line_gap=5):
    x, y = xy
    lines = wrap(draw, text, fnt, width)[:max_lines]
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y

def image_for_story(story, idx):
    """Try matched image, saved backup, then story-category web illustration."""
    candidates = [str(story.get("image_url") or "").strip(), str(story.get("image_fallback_url") or "").strip()]
    title = " ".join(str(story.get(k) or "") for k in ("title_zh", "title_en", "original_title", "title")).lower()
    photo_ids = []
    patterns = [
        (r"robot|agent|智能体|机器人|具身智能|automation|自动驾驶", "photo-1485827404703-89b55fcc595e"),
        (r"chip|compute|semiconductor|gpu|model|llm|gpt|deepseek|算力|芯片|模型|推理", "photo-1518770660439-4636190af475"),
        (r"phone|mobile|app|software|product|platform|应用|手机|软件|产品", "photo-1512941937669-90a1b58e7e9c"),
        (r"business|company|customer|market|fund|investment|银行|企业|客户|商业|融资|股份|公司", "photo-1519389950473-47ba0277781c"),
        (r"image|video|design|creative|图像|视频|设计|创作|图像生成|图片生成|视频生成|内容生成|生成图片|生成视频", "photo-1470252649378-9c29740c9fa8"),
    ]
    for pattern, photo_id in patterns:
        if re.search(pattern, title):
            photo_ids.append(photo_id)
    photo_ids.extend(["photo-1531297484001-80022131f5a1", "photo-1498050108023-c5249f4df085"])
    candidates.extend(f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=700&q=82" for photo_id in photo_ids)
    seen = set()
    for url in candidates:
        if not url.startswith("https://") or url in seen:
            continue
        seen.add(url)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DAVYLAB-Radar-Poster/1.0"})
            with urllib.request.urlopen(req, timeout=8) as r:
                raw = r.read(16 * 1024 * 1024)
            return Image.open(BytesIO(raw)).convert("RGB")
        except Exception:
            continue
    # Keep a polished editorial composition when network images are unavailable.
    img = Image.new("RGB", (700, 380), (232, 237, 239))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((20, 20, 680, 360), radius=22, outline=(194, 205, 213), width=3)
    d.text((42, 48), "DAVYLAB  /  AI TOPIC VISUAL", font=font(25, True), fill=(58, 79, 99))
    title_text = str(story.get("title_zh") or story.get("original_title") or story.get("title_en") or "AI topic illustration")
    paragraph(d, title_text, (42, 112), font(24, True), (36, 55, 73), 600, 4, 8)
    d.text((42, 310), "TOPIC ILLUSTRATION  ·  OPEN SOURCE ARTICLE", font=font(14), fill=(99, 117, 131))
    return img

def crop_cover(img, size):
    return ImageOps.fit(img, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def render_mountain_editorial(report: dict, date: str, top: list[dict], skill: dict) -> None:
    """Second fixed brand template: warm-white editorial cover with a mountain hero.
    The daily data changes, while the layout, type hierarchy and restrained navy/blue
    palette remain fixed. All QR data is encoded locally to the stable public URL.
    """
    canvas = Image.new("RGB", (W, H), (252, 250, 245))
    draw = ImageDraw.Draw(canvas)
    ink = (12, 31, 61)
    blue = (28, 83, 160)
    muted = (78, 91, 110)
    line = (202, 207, 211)
    orange = (229, 91, 68)
    paper = (252, 250, 245)

    # Mountain photo is decorative only; fallback stays coherent if image hosting is down.
    hero = None
    try:
        url = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=85"
        req = urllib.request.Request(url, headers={"User-Agent": "DAVYLAB-Radar-Poster/1.0"})
        with urllib.request.urlopen(req, timeout=8) as response:
            hero = Image.open(BytesIO(response.read(12 * 1024 * 1024))).convert("RGB")
    except Exception:
        hero = None
    if hero is not None:
        canvas.paste(crop_cover(hero, (W, 520)), (0, 0))
        # Light editorial veil behind copy; keep the mountain visible on the right.
        veil = Image.new("RGBA", canvas.size, (255, 255, 255, 0))
        vd = ImageDraw.Draw(veil)
        for xx in range(0, 780, 8):
            alpha = int(236 * (1 - xx / 940))
            vd.rectangle((xx, 0, xx + 8, 520), fill=(255, 253, 248, max(0, alpha)))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), veil).convert("RGB")
        draw = ImageDraw.Draw(canvas)
    else:
        draw.rectangle((0, 0, W, 520), fill=(239, 244, 247))
        draw.polygon([(0, 380), (170, 210), (320, 345), (520, 135), (700, 320), (860, 180), (1050, 300), (1200, 220), (1200, 520), (0, 520)], fill=(181, 202, 215))
        draw.polygon([(0, 430), (210, 315), (390, 410), (590, 270), (770, 420), (960, 300), (1200, 390), (1200, 520), (0, 520)], fill=(116, 150, 177))

    # Stable masthead and date lockup.
    draw.text((48, 36), "DAVYLAB", font=font(33, True), fill=ink)
    draw.line((48, 82, 118, 82), fill=blue, width=5)
    draw.text((48, 91), "A I   F R O N T I E R   B R I E F", font=font(13, True), fill=ink)
    date_obj = dt.date.fromisoformat(date)
    draw.text((1150, 42), date_obj.strftime("%m.%d"), font=font(46, True), fill=blue, anchor="ra")
    draw.text((1150, 92), date_obj.strftime("%a").upper() + "  /  " + date_obj.strftime("%Y"), font=font(15, True), fill=ink, anchor="ra")
    draw.text((48, 145), "AI 前沿简报", font=font(69, True), fill=ink)
    draw.text((54, 226), "全球视野  |  深度精选  |  实用洞察", font=font(21), fill=ink)

    editorial = report.get("editorial") or {}
    headline = str(editorial.get("core_zh") or (top[0].get("title_zh") if top else "") or "AI 的新机会，正在真实场景中发生。")
    headline_lines = wrap(draw, headline, font(28, True), 1040)[:2]
    yy = 304
    for line_text in headline_lines:
        draw.text((52, yy), line_text, font=font(28, True), fill=ink)
        yy += 39
    subline = str(editorial.get("trend_zh") or (top[0].get("why_zh") if top else "") or "从新闻事实出发，寻找值得继续验证的变化。")
    paragraph(draw, subline, (54, 390), font(17), ink, 840, 3, 4)
    draw.rectangle((50, 486, 118, 491), fill=orange)

    # Daily observation and story cards.
    draw.text((48, 548), "今日精选", font=font(31, True), fill=ink)
    draw.text((240, 560), "THE SIGNALS  /  5 STORIES WORTH YOUR ATTENTION", font=font(14, True), fill=muted)
    draw.line((48, 594, 1152, 594), fill=line, width=2)
    card_y, card_h, card_w, gap = 618, 400, 350, 26
    xs = [48, 48 + card_w + gap, 48 + 2 * (card_w + gap)]
    for i, story in enumerate(top[:3]):
        x = xs[i]
        draw.rounded_rectangle((x, card_y, x + card_w, card_y + card_h), radius=8, fill=(255, 255, 253), outline=line, width=2)
        photo = crop_cover(image_for_story(story, i), (card_w - 4, 142))
        canvas.paste(photo, (x + 2, card_y + 2))
        draw.rectangle((x + 14, card_y + 12, x + 58, card_y + 49), fill=blue)
        draw.text((x + 23, card_y + 16), f"{i+1:02d}", font=font(19, True), fill=WHITE)
        title = str(story.get("title_zh") or story.get("original_title") or story.get("title") or "AI 新闻")
        ty = paragraph(draw, title, (x + 15, card_y + 157), font(20, True), ink, card_w - 30, 4, 3)
        summary = str(story.get("what_zh") or story.get("summary_zh") or story.get("summary") or "")
        paragraph(draw, summary, (x + 15, ty + 5), font(15), muted, card_w - 30, 4, 4)
        draw.line((x + 15, card_y + card_h - 42, x + card_w - 15, card_y + card_h - 42), fill=line, width=1)
        draw.text((x + 15, card_y + card_h - 31), str(story.get("source") or "公开来源")[:23], font=font(12, True), fill=blue)

    # Two additional headlines in the same compact editorial rhythm.
    mini_y, mini_h, mini_w = 1040, 142, 538
    for idx, story in enumerate(top[3:5]):
        x = 48 + idx * (mini_w + 28)
        draw.rounded_rectangle((x, mini_y, x + mini_w, mini_y + mini_h), radius=8, fill=(255, 255, 253), outline=line, width=2)
        thumb = crop_cover(image_for_story(story, idx + 3), (112, 110))
        canvas.paste(thumb, (x + 12, mini_y + 16))
        draw.text((x + 138, mini_y + 12), f"0{idx+4}  /  {str(story.get('source') or '公开来源')[:20]}", font=font(12, True), fill=blue)
        title = str(story.get("title_zh") or story.get("original_title") or story.get("title") or "AI 新闻")
        ty = paragraph(draw, title, (x + 138, mini_y + 37), font(17, True), ink, mini_w - 154, 2, 2)
        paragraph(draw, str(story.get("what_zh") or story.get("summary_zh") or story.get("summary") or ""), (x + 138, ty + 3), font(13), muted, mini_w - 154, 2, 2)

    # Fixed Skill recommendation panel. Keep recommendation wording consistent across both templates.
    draw.rounded_rectangle((48, 1210, 1152, 1475), radius=10, fill=(246, 239, 222), outline=(225, 215, 194), width=2)
    draw.rectangle((48, 1210, 57, 1475), fill=orange)
    draw.text((78, 1234), "今日推荐  /  OPEN-SOURCE SKILL", font=font(19, True), fill=blue)
    skill_name = str(skill.get("name") or "Open-source AI Skill")
    draw.text((78, 1275), skill_name[:48], font=font(30, True), fill=ink)
    desc = str(skill.get("description_zh") or skill.get("description") or "一个可尝试的开源 AI 工作流工具。")
    paragraph(draw, desc, (80, 1320), font(17), ink, 720, 2, 5)
    topics = " · ".join((skill.get("topics") or [])[:5]) or str(skill.get("daily_theme") or skill.get("language") or "AI 工作流")
    paragraph(draw, "适用方向：" + topics, (80, 1380), font(14, True), muted, 720, 2, 3)
    draw.text((850, 1292), f"★ {int(skill['stars']):,}" if isinstance(skill.get("stars"), (int, float)) else "热度未核实", font=font(23, True), fill=blue)
    draw.text((850, 1335), "最近更新", font=font(13), fill=muted)
    draw.text((850, 1357), str(skill.get("updated") or "—")[:10], font=font(17, True), fill=ink)
    draw.text((850, 1400), str(skill.get("daily_theme") or "开源实用工具"), font=font(15, True), fill=blue)
    draw.text((850, 1432), "使用前查看 README 与权限", font=font(12), fill=muted)

    # Stable QR footer, verified later from the final composed image.
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(PUBLIC_URL)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((180, 180), Image.Resampling.NEAREST)
    draw.rectangle((0, 1510, W, H), fill=(14, 34, 60))
    canvas.paste(qr_img, (48, 1610))
    draw.text((260, 1582), "扫码阅读完整简报", font=font(29, True), fill=WHITE)
    draw.text((262, 1625), PUBLIC_URL.replace("https://", ""), font=font(17), fill=(211, 225, 235))
    draw.line((260, 1663, 775, 1663), fill=orange, width=3)
    draw.text((260, 1680), "在每天的变化中，看见更多可能。", font=font(19), fill=(225, 233, 238))
    draw.text((1145, 1640), "DAVYLAB", font=font(25, True), fill=WHITE, anchor="ra")
    draw.text((1145, 1680), "SPARK & PULSE", font=font(12, True), fill=(211, 225, 235), anchor="ra")
    draw.text((1145, 1730), "真实来源 · 有用洞察 · 新的可能", font=font(12), fill=(174, 196, 208), anchor="ra")

    out = POSTERS / f"{date}.png"
    canvas.save(out, format="PNG", optimize=True)
    canvas.save(POSTERS / "latest.png", format="PNG", optimize=True)
    manifest = {
        "report_date": date,
        "poster": str(out.relative_to(ROOT)),
        "qr_url": PUBLIC_URL,
        "news_count": 5,
        "skill": skill_name,
        "design": "mountain-editorial-cover",
        "design_variant": "mountain-editorial",
        "generated_at": dt.datetime.now(TZ).isoformat(),
    }
    (POSTERS / f"{date}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (POSTERS / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated mountain editorial poster {out} ({W}x{H}); QR target: {PUBLIC_URL}")


def render_alternating_template(report: dict, date: str, top: list[dict], skill: dict) -> bool:
    """Return True when the mountain-editorial template was rendered for this date."""
    date_obj = dt.date.fromisoformat(date)
    # Alternate daily between the established geometric-navy and mountain-editorial designs.
    # The existing geometric template is retained below; odd/even date parity is deterministic.
    if date_obj.toordinal() % 2 == 0:
        render_mountain_editorial(report, date, top, skill)
        return True
    return False

def main():
    report = json.loads((DATA / "latest.json").read_text(encoding="utf-8"))
    date = report.get("report_date", "")
    today = dt.datetime.now(TZ).date().isoformat()
    if date != today:
        raise SystemExit(f"Refusing to generate poster for stale report {date}; expected {today}")

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

    # Premium editorial palette: warm paper, deep navy, and restrained orange.
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

    # Deep-navy hero with sunrise and layered mountain silhouettes.
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
    hero_signal = str((report.get("editorial") or {}).get("trend_zh") or (top[0].get("title_zh") if top else "") or "从最新 AI 新闻中发现值得关注的变化。")
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
        photo = crop_cover(image_for_story(story, i), (card_w - 2, 132))
        canvas.paste(photo, (x + 1, card_y + 1))
        draw.rounded_rectangle((x + 13, card_y + 12, x + 54, card_y + 51), radius=8, fill=orange)
        draw.text((x + 25, card_y + 16), f"{i+1:02d}", font=font(21, True), fill=dark)
        title = story.get("title_zh") or story.get("original_title") or story.get("title") or "AI 新闻"
        yy = paragraph(draw, title, (x + 16, card_y + 151), font(21, True), ink, card_w - 32, 4, 4)
        summary = story.get("what_zh") or story.get("summary_zh") or story.get("summary") or ""
        yy = paragraph(draw, summary, (x + 16, yy + 8), font(16), muted, card_w - 32, 4, 5)
        source = str(story.get("source") or "公开来源")[:25]
        draw.line((x + 16, card_y + card_h - 48, x + card_w - 16, card_y + card_h - 48), fill=(228, 229, 224), width=1)
        draw.text((x + 16, card_y + card_h - 36), source, font=font(13, True), fill=blue)
        draw.text((x + card_w - 16, card_y + card_h - 36), "阅读原文 ↗", font=font(13), fill=orange, anchor="ra")

    # Two additional headlines maintain the five-story promise without squeezing the three-column layout.
    mini_y, mini_h, mini_w = 1144, 154, 537
    for index, story in enumerate(top[3:5], start=3):
        x = 50 + (index - 3) * (mini_w + 26)
        draw.rounded_rectangle((x, mini_y, x + mini_w, mini_y + mini_h), radius=14, fill=(255, 254, 250), outline=light_line, width=2)
        thumb = crop_cover(image_for_story(story, index), (115, 118))
        canvas.paste(thumb, (x + 12, mini_y + 18))
        draw.text((x + 145, mini_y + 14), f"{index+1:02d}  /  {str(story.get('source') or '公开来源')[:22]}", font=font(13, True), fill=blue)
        title = story.get("title_zh") or story.get("original_title") or story.get("title") or "AI 新闻"
        yy = paragraph(draw, title, (x + 145, mini_y + 40), font(18, True), ink, mini_w - 165, 2, 3)
        summary = story.get("what_zh") or story.get("summary_zh") or story.get("summary") or ""
        paragraph(draw, summary, (x + 145, yy + 4), font(14), muted, mini_w - 165, 2, 3)

    # Compact open-source recommendation panel.
    draw.rounded_rectangle((48, 1324, 1152, 1538), radius=18, fill=(245, 235, 215), outline=(232, 218, 191), width=2)
    draw.rectangle((48, 1324, 58, 1538), fill=orange)
    draw.text((82, 1345), "今日推荐  /  OPEN-SOURCE SKILL", font=font(19, True), fill=blue)
    skill_name = str(skill.get("name") or "Open-source AI Skill")
    draw.text((82, 1380), skill_name[:42], font=font(29, True), fill=ink)
    desc = str(skill.get("description_zh") or skill.get("description") or "开源 AI 工作流与智能体工具。")
    paragraph(draw, desc, (82, 1424), font(17), ink, 730, 2, 5)
    topics = " · ".join((skill.get("topics") or [])[:5]) or (skill.get("language") or "AI 工作流")
    paragraph(draw, "适用方向：" + topics, (82, 1484), font(14, True), muted, 730, 1, 3)
    stars = skill.get("stars")
    star_label = f"★ {int(stars):,}" if isinstance(stars, (int, float)) else "社区热度未核实"
    draw.text((860, 1390), star_label, font=font(22, True), fill=blue)
    draw.text((860, 1430), "最近更新", font=font(13), fill=muted)
    draw.text((860, 1452), (str(skill.get("updated") or "")[:10] or "—"), font=font(17, True), fill=ink)
    draw.text((860, 1493), "使用前查看 README 与权限", font=font(13), fill=muted)

    # Final QR is locally encoded to the exact stable report URL with a generous quiet zone.
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(PUBLIC_URL)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((180, 180), Image.Resampling.NEAREST)
    draw.rectangle((0, 1560, W, H), fill=dark)
    canvas.paste(qr_img, (48, 1610))
    draw.text((260, 1617), "扫码阅读完整简报", font=font(29, True), fill=(255, 253, 248))
    draw.text((262, 1665), PUBLIC_URL.replace("https://", ""), font=font(17), fill=(211, 225, 235))
    draw.line((260, 1703, 775, 1703), fill=orange, width=3)
    draw.text((260, 1721), "在每天的变化中，看见更多可能。", font=font(19), fill=(225, 233, 238))
    draw.text((1145, 1685), "DAVYLAB", font=font(25, True), fill=(255, 253, 248), anchor="ra")
    draw.text((1145, 1725), "SPARK & PULSE", font=font(12, True), fill=(211, 225, 235), anchor="ra")
    draw.text((1145, 1768), "真实来源 · 有用洞察 · 新的可能", font=font(12), fill=(174, 196, 208), anchor="ra")

    POSTERS.mkdir(parents=True, exist_ok=True)
    out = POSTERS / f"{date}.png"
    canvas.save(out, format="PNG", optimize=True)
    canvas.save(POSTERS / "latest.png", format="PNG", optimize=True)
    manifest = {
        "report_date": date,
        "poster": str(out.relative_to(ROOT)),
        "qr_url": PUBLIC_URL,
        "news_count": 5,
        "skill": skill_name,
        "design": "geometric-navy-mountain",
        "design_variant": "geometric-navy",
        "generated_at": dt.datetime.now(TZ).isoformat(),
    }
    (POSTERS / f"{date}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (POSTERS / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated editorial poster {out} ({W}x{H}); QR target: {PUBLIC_URL}")

if __name__ == "__main__":
    main()
