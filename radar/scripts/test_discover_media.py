"""Offline tests for DAVYLAB Hotspot Radar discovery helper."""
import datetime as dt
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("discover_media.py")
SPEC = importlib.util.spec_from_file_location("discover_media", SCRIPT)
module = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(module)


class DiscoverMediaTests(unittest.TestCase):
    def test_parse_rss_item(self):
        xml = b"""<?xml version="1.0"?><rss version="2.0"><channel><item>
        <title>AI tool launch</title><link>https://example.com/story</link>
        <description>A short summary</description><pubDate>Mon, 19 Oct 2026 08:00:00 GMT</pubDate>
        </item></channel></rss>"""
        feed = {"name": "Example", "url": "https://example.com/feed.xml", "type": "news", "region": "global"}
        with patch.object(module, "fetch", return_value=xml):
            records, error = module.parse_feed(feed, "2026-10-20T09:00:00+08:00")
        self.assertIsNone(error)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["title"], "AI tool launch")
        self.assertEqual(records[0]["source_url"], "https://example.com/story")
        self.assertTrue(records[0]["published_at"].startswith("2026-10-19T08:00:00"))
        self.assertIsNone(records[0]["metrics"]["views"])

    def test_unknown_timestamp_is_not_fabricated(self):
        xml = b"""<rss><channel><item><title>Undated item</title><link>https://example.com/a</link></item></channel></rss>"""
        feed = {"name": "Example", "url": "https://example.com/feed.xml", "type": "news"}
        with patch.object(module, "fetch", return_value=xml):
            records, error = module.parse_feed(feed, "2026-10-20T09:00:00+08:00")
        self.assertIsNone(error)
        self.assertEqual(records[0]["published_at"], "")
        self.assertEqual(records[0]["status"], "needs_verification")

    def test_non_https_feed_rejected(self):
        with self.assertRaises(ValueError):
            module.fetch("http://example.com/feed.xml")

    def test_canonical_anchor_removed(self):
        feed = {"name": "Example", "url": "https://example.com/feed", "type": "news"}
        item = module.make_record(feed, "Title", "https://example.com/story#part", "", "", "now", "")
        self.assertEqual(item["source_url"], "https://example.com/story")


if __name__ == "__main__":
    unittest.main()
