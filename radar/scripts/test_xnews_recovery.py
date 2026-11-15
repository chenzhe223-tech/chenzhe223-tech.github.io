"""Regression checks for malformed and transient X News feeds."""
import datetime as dt
import unittest
from radar.scripts.xnews_sources import collect_xnews_articles, parse_xnews_feed, MAX_FEED_BYTES

NOW = dt.datetime(2026, 11, 15, tzinfo=dt.timezone.utc)

class XNewsRecoveryTests(unittest.TestCase):
    def test_malformed_xml_is_reported(self):
        self.assertEqual(parse_xnews_feed(b"<rss><channel>", now=NOW)[1], "invalid_xml")

    def test_oversized_feed_is_distinguished(self):
        self.assertEqual(parse_xnews_feed(b"x" * (MAX_FEED_BYTES + 1), now=NOW)[1], "oversized_feed")

    def test_doctype_is_rejected(self):
        self.assertEqual(parse_xnews_feed(b"<!DOCTYPE rss><rss/>", now=NOW)[1], "doctype_rejected")

    def test_transient_malformed_feed_recovers(self):
        calls = []
        def get(url, accept, timeout):
            calls.append(url)
            return b"<rss><channel>" if len(calls) == 1 else b"<rss><channel></channel></rss>"
        items, status = collect_xnews_articles(get, now=NOW)
        self.assertEqual(len(calls), 2)
        self.assertEqual(items, [])
        self.assertEqual(status, "incompatible_schema")

    def test_repeated_failure_does_not_block(self):
        def get(url, accept, timeout):
            raise TimeoutError("offline")
        self.assertEqual(collect_xnews_articles(get, now=NOW), ([], "unavailable"))

if __name__ == "__main__":
    unittest.main()
