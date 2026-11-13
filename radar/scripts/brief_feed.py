"""Write one dated entry per briefing in the site's subscription feed."""
from datetime import datetime
from email.utils import format_datetime
import json
from pathlib import Path
import xml.etree.ElementTree as ET

DAILY = "https://chenzhe223-tech.github.io/radar/daily/"


def write_feed(data):
    root = ET.Element("rss", version="2.0")
    channel = ET.SubElement(root, "channel")
    for key, value in [("title", "DAVYLAB AI Radar"), ("link", DAILY),
                       ("description", "每日 AI 简报"), ("language", "zh-CN")]:
        ET.SubElement(channel, key).text = value
    for path in sorted((data / "archive").glob("????-??-??.json"), reverse=True)[:30]:
        report = json.loads(path.read_text(encoding="utf-8"))
        day = report.get("report_date")
        stories = report.get("top5") or []
        if day != path.stem or not stories:
            continue
        link = DAILY + "?date=" + day
        entry = ET.SubElement(channel, "item")
        ET.SubElement(entry, "title").text = day + " · " + (stories[0].get("title_zh") or stories[0].get("title") or "每日简报")
        ET.SubElement(entry, "link").text = link
        ET.SubElement(entry, "guid").text = link
        ET.SubElement(entry, "description").text = "\n".join(s.get("title_zh") or s.get("title") or "" for s in stories)
        if report.get("generated_at"):
            date = datetime.fromisoformat(report["generated_at"])
            if date.tzinfo:
                ET.SubElement(entry, "pubDate").text = format_datetime(date)
    ET.indent(root)
    ET.ElementTree(root).write(data / "brief.xml", encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    write_feed(Path(__file__).resolve().parents[1] / "data")
