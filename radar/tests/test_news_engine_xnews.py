"""News Engine xnews-slot adapter: real P0/P1 offline contract and fail-safe tests."""
from __future__ import annotations

import datetime as dt
import os
import unittest
from email.utils import format_datetime
from unittest.mock import patch

from radar.scripts import news_engine_xnews as adapter

NOW = dt.datetime(2026, 11, 23, 1, 30, tzinfo=dt.timezone.utc)


def fake_feed(publisher_id: int, stories: int = 3):
    stamp = format_datetime(NOW - dt.timedelta(hours=5))
    items = []
    for n in range(stories):
        title = f"Original AI Research Update {publisher_id} Project {n} launches open evaluation pipeline"
        items.append(
            f"<item><title>{title}</title>"
            f"<link>https://example{publisher_id}.org/ai/announcement-{n}</link>"
            f"<pubDate>{stamp}</pubDate><description>Must never republish full text</description></item>"
        )
    return ("<rss><channel>" + "".join(items) + "</channel></rss>").encode()


class NewsEngineSlotTests(unittest.TestCase):
    def test_five_sources_rank_diverse_source_only_and_keep_original(self):
        calls = []
        def get(url, accept, timeout=8):
            calls.append((url, accept, timeout))
            if "openai.com" in url: return fake_feed(1)
            if "blog.google" in url: return fake_feed(2)
            if "huggingface" in url: return fake_feed(3)
            if "simonwillison" in url: return fake_feed(4)
            if "techcrunch" in url: return fake_feed(5)
            raise AssertionError("unexpected source " + url)
        leads, status = adapter.collect_news_engine_articles(get, now=NOW)
        self.assertEqual(status, "ok")
        self.assertEqual(len(calls), 5)
        self.assertEqual(len(leads), 6)
        self.assertGreaterEqual(len({x["source"] for x in leads}), 3)
        for story in leads:
            self.assertTrue(story["source_kind"] == "news_engine_rss_discovery")
            self.assertTrue(story["source_url"].startswith("https://"))
            self.assertEqual(story["verification_status"], "source_not_independently_verified")
            self.assertFalse(story["publishable"])
            self.assertIsInstance(story["research_score"], int)
            self.assertTrue(story["published"].startswith("2026-11-22"))
            self.assertNotIn("curated_url", story)
            self.assertNotIn("image_url", story)
            self.assertNotIn("Must never republish full text", repr(story))
            self.assertEqual(story["title_zh"], "")

    def test_partial_source_outage_does_not_block(self):
        def get(url, accept, timeout=8):
            if "techcrunch" in url: raise TimeoutError("upstream down")
            return fake_feed(1) if "openai" in url else fake_feed(
                2 if "google" in url else 3 if "huggingface" in url else 4)
        leads, status = adapter.collect_news_engine_articles(get, now=NOW)
        self.assertEqual(status, "ok")
        self.assertTrue(leads)

    def test_major_outage_falls_back_without_blocking_daily(self):
        def get(*args, **kwargs):
            raise TimeoutError("temporary source outage")
        with patch.dict(os.environ, {"RADAR_NEWS_ENGINE_LEGACY_FALLBACK": "0"}):
            self.assertEqual(adapter.collect_news_engine_articles(get, now=NOW), ([], "unavailable"))

    def test_explicit_legacy_rollback_and_disabled_gate(self):
        with patch.object(adapter, "_legacy", return_value=([{"source":"legacy"}], "ok")) as legacy:
            with patch.dict(os.environ, {"RADAR_XNEWS_PROVIDER": "legacy"}):
                self.assertEqual(adapter.collect_news_engine_articles(lambda *args, **kwargs: None, now=NOW)[0][0]["source"], "legacy")
            legacy.assert_called_once()
        with patch.dict(os.environ, {"RADAR_XNEWS_PROVIDER": "disabled"}):
            self.assertEqual(adapter.collect_news_engine_articles(lambda *args, **kwargs: None, now=NOW), ([], "disabled"))

    def test_private_or_malformed_links_are_rejected(self):
        for url in ["https://127.0.0.1/data", "https://localhost/data", "https://10.0.1.1/data",
                    "https://user:pass@example.org/x", "http://example.org/x", "https://[::1]/",
                    "javascript:alert(1)"]:
            self.assertFalse(adapter._public_https(url), url)
        self.assertTrue(adapter._public_https("https://openai.com/news/example"))


if __name__ == "__main__":
    unittest.main()
