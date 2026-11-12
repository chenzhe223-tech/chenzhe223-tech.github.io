"""Offline contract tests for the optional X News discovery adapter."""
import datetime as dt
import json
import unittest
import xml.etree.ElementTree as ET
from email.utils import format_datetime

from radar.scripts.xnews_sources import collect_xnews_articles, parse_xnews_feed

NOW = dt.datetime(2026, 11, 12, 1, 0, tzinfo=dt.timezone.utc)
NS = "{https://qiaomu.ai/ns/rss/1.0}versions"


def make_feed(records, *, include_versions=True):
    rss = ET.Element("rss", {"version": "2.0"})
    channel = ET.SubElement(rss, "channel")
    for record in records:
        item = ET.SubElement(channel, "item")
        ET.SubElement(item, "title").text = record.get("title", "人工智能技术观察")
        ET.SubElement(item, "link").text = record.get("curated_url", "https://xnews.qiaomu.ai/a/demo")
        ET.SubElement(item, "pubDate").text = record.get(
            "pub_date", format_datetime(NOW - dt.timedelta(days=1))
        )
        ET.SubElement(item, "description").text = "MIXED FULL ARTICLE MUST NOT BE COPIED"
        if include_versions:
            versions = {
                "version": record.get("version", 1),
                "original": {
                    "url": record.get("source_url", "https://x.com/researcher/status/123"),
                    "title": "Original research post",
                    "lang": "en",
                    "html": "<p>Original full article</p>",
                },
                "rewrite": {
                    "title": record.get("title", "模型研究新进展"),
                    "markdown": record.get(
                        "markdown", "这是一段来自公开技术研究文章的简短中文概述，完整的观点和数据仍然需要查看原始作者的原文，以免遗漏关键限制条件。" * 5
                    ),
                    "html": "<p>Long full rewrite NOT copied</p>",
                },
            }
            ET.SubElement(item, NS).text = json.dumps(versions, ensure_ascii=False)
    return ET.tostring(rss, encoding="utf-8")


class XNewsFeedTests(unittest.TestCase):
    def test_uses_original_url_and_source_published_date(self):
        stories, status = parse_xnews_feed(make_feed([{}]), now=NOW)
        self.assertEqual(status, "ok")
        self.assertEqual(len(stories), 1)
        story = stories[0]
        self.assertEqual(story["url"], "https://x.com/researcher/status/123")
        self.assertEqual(story["curated_url"], "https://xnews.qiaomu.ai/a/demo")
        self.assertEqual(story["source_kind"], "curated_secondary")
        self.assertEqual(story["published"], "2026-11-11T01:00:00+00:00")
        self.assertLessEqual(len(story["summary_zh"]), 121)
        self.assertNotIn("MIXED FULL ARTICLE", str(story))
        self.assertNotIn("Long full rewrite NOT copied", str(story))

    def test_fails_closed_if_dual_version_contract_missing(self):
        stories, status = parse_xnews_feed(make_feed([{}], include_versions=False), now=NOW)
        self.assertEqual(stories, [])
        self.assertEqual(status, "incompatible_schema")

    def test_rejects_unsafe_or_unsupported_destinations(self):
        stories, _ = parse_xnews_feed(make_feed([
            {"source_url": "javascript:alert(1)"},
            {"curated_url": "https://evil.example/a/demo"},
            {"source_url": "https://user:pass@x.com/private"},
        ]), now=NOW)
        self.assertEqual(stories, [])

    def test_source_date_is_required_and_fresh(self):
        stories, status = parse_xnews_feed(make_feed([
            {"pub_date": format_datetime(NOW - dt.timedelta(days=9))},
            {"pub_date": "not a real date"},
            {"pub_date": format_datetime(NOW + dt.timedelta(days=3))},
        ]), now=NOW)
        self.assertEqual(stories, [])
        self.assertEqual(status, "no_recent")

    def test_deduplicates_by_original_url(self):
        stories, _ = parse_xnews_feed(make_feed([
            {"title": "观察一"},
            {"title": "观察二"},
        ]), now=NOW)
        self.assertEqual(len(stories), 1)

    def test_unavailable_feed_does_not_throw(self):
        def offline(*_args, **_kwargs):
            raise TimeoutError("source offline")

        stories, status = collect_xnews_articles(offline, now=NOW)
        self.assertEqual(stories, [])
        self.assertEqual(status, "unavailable")

    def test_rejects_doctype(self):
        stories, status = parse_xnews_feed(b"<!DOCTYPE foo><rss></rss>", now=NOW)
        self.assertEqual(stories, [])
        self.assertEqual(status, "invalid_xml")


if __name__ == "__main__":
    unittest.main()
