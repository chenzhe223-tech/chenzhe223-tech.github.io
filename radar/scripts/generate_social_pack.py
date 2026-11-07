#!/usr/bin/env python3
"""Build six independent 900x1200 DAVYLAB WeChat assets from the verified daily report."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import urllib.parse
import zipfile
from pathlib import Path
from zoneinfo import ZoneInfo

import qrcode
from PIL import Image, ImageDraw

from radar.scripts.generate_poster import font
from radar.scripts.poster_style import poster_style_metadata
from radar.scripts.visual_lock import validate_visual_lock

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "radar" / "data" / "latest.json"
OUT_ROOT = ROOT / "radar" / "social"
PUBLIC_URL = "https://chenzhe223-tech.github.io/radar/daily/"
W, H = 900, 1200
QR_X, QR_Y, QR_SIZE = 610, 880, 180
TZ = ZoneInfo("Asia/Shanghai")
PAPER = (252, 250, 245)
INK = (14, 38, 65)
NAVY = (8, 35, 65)
BLUE = (28, 91, 171)
ORANGE = (244, 91, 48)
MUTED = (83, 101, 119)
LINE = (211, 218, 221)
WHITE = (255, 255, 255)
TEXT_BOUNDS: list[dict] = []


def story_title(story: dict) -> str:
    return str(story.get("title_zh") or story.get("original_title") or story.get("title") or "AI 动态")


def story_summary(story: dict) -> str:
    return str(story.get("social_what_zh") or story.get("poster_summary_zh") or story.get("what_zh") or story.get("summary_zh") or story.get("summary") or story.get("description_zh") or "")


def story_why(story: dict) -> str:
    return str(story.get("social_why_zh") or story.get("poster_why_zh") or story.get("why_zh") or story.get("why_it_matters_zh") or story.get("editor_judgment_zh") or "")


def story_url(story: dict) -> str:
    return str(story.get("source_url") or story.get("url") or "")


def select_topic_stories(top: list[dict]) -> list[tuple[str, dict]]:
    """Map one independent topic image to each verified Top 5 story; never invent a category."""
    if len(top) != 5:
        raise ValueError(f"Five topic illustrations require the formal Top 5; found {len(top)}")
    selected = []
    for story in top:
        category = str(story.get("source_section") or "unclassified")
        selected.append((category, story))
    return selected


def local_date(value: str, fallback: str) -> str:
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(TZ).date().isoformat()
    except Exception:
        return "发布日期未标注"


def domain(value: str) -> str:
    try:
        return urllib.parse.urlsplit(value).netloc.removeprefix("www.") or "公开来源"
    except Exception:
        return "公开来源"


def wrap_lines(draw, text: str, fnt, max_width: int, max_lines: int | None = None) -> list[str]:
    lines: list[str] = []
    line = ""
    for char in str(text or ""):
        if not line or draw.textlength(line + char, font=fnt) <= max_width:
            line += char
        else:
            lines.append(line)
            line = char
    if line:
        lines.append(line)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        tail = lines[-1]
        while tail and draw.textlength(tail + "…", font=fnt) > max_width:
            tail = tail[:-1]
        lines[-1] = (tail or "") + "…"
    return lines


def write_text(draw, text: str, xy: tuple[int, int], fnt, fill, width: int, max_lines: int = 3, gap: int = 5) -> int:
    x, y = xy
    y0 = y
    all_lines = wrap_lines(draw, text, fnt, width, None)
    lines = all_lines[:max_lines] if max_lines else all_lines
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + gap
    actual_width = max((float(draw.textlength(line, font=fnt)) for line in lines), default=0)
    height = y - y0
    if x < 0 or y0 < 0 or x + width > W or y > H or actual_width > width + 1:
        raise ValueError(f"Social text bounds overflow: x={x}, y={y0}, width={width}, height={height}, actual_width={actual_width}")
    TEXT_BOUNDS.append({
        "x": int(x), "y": int(y0), "width": int(width), "height": int(height),
        "actual_width": round(actual_width, 1), "line_count": len(lines),
        "truncated": len(all_lines) > len(lines), "overflow": False
    })
    return y


def social_layout_regions(image_type: str) -> dict:
    if image_type == "main_poster":
        return {
            "masthead": [40, 24, 860, 245],
            "news_grid": [40, 267, 860, 692],
            "observation": [40, 708, 860, 820],
            "skill_recommendation": [40, 840, 515, 1120],
            "right_qr_panel": [540, 840, 860, 1120],
            "brand_footer": [0, 1140, 900, 1200],
        }
    if image_type == "topic_illustration":
        return {
            "hero_art": [0, 0, 900, 450],
            "masthead": [40, 30, 860, 60],
            "topic_content": [40, 475, 860, 1080],
            "source_footer": [40, 1090, 860, 1180],
        }
    if image_type == "skill_feature":
        return {
            "hero_art": [0, 0, 900, 450],
            "masthead": [40, 30, 860, 60],
            "skill_content": [40, 475, 860, 1120],
            "brand_footer": [0, 1140, 900, 1200],
        }
    raise ValueError(f"Unknown social image type: {image_type}")


def card(draw, box, fill=WHITE, outline=LINE, radius=16, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def classify_topic(story: dict, index: int) -> str:
    value = " ".join(str(story.get(k) or "") for k in ("title", "title_zh", "title_en", "summary", "summary_zh")).lower()
    patterns = [
        (("cybersecurity", "cyber security", "vulnerability", "prompt injection", "credential exfiltration", "网络安全", "漏洞", "攻防", "安全防护"), "cybersecurity"),
        (("腾讯", "微信支付", "门店", "零售", "7-eleven", "迎宾", "导购"), "retail"),
        (("humanoid", "robotics", "robot", "embodied ai", "physical ai", "机器人", "具身智能", "人形"), "robotics"),
        (("shopping", "commerce", "e-commerce", "muse", "retail", "购物", "电商", "零售", "消费代理"), "commerce"),
        (("coding", "code generation", "developer", "software engineering", "编程", "代码", "开发者"), "coding"),
        (("compute", "gpu", "tpu", "chip", "data center", "算力", "芯片", "数据中心", "智算"), "compute"),
        (("deepseek", "super-agent", "superagent", "router", "worker", "智能体", "并行任务", "agent"), "agent"),
        (("codex", "chatgpt", "usage", "用量", "额度", "openai"), "usage"),
        (("sap", "成本", "cost", "model routing", "模型路由", "企业效率"), "routing"),
        (("forty", "forest", "森林", "deepmind", "卫星", "毁林"), "forest"),
    ]
    for needles, kind in patterns:
        if any(n in value for n in needles):
            return kind
    return ["agent", "robotics", "commerce", "cybersecurity", "compute"][index % 5]


def topic_label(kind: str) -> str:
    return {
        "agent": "智能体协作",
        "retail": "门店服务机器人",
        "usage": "AI 使用额度",
        "routing": "企业模型路由",
        "forest": "卫星森林识别",
        "robotics": "具身智能",
        "commerce": "智能购物",
        "cybersecurity": "智能体安全",
        "coding": "AI 编程",
        "compute": "AI 算力",
    }.get(kind, "AI 应用场景")


def draw_topic_art(draw, kind: str):
    """Original vector-style topic art; it is illustrative, not documentary photography."""
    draw.rectangle((0, 0, W, 450), fill=NAVY)
    draw.ellipse((710, 35, 830, 155), fill=(234, 156, 101))
    if kind == "agent":
        # Router + isolated worker sessions.
        card(draw, (335, 115, 565, 205), fill=(245, 248, 250), outline=(117, 157, 187), radius=18)
        draw.text((450, 142), "ROUTER", font=font(26, True), fill=NAVY, anchor="mm")
        nodes = [(140, 300), (450, 300), (760, 300)]
        for x, y in nodes:
            draw.line((450, 205, x, y - 45), fill=(124, 177, 215), width=7)
            card(draw, (x - 105, y - 42, x + 105, y + 52), fill=(255, 253, 248), outline=(129, 170, 201), radius=16)
            draw.text((x, y + 4), "WORKER", font=font(20, True), fill=BLUE, anchor="mm")
            draw.ellipse((x - 13, y + 60, x + 13, y + 86), fill=ORANGE)
    elif kind == "retail":
        # Generic convenience-store counter and service robot.
        for x in (70, 690):
            card(draw, (x, 115, x + 140, 330), fill=(245, 248, 250), outline=(112, 151, 180), radius=12)
            for y in (155, 220, 285):
                draw.line((x + 12, y, x + 128, y), fill=(145, 169, 188), width=4)
            for i in range(3):
                draw.rectangle((x + 20 + i * 34, 126, x + 43 + i * 34, 153), fill=(239, 169 + i * 9, 111))
        draw.rounded_rectangle((340, 100, 560, 330), radius=75, fill=(240, 245, 247), outline=(124, 165, 193), width=8)
        draw.ellipse((385, 160, 425, 200), fill=BLUE)
        draw.ellipse((475, 160, 515, 200), fill=BLUE)
        draw.arc((405, 190, 495, 270), 15, 165, fill=ORANGE, width=8)
        draw.rounded_rectangle((400, 345, 500, 385), radius=15, fill=ORANGE)
    elif kind == "usage":
        # Two product windows flowing into a shared usage pool.
        card(draw, (110, 115, 365, 300), fill=(245, 248, 250), outline=(117, 157, 187), radius=18)
        card(draw, (535, 115, 790, 300), fill=(245, 248, 250), outline=(117, 157, 187), radius=18)
        draw.text((237, 150), "CHAT", font=font(27, True), fill=NAVY, anchor="mm")
        draw.text((662, 150), "CODE", font=font(27, True), fill=NAVY, anchor="mm")
        for x in (155, 195, 235, 275, 315, 580, 620, 660, 700, 740):
            draw.ellipse((x - 10, 205, x + 10, 225), fill=BLUE if x < 400 else ORANGE)
        draw.line((365, 230, 450, 335), fill=(137, 180, 210), width=8)
        draw.line((535, 230, 450, 335), fill=(137, 180, 210), width=8)
        draw.ellipse((355, 285, 545, 425), fill=(246, 233, 214), outline=ORANGE, width=7)
        draw.text((450, 354), "TOKEN", font=font(25, True), fill=NAVY, anchor="mm")
    elif kind == "routing":
        # One task routed to three model tiers.
        draw.ellipse((345, 95, 555, 305), fill=(245, 248, 250), outline=(123, 166, 194), width=8)
        draw.text((450, 190), "TASK", font=font(30, True), fill=NAVY, anchor="mm")
        for x, label, tone in ((155, "SMALL", (118, 174, 207)), (450, "MID", (239, 169, 111)), (745, "FRONTIER", (110, 147, 180))):
            draw.line((450, 305, x, 355), fill=tone, width=8)
            card(draw, (x - 95, 345, x + 95, 420), fill=(250, 252, 252), outline=tone, radius=14)
            draw.text((x, 382), label, font=font(18, True), fill=NAVY, anchor="mm")
    elif kind == "robotics":
        # Generic humanoid robot and industrial workcell, not a documentary scene.
        draw.rectangle((70, 340, 830, 420), fill=(31, 62, 83))
        for x in range(100, 820, 90):
            draw.ellipse((x, 365, x + 26, 391), fill=(155, 184, 198))
        draw.rounded_rectangle((355, 155, 545, 350), radius=58, fill=(242, 247, 248), outline=(121, 165, 194), width=8)
        draw.ellipse((365, 70, 535, 225), fill=(246, 249, 249), outline=(121, 165, 194), width=8)
        draw.ellipse((405, 125, 430, 150), fill=BLUE)
        draw.ellipse((470, 125, 495, 150), fill=BLUE)
        draw.arc((415, 140, 485, 195), 15, 165, fill=ORANGE, width=7)
        draw.line((355, 205, 260, 300), fill=(180, 205, 215), width=26)
        draw.line((545, 205, 640, 300), fill=(180, 205, 215), width=26)
        draw.ellipse((235, 280, 285, 330), fill=ORANGE)
        draw.ellipse((615, 280, 665, 330), fill=ORANGE)
        draw.line((405, 345, 385, 410), fill=(180, 205, 215), width=24)
        draw.line((495, 345, 515, 410), fill=(180, 205, 215), width=24)
    elif kind == "commerce":
        # Storefront, product cards and an agent-driven shopping cart.
        card(draw, (75, 105, 390, 370), fill=(245, 248, 250), outline=(117, 157, 187), radius=16)
        draw.rectangle((95, 145, 370, 195), fill=(228, 236, 241))
        draw.text((230, 170), "SHOP", font=font(25, True), fill=NAVY, anchor="mm")
        for x, tone in ((125, (239, 169, 111)), (215, (118, 174, 207)), (305, (151, 181, 155))):
            card(draw, (x, 225, x + 58, 325), fill=(255, 253, 248), outline=tone, radius=8)
            draw.rectangle((x + 12, 245, x + 46, 290), fill=tone)
        draw.line((500, 165, 740, 165), fill=(130, 177, 207), width=9)
        draw.line((530, 165, 570, 330), fill=(130, 177, 207), width=9)
        draw.line((570, 330, 760, 330), fill=(130, 177, 207), width=9)
        draw.line((760, 330, 790, 205), fill=(130, 177, 207), width=9)
        draw.ellipse((585, 345, 630, 390), fill=ORANGE)
        draw.ellipse((710, 345, 755, 390), fill=ORANGE)
        draw.rectangle((585, 210, 745, 300), fill=(246, 233, 214), outline=ORANGE, width=5)
    elif kind == "cybersecurity":
        # Shield and lock represent defensive security controls.
        draw.regular_polygon((450, 250, 190), 6, rotation=30, fill=(240, 246, 249), outline=(125, 166, 195), width=8)
        draw.rounded_rectangle((365, 225, 535, 355), radius=20, fill=(8, 35, 65), outline=ORANGE, width=7)
        draw.arc((390, 135, 510, 275), 180, 360, fill=(8, 35, 65), width=18)
        draw.ellipse((430, 265, 470, 305), fill=ORANGE)
        draw.rectangle((444, 292, 456, 325), fill=ORANGE)
        for x, y in ((220, 160), (680, 160), (220, 360), (680, 360)):
            draw.ellipse((x - 24, y - 24, x + 24, y + 24), fill=(245, 248, 250), outline=(124, 170, 198), width=5)
            draw.line((x, y, 450, 250), fill=(133, 179, 210), width=5)
    elif kind == "coding":
        # Abstract code editor, not a screenshot of any real product.
        card(draw, (85, 100, 815, 390), fill=(245, 248, 250), outline=(117, 157, 187), radius=18)
        draw.rectangle((85, 100, 815, 155), fill=(225, 234, 240))
        for x, tone in ((120, ORANGE), (155, (118, 174, 207)), (190, (151, 181, 155))):
            draw.ellipse((x, 120, x + 18, 138), fill=tone)
        draw.text((450, 220), "</>", font=font(76, True), fill=BLUE, anchor="mm")
        for i, width in enumerate((380, 510, 300, 455)):
            y = 285 + i * 24
            draw.rounded_rectangle((180, y, 180 + width, y + 10), radius=5, fill=(126, 161, 184) if i % 2 else ORANGE)
    elif kind == "compute":
        # Accelerator chip connected to a compact data-centre grid.
        card(draw, (80, 120, 320, 365), fill=(245, 248, 250), outline=(117, 157, 187), radius=16)
        for y in (155, 220, 285):
            draw.rounded_rectangle((110, y, 290, y + 36), radius=7, fill=(8, 35, 65))
            for x in (135, 175, 215, 255):
                draw.ellipse((x, y + 12, x + 10, y + 22), fill=(130, 183, 213))
        draw.rounded_rectangle((465, 145, 665, 345), radius=22, fill=(246, 233, 214), outline=ORANGE, width=8)
        draw.text((565, 245), "AI", font=font(64, True), fill=NAVY, anchor="mm")
        for x in range(485, 650, 40):
            draw.line((x, 120, x, 145), fill=(130, 183, 213), width=6)
            draw.line((x, 345, x, 370), fill=(130, 183, 213), width=6)
        for y in range(165, 330, 40):
            draw.line((440, y, 465, y), fill=(130, 183, 213), width=6)
            draw.line((665, y, 690, y), fill=(130, 183, 213), width=6)
    elif kind == "forest":
        # Satellite over a classified forest mosaic.
        draw.polygon([(95, 125), (230, 125), (260, 170), (125, 170)], fill=(224, 235, 240), outline=(126, 168, 194))
        draw.polygon([(125, 170), (230, 170), (255, 205), (150, 205)], fill=(190, 213, 226))
        draw.line((230, 160, 330, 260), fill=(238, 188, 128), width=5)
        draw.rectangle((340, 255, 700, 390), fill=(220, 232, 222), outline=(124, 158, 141), width=3)
        cells = [(365, 280, (49, 105, 80)), (435, 280, (90, 143, 104)), (505, 280, (157, 174, 115)),
                 (575, 280, (65, 119, 89)), (645, 280, (194, 165, 111)),
                 (365, 340, (68, 124, 90)), (435, 340, (128, 158, 102)), (505, 340, (49, 105, 80)),
                 (575, 340, (181, 153, 103)), (645, 340, (79, 130, 93))]
        for x, y, color in cells:
            draw.ellipse((x, y, x + 34, y + 34), fill=color)
    else:
        # General connected AI workflow.
        for x, y in ((170, 250), (450, 150), (730, 250)):
            draw.ellipse((x - 62, y - 62, x + 62, y + 62), fill=(244, 248, 250), outline=(125, 166, 195), width=7)
        draw.line((232, 250, 388, 165), fill=(135, 179, 210), width=7)
        draw.line((512, 165, 668, 250), fill=(135, 179, 210), width=7)
    draw.rounded_rectangle((35, 405, 315, 440), radius=8, fill=(8, 35, 65))
    draw.text((50, 411), "主题插画 · 非新闻现场", font=font(17, True), fill=(255, 250, 240))


def render_topic_image(story: dict, index: int, report_date: str, category: str = "global_news") -> Image.Image:
    kind = classify_topic(story, index)
    image = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(image)
    draw_topic_art(draw, kind)
    draw.text((38, 30), "DAVYLAB", font=font(25, True), fill=WHITE)
    draw.text((860, 35), report_date.replace("-", "."), font=font(17, True), fill=WHITE, anchor="ra")
    region_label = "GLOBAL AI" if category == "global_news" else ("CHINA AI" if category == "china_ai_news" else "AI FRONTIER")
    draw.text((40, 475), f"TOPIC  /  {index + 1:02d}  ·  {region_label}  ·  {topic_label(kind)}", font=font(16, True), fill=ORANGE)
    y = write_text(draw, story_title(story), (40, 515), font(32, True), INK, 820, 3, 7)
    y = write_text(draw, story_summary(story), (42, y + 12), font(21), MUTED, 810, 4, 7)
    if story_why(story):
        draw.line((42, 865, 858, 865), fill=LINE, width=2)
        draw.text((42, 886), "为什么值得关注", font=font(18, True), fill=BLUE)
        write_text(draw, story_why(story), (42, 920), font(19), INK, 810, 3, 6)
    source = str(story.get("source") or "公开来源")
    published = local_date(str(story.get("published") or ""), report_date)
    draw.line((40, 1090, 860, 1090), fill=LINE, width=2)
    draw.text((42, 1108), f"来源：{source}  ·  {published}", font=font(16, True), fill=BLUE)
    draw.text((42, 1142), domain(story_url(story)), font=font(13), fill=MUTED)
    draw.text((858, 1170), "AI FRONTIER BRIEF", font=font(12, True), fill=MUTED, anchor="ra")
    return image


def render_skill_image(skill: dict, report_date: str) -> Image.Image:
    """Create a standalone Skill feature illustration; it is not a product screenshot."""
    image = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, W, 450), fill=NAVY)
    draw.ellipse((700, 35, 835, 170), fill=(234, 156, 101))
    card(draw, (335, 115, 565, 205), fill=(245, 248, 250), outline=(117, 157, 187), radius=18)
    draw.text((450, 142), "SKILL", font=font(28, True), fill=NAVY, anchor="mm")
    for x, label in ((145, "INPUT"), (450, "WORKFLOW"), (755, "OUTPUT")):
        draw.line((450, 205, x, 300), fill=(124, 177, 215), width=7)
        card(draw, (x - 110, 300, x + 110, 385), fill=(255, 253, 248), outline=(129, 170, 201), radius=16)
        draw.text((x, 342), label, font=font(19, True), fill=BLUE, anchor="mm")
    draw.rounded_rectangle((35, 405, 315, 440), radius=8, fill=(8, 35, 65))
    draw.text((50, 411), "主题插画 · 非产品截图", font=font(17, True), fill=(255, 250, 240))

    draw.text((40, 30), "DAVYLAB", font=font(25, True), fill=WHITE)
    draw.text((860, 35), report_date.replace("-", "."), font=font(17, True), fill=WHITE, anchor="ra")
    draw.text((40, 475), "TODAY'S PRACTICAL SKILL", font=font(17, True), fill=ORANGE)
    y = write_text(draw, str(skill.get("name") or "Open-source Skill"), (40, 515), font(34, True), INK, 820, 3, 7)
    description = str(skill.get("poster_description_zh") or skill.get("description_zh") or skill.get("description") or "项目能力以官方仓库说明为准。")
    y = write_text(draw, description, (42, y + 14), font(21), MUTED, 810, 5, 7)
    license_name = str(skill.get("license_name") or skill.get("license") or "许可证待核验")
    draw.line((42, 900, 858, 900), fill=LINE, width=2)
    draw.text((42, 925), f"许可证：{license_name[:44]}", font=font(17, True), fill=BLUE)
    repo_url = str(skill.get("url") or "")
    website = str(skill.get("official_website") or repo_url)
    draw.text((42, 966), f"项目：{domain(repo_url)}", font=font(15), fill=INK)
    draw.text((42, 1000), f"主页：{domain(website)}", font=font(15), fill=INK)
    draw.text((42, 1060), "已核验仓库、官网/官方项目页、README、SKILL.md 与许可证", font=font(13, True), fill=MUTED)
    draw.text((42, 1090), "未实测安装；未完成专项安全审计，使用请自行评估", font=font(13, True), fill=MUTED)
    draw.rectangle((0, 1140, W, H), fill=NAVY)
    draw.text((40, 1160), "DAVYLAB  ·  让可能发生", font=font(17, True), fill=WHITE)
    draw.text((860, 1167), "SKILL FEATURE  |  EDITORIAL ILLUSTRATION", font=font(11, True), fill=(220, 231, 238), anchor="ra")
    return image


def draw_main_poster(report: dict, top: list[dict], skill: dict, report_date: str) -> Image.Image:
    meta = poster_style_metadata(report_date)
    image = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(image)
    if meta["design_variant"] == "geometric-navy":
        draw.rectangle((0, 0, W, 245), fill=NAVY)
        draw.ellipse((700, -100, 900, 100), fill=(235, 158, 105))
        draw.polygon([(0, 205), (125, 135), (260, 205), (390, 115), (540, 210), (700, 140), (900, 195), (900, 245), (0, 245)], fill=(47, 82, 108))
        draw.polygon([(0, 225), (160, 175), (315, 228), (470, 168), (630, 226), (790, 176), (900, 218), (900, 245), (0, 245)], fill=(27, 57, 81))
        hero_ink = WHITE
    else:
        draw.rectangle((0, 0, W, 245), fill=(236, 243, 245))
        draw.polygon([(0, 205), (145, 75), (275, 205), (445, 65), (615, 205), (760, 95), (900, 190), (900, 245), (0, 245)], fill=(165, 195, 208))
        draw.polygon([(0, 225), (180, 145), (345, 228), (530, 150), (700, 225), (850, 160), (900, 210), (900, 245), (0, 245)], fill=(111, 151, 174))
        hero_ink = INK
    draw.text((40, 24), "DAVYLAB", font=font(28, True), fill=hero_ink)
    draw.text((42, 62), "AI FRONTIER BRIEF", font=font(14, True), fill=hero_ink)
    draw.text((860, 28), report_date.replace("-", "."), font=font(23, True), fill=hero_ink, anchor="ra")
    draw.text((40, 100), "AI 前沿简报", font=font(60, True), fill=hero_ink)
    editorial = report.get("editorial") or {}
    headline = str(editorial.get("headline_zh") or editorial.get("trend_zh") or "AI 正在走进真实工作流程")
    write_text(draw, headline, (43, 177), font(17, True), hero_ink, 800, 2, 3)
    draw.text((43, 226), "主题视觉 · 非新闻现场", font=font(12, True), fill=hero_ink)

    draw.text((40, 267), "今日精选", font=font(26, True), fill=INK)
    draw.text((860, 278), "GLOBAL  ·  CHINA  ·  INDUSTRY", font=font(12, True), fill=MUTED, anchor="ra")
    positions = [(40, 310, 400, 122), (460, 310, 400, 122),
                 (40, 442, 400, 122), (460, 442, 400, 122),
                 (40, 574, 820, 118)]
    for i, (story, (x, y, width, height)) in enumerate(zip(top[:5], positions)):
        card(draw, (x, y, x + width, y + height), fill=WHITE, outline=LINE, radius=13, width=2)
        draw.rounded_rectangle((x + 12, y + 13, x + 50, y + 51), radius=8, fill=ORANGE)
        draw.text((x + 31, y + 31), f"{i + 1:02d}", font=font(15, True), fill=NAVY, anchor="mm")
        title_x = x + 62
        title_y = write_text(draw, story_title(story), (title_x, y + 13), font(18, True), INK, width - 80, 2, 3)
        summary = str(story.get("poster_summary_zh") or story_summary(story))
        write_text(draw, summary, (x + 18, max(title_y + 2, y + 59)), font(13), MUTED, width - 36, 2, 2)
        draw.text((x + 18, y + height - 20), str(story.get("source") or "公开来源")[:35], font=font(10, True), fill=BLUE)

    observation = str(editorial.get("core_zh") or editorial.get("trend_zh") or "AI 正从能力展示走向可落地的实际工作。")
    card(draw, (40, 708, 860, 820), fill=(237, 241, 239), outline=(215, 222, 220), radius=15)
    draw.rectangle((40, 708, 50, 820), fill=ORANGE)
    draw.text((68, 726), "DAVYLAB 观察", font=font(19, True), fill=BLUE)
    write_text(draw, observation, (68, 761), font(16), INK, 760, 2, 4)

    card(draw, (40, 840, 515, 1120), fill=(246, 235, 216), outline=(232, 216, 187), radius=16)
    draw.text((62, 860), "今日 Skill  /  OPEN-SOURCE", font=font(17, True), fill=BLUE)
    write_text(draw, str(skill.get("name") or "Open-source Skill"), (62, 895), font(24, True), INK, 430, 2, 4)
    desc = str(skill.get("poster_description_zh") or skill.get("description_zh") or skill.get("description") or "")
    write_text(draw, desc, (62, 955), font(15), INK, 430, 3, 4)
    license_name = str(skill.get("license_name") or skill.get("license") or "许可证信息待核验")
    draw.text((62, 1040), f"许可证：{license_name[:36]}", font=font(12, True), fill=BLUE)
    draw.text((62, 1065), "未实测安装；未完成专项安全审计", font=font(11, True), fill=MUTED)
    draw.text((62, 1090), domain(str(skill.get("official_website") or skill.get("url") or "")), font=font(11), fill=MUTED)

    card(draw, (540, 840, 860, 1120), fill=WHITE, outline=LINE, radius=16)
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(PUBLIC_URL)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_image = qr_image.resize((QR_SIZE, QR_SIZE), Image.Resampling.NEAREST)
    image.paste(qr_image, (QR_X, QR_Y))
    draw.text((700, 1073), "扫码阅读完整简报", font=font(15, True), fill=INK, anchor="mm")
    draw.text((700, 1095), "正式入口 · 每日更新", font=font(11), fill=MUTED, anchor="mm")

    draw.rectangle((0, 1140, W, H), fill=NAVY)
    draw.text((40, 1160), "DAVYLAB  ·  让可能发生", font=font(17, True), fill=WHITE)
    draw.text((860, 1167), "来源可追溯  |  观点有边界", font=font(12), fill=(220, 231, 238), anchor="ra")
    return image


def make_copy(report: dict, top: list[dict], skill: dict, report_date: str) -> tuple[str, str]:
    editorial = report.get("editorial") or {}
    headline = str(editorial.get("headline_zh") or "AI 不只要更强，还得真能干活")
    opening = str(editorial.get("opening_zh") or "过去我们习惯用参数、榜单和发布会衡量 AI。现在问题变了：它能不能在真实流程里执行任务、验证结果、处理复杂环境？")
    try:
        date_label = dt.date.fromisoformat(report_date).strftime("%Y年%-m月%-d日")
    except ValueError:
        date_label = report_date
    china_count = sum(1 for story in top if str(story.get("source_section") or "") == "china_ai_news")
    global_count = sum(1 for story in top if str(story.get("source_section") or "") == "global_news")
    if china_count and global_count:
        intro = f"{date_label} 这期简报，挑出五条经过来源核验的全球与中国 AI 动态，看看 AI 正怎样走进真实场景 👇"
    elif china_count:
        intro = f"{date_label} 这期简报，聚焦五条经过来源核验的全球与中国 AI 动态，看看 AI 正怎样走进真实场景 👇"
    else:
        intro = f"{date_label} 这期简报，聚焦五条经过来源核验的 AI 动态；中国 AI 暂无足够可靠的新闻进入本期 Top 5，我们不为了凑数硬塞 👇"
    emojis = {"agent": "🤖", "retail": "🏪", "usage": "🧮", "routing": "💼", "forest": "🌳"}
    parts = [headline, "", opening, "", intro, ""]
    for i, story in enumerate(top[:5]):
        kind = classify_topic(story, i)
        summary = str(story.get("social_what_zh") or story_summary(story)).strip()
        why = str(story.get("social_why_zh") or story_why(story)).strip()
        line = f"{emojis.get(kind, '🔎')} {story_title(story)}"
        parts.append(line)
        body = summary
        if why and why not in summary:
            body = (body + " " + why).strip()
        parts.append(body)
        parts.append(f"来源：{story.get('source') or domain(story_url(story))}")
        parts.append("")
    parts.extend([
        "🧰 今日实用 Skill",
        f"{skill.get('name_zh') or skill.get('name') or '开源 Skill'}：{skill.get('social_description_zh') or skill.get('description_zh') or skill.get('description') or '详见项目仓库。'}",
        f"许可证：{skill.get('license_name') or skill.get('license') or '待核验'}；项目仓库：{skill.get('url') or '见正式简报'}。",
        f"官方项目主页：{skill.get('official_website') or skill.get('url') or '见正式简报'}（{'独立官网' if skill.get('official_website_type') == 'declared_project_homepage' else '未声明独立官网，使用官方 GitHub 项目页'}）。",
        f"适用范围：{str(skill.get('compatibility_status') or '宿主兼容性未实测').rstrip('。.! ')}。",
        f"安全说明：{str(skill.get('security_status') or '未完成独立安全审计').rstrip('。.! ')}。",
        "",
        "💡 DAVYLAB 观察",
        str(editorial.get("trend_zh") or editorial.get("core_zh") or "AI 正在从单点能力走向可执行、可管理的工作流程。"),
        str(editorial.get("core_zh") or "对普通人来说，先从一个可验证的小任务开始，比追逐所有新模型更实际。"),
        str(editorial.get("analysis_scope_zh") or "以上为 DAVYLAB 基于本期公开来源的综合判断。"),
        "",
        f"❓ {editorial.get('question_zh') or '如果把 AI 接进你的日常工作，你最希望它先接手哪一步？'}",
        str(editorial.get("options_zh") or "A. 查资料与做研究  B. 写代码与做产品  C. 门店与客户服务  D. 流程、审批与成本管理"),
        "欢迎在评论区分享一个你真想交给 AI 的任务。",
        "",
        "作者：DAVYLAB｜让可能发生",
        "#AI #人工智能 #AI智能体 #AI工具 #职场效率",
        "",
        f"完整简报：{PUBLIC_URL}",
    ])
    wechat = "\n".join(parts).strip() + "\n"
    moments = (
        f"{headline}。\n"
        f"{report_date} 的 DAVYLAB AI 前沿简报，聊聊智能体、真实业务和 AI 落地的变化。"
        f"\n不只看模型有多强，更看它能不能把事情做好。\n{PUBLIC_URL}\n"
        "#AI #人工智能 #DAVYLAB"
    )
    return wechat, moments


def safe_slug(text: str, index: int) -> str:
    ascii_text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (ascii_text[:42] or f"story-{index:02d}").strip("-")


def main() -> int:
    report = json.loads(DATA.read_text(encoding="utf-8"))
    report_date = str(report.get("report_date") or "")
    today = dt.datetime.now(TZ).date().isoformat()
    if report_date != today:
        raise SystemExit(f"Refusing stale social pack: report={report_date}; expected={today}")
    visual = validate_visual_lock(report_date)
    top = report.get("top5") or []
    if len(top) != 5:
        raise SystemExit(f"Social pack requires exactly five curated stories; found {len(top)}")
    if any(not story_url(s).startswith("https://") for s in top):
        raise SystemExit("Social pack blocked: every Top 5 story must have a traceable HTTPS source")
    skills = report.get("skills") or []
    if not skills:
        raise SystemExit("Social pack blocked: no repository-backed Skill recommendation")
    skill = skills[0]
    if not (skill.get("license") or skill.get("license_name")):
        raise SystemExit("Social pack blocked: featured Skill has no verified license evidence")
    if not (skill.get("official_website_verified") and skill.get("official_website") and skill.get("readme_verified") and skill.get("evidence_verified") and skill.get("skill_file_paths")):
        raise SystemExit("Social pack blocked: official project page, README, actual SKILL.md and repository evidence must all be verified")

    out = OUT_ROOT / report_date
    out.mkdir(parents=True, exist_ok=True)
    images = []
    main_name = "01-main-poster.png"
    TEXT_BOUNDS.clear()
    draw_main_poster(report, top, skill, report_date).save(out / main_name, format="PNG", optimize=True)
    main_text_bounds = list(TEXT_BOUNDS)
    images.append({
        "filename": main_name, "theme": "当日主海报：五条精选新闻、DAVYLAB观察、Skill与二维码",
        "material_type": "程序绘制的品牌编辑版式与几何主题视觉", "image_type": "main_poster",
        "source_url": PUBLIC_URL, "label": "主题视觉 · 非新闻现场",
        "layout_regions": social_layout_regions("main_poster"), "text_bounds": main_text_bounds
    })
    topic_news = select_topic_stories(top)
    topic_category_counts = {}
    for index, (category, story) in enumerate(topic_news, start=1):
        topic_category_counts[category] = topic_category_counts.get(category, 0) + 1
        region_slug = "global" if category == "global_news" else ("china" if category == "china_ai_news" else "topic")
        filename = f"{index + 1:02d}-{region_slug}-story-{index:02d}-{safe_slug(story_title(story), index)}.png"
        TEXT_BOUNDS.clear()
        render_topic_image(story, index - 1, report_date, category).save(out / filename, format="PNG", optimize=True)
        topic_text_bounds = list(TEXT_BOUNDS)
        images.append({
            "filename": filename, "theme": story_title(story),
            "material_type": "程序绘制的原创主题插画", "image_type": "topic_illustration",
            "category": category, "source": story.get("source"), "source_url": story_url(story),
            "published": story.get("published"), "label": "主题插画 · 非新闻现场",
            "layout_regions": social_layout_regions("topic_illustration"), "text_bounds": topic_text_bounds
        })

    source_report_sha256 = hashlib.sha256(DATA.read_bytes()).hexdigest()
    for entry in images:
        image_path = out / entry["filename"]
        with Image.open(image_path) as saved_image:
            entry["width"], entry["height"] = saved_image.size
            entry["format"] = saved_image.format
        entry["file_size_bytes"] = image_path.stat().st_size
        entry["sha256"] = hashlib.sha256(image_path.read_bytes()).hexdigest()
        entry["qa_status"] = "PENDING_FINAL_VERIFICATION"

    wechat, moments = make_copy(report, top, skill, report_date)
    (out / "wechat-copy.md").write_text(wechat, encoding="utf-8")
    (out / "moments-copy.md").write_text(moments, encoding="utf-8")
    manifest = {
        "report_date": report_date,
        "generated_at": dt.datetime.now(TZ).isoformat(),
        "source_report_generated_at": report.get("generated_at"),
        "source_report_sha256": source_report_sha256,
        "public_url": PUBLIC_URL,
        "style": visual,
        "canvas": [W, H],
        "required_count": 6,
        "story_urls": [story_url(s) for s in top],
        "story_titles": [story_title(s) for s in top],
        "topic_story_urls": [story_url(s) for _, s in topic_news],
        "topic_categories": topic_category_counts,
        "skill": {"name": skill.get("name"), "url": skill.get("url"), "description_zh": skill.get("description_zh"), "compatibility_status": skill.get("compatibility_status"), "actual_skill_file_count": skill.get("actual_skill_file_count"), "security_status": skill.get("security_status"), "official_website": skill.get("official_website"), "official_website_verified": skill.get("official_website_verified"), "official_website_http_status": skill.get("official_website_http_status"), "official_website_type": skill.get("official_website_type"), "readme_verified": skill.get("readme_verified"), "skill_file_paths": skill.get("skill_file_paths"), "evidence_verified": skill.get("evidence_verified"), "license": skill.get("license_name") or skill.get("license")},
        "images": images,
        "phone_camera_scan": "NOT_TESTED",
        "wechat_editor_preview": "NOT_TESTED"
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated six independent WeChat assets in {out}; style={visual['design_variant']}; canvas={W}x{H}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
