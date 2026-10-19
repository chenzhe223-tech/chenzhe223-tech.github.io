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

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "radar" / "data"
POSTERS = ROOT / "radar" / "posters"
TZ = ZoneInfo("Asia/Shanghai")
PUBLIC_URL = "https://chenzhe223-tech.github.io/radar/daily/"
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
    title = " ".join(str(story.get(k, "")) for k in ("title_zh", "title_en", "original_title", "title")).lower()
    mapping = [
        (r"robot|agent|智能体|机器人|automation|自动化", "photo-1485827404703-89b55fcc595e"),
        (r"model|gpt|claude|gemini|llm|模型|大模型|deepseek", "photo-1518770660439-4636190af475"),
        (r"phone|mobile|app|手机|应用|产品", "photo-1512941937669-90a1b58e7e9c"),
        (r"business|company|market|商业|企业|行业|投资", "photo-1519389950473-47ba0277781c"),
        (r"image|video|design|creative|图像|视频|设计|创作|生成", "photo-1470252649378-9c29740c9fa8"),
    ]
    chosen = next((photo for pattern, photo in mapping if re.search(pattern, title, re.I)), mapping[idx % len(mapping)][1])
    url = f"https://images.unsplash.com/{chosen}?auto=format&fit=crop&w=700&q=78"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DAVYLAB-Radar-Poster/1.0"})
        with urllib.request.urlopen(req, timeout=12) as r:
            img = Image.open(BytesIO(r.read())).convert("RGB")
        return img
    except Exception:
        # The poster remains complete if an external photo host is temporarily unavailable.
        img = Image.new("RGB", (700, 380), (224, 233, 241))
        d = ImageDraw.Draw(img)
        d.text((30, 35), "AI / TECHNOLOGY", font=font(34, True), fill=(39, 77, 113))
        d.text((30, 100), "DAVYLAB  ·  DAILY SIGNAL", font=font(20), fill=(70, 90, 112))
        return img

def crop_cover(img, size):
    return ImageOps.fit(img, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))

def main():
    report = json.loads((DATA / "latest.json").read_text(encoding="utf-8"))
    date = report.get("report_date", "")
    today = dt.datetime.now(TZ).date().isoformat()
    if date != today:
        raise SystemExit(f"Refusing to generate poster for stale report {date}; expected {today}")
    top = report.get("top5") or []
    if len(top) < 5:
        top = []
        for item in report.get("news", [])[:5]:
            top.append({
                "title_zh": item.get("title_zh") or item.get("title") or "AI 新闻",
                "what_zh": item.get("summary_zh") or item.get("summary") or "",
                "why_zh": item.get("why_it_matters_zh") or "",
                "source_url": item.get("url", ""),
                "source": item.get("source", ""),
                "published": item.get("published", ""),
            })
    if len(top) < 5:
        raise SystemExit("Poster needs five source-backed stories")
    skills = report.get("skills") or []
    if not skills:
        raise SystemExit("Poster needs one repository-backed Skill recommendation")
    skill = skills[0]
    canvas = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(canvas)
    # Atmospheric hero, designed as an editorial poster rather than a screenshot.
    draw.rectangle((0, 0, W, 460), fill=(235, 243, 246))
    draw.ellipse((790, -210, 1400, 410), fill=(255, 230, 185))
    draw.ellipse((880, -140, 1340, 320), fill=(249, 211, 156))
    draw.text((58, 36), "DAVYLAB", font=font(43, True), fill=INK)
    draw.text((62, 84), "S P A R K  &  P U L S E", font=font(14), fill=MUTED)
    draw.text((890, 42), date[5:].replace("-", "/"), font=font(39, True), fill=INK)
    draw.text((895, 91), date[:4] + "  DAILY BRIEF", font=font(16), fill=MUTED)
    draw.text((58, 132), "AI", font=font(110, True), fill=BLUE)
    draw.text((220, 152), "前沿简报", font=font(68, True), fill=INK)
    draw.text((64, 268), "每天 5 分钟，看见 AI 世界的新变化。", font=font(31, True), fill=INK)
    draw.text((65, 324), "真实来源 · 编辑精选 · 开源工具 · 每日更新", font=font(20), fill=(60, 86, 110))
    draw.line((65, 370, 510, 370), fill=BLUE, width=5)
    draw.text((65, 397), "把想法，做成能用的工具。", font=font(20), fill=INK)
    # News section with five real story cards and individual topic images.
    draw.rounded_rectangle((34, 485, W-34, 1165), radius=24, fill=WHITE, outline=(225, 229, 231), width=2)
    draw.text((58, 508), "今日精选 · 5 条 AI 重要动态", font=font(32, True), fill=INK)
    draw.text((60, 555), "少一点噪音，多一点有价值的阅读", font=font(17), fill=MUTED)
    card_w, gap, x0 = 204, 16, 55
    for i, story in enumerate(top[:5]):
        x = x0 + i * (card_w + gap)
        y = 600
        draw.rounded_rectangle((x, y, x+card_w, 1127), radius=13, fill=(252, 252, 250), outline=(228, 232, 234), width=1)
        photo = crop_cover(image_for_story(story, i), (card_w-2, 150))
        canvas.paste(photo, (x+1, y+1))
        draw.rounded_rectangle((x+10, y+10, x+48, y+48), radius=8, fill=BLUE)
        draw.text((x+19, y+15), str(i+1), font=font(21, True), fill=WHITE)
        title = story.get("title_zh") or story.get("original_title") or story.get("title") or "AI 新闻"
        yy = paragraph(draw, title, (x+12, y+165), font(19, True), INK, card_w-24, 4, 4)
        summary = story.get("what_zh") or story.get("summary_zh") or story.get("summary") or ""
        yy = paragraph(draw, summary, (x+12, yy+7), font(14), MUTED, card_w-24, 5, 4)
        source = str(story.get("source") or "来源")[:22]
        draw.text((x+12, 1065), source, font=font(12, True), fill=(61, 91, 120))
        draw.text((x+12, 1090), "查看来源 ↗", font=font(12), fill=BLUE)
    # Featured Skill section.
    draw.rounded_rectangle((34, 1187, W-34, 1574), radius=24, fill=(255, 248, 233), outline=(240, 225, 197), width=2)
    draw.text((58, 1210), "✦ 今日推荐 · 值得尝试的开源 Skill", font=font(30, True), fill=INK)
    skill_name = str(skill.get("name") or "Open-source AI Skill")
    draw.text((60, 1270), skill_name[:45], font=font(30, True), fill=BLUE)
    desc = str(skill.get("description_zh") or skill.get("description") or "开源 AI 工作流与智能体工具。")
    yy = paragraph(draw, desc, (60, 1320), font(18), INK, 690, 3, 6)
    topics = " · ".join((skill.get("topics") or [])[:5]) or (skill.get("language") or "AI 工作流")
    yy = paragraph(draw, "应用范围：" + topics, (60, yy+9), font(16, True), MUTED, 700, 2, 5)
    reason = "依据公开项目主题、社区关注度与近期维护情况筛选；安装前请检查 README、权限和运行环境。"
    paragraph(draw, "推荐理由：" + reason, (60, yy+8), font(15), MUTED, 700, 3, 4)
    draw.text((60, 1510), f"★ {int(skill.get('stars') or 0):,}  ·  最近更新 {(skill.get('updated') or '')[:10] or '—'}", font=font(15, True), fill=(60, 85, 110))
    # Stable URL QR; image and target URL are also saved as a manifest.
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=3)
    qr.add_data(PUBLIC_URL); qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB").resize((150, 150), Image.Resampling.NEAREST)
    draw.rectangle((0, 1600, W, H), fill=NAVY)
    canvas.paste(qr_img, (48, 1622))
    draw.text((225, 1625), "扫码查看 DAVYLAB AI 前沿简报", font=font(23, True), fill=WHITE)
    draw.text((225, 1666), PUBLIC_URL.replace("https://", ""), font=font(16), fill=(215, 228, 240))
    draw.text((225, 1710), "在每天的变化中，看见更多可能。", font=font(20), fill=(215, 228, 240))
    draw.text((945, 1682), "DAVYLAB", font=font(25, True), fill=WHITE)
    draw.text((948, 1722), "SPARK & PULSE", font=font(11), fill=(215, 228, 240))
    POSTERS.mkdir(parents=True, exist_ok=True)
    out = POSTERS / f"{date}.png"
    canvas.save(out, format="PNG", optimize=True)
    canvas.save(POSTERS / "latest.png", format="PNG", optimize=True)
    manifest = {"report_date": date, "poster": f"posters/{date}.png", "qr_url": PUBLIC_URL, "news_count": 5, "skill": skill_name, "generated_at": dt.datetime.now(TZ).isoformat()}
    (POSTERS / f"{date}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (POSTERS / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"Generated {out} ({W}x{H}); QR target: {PUBLIC_URL}")
