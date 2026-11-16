"""Offline contract tests: no network, no paid API."""
import datetime as dt
import importlib.util
import pathlib
import unittest
import tempfile

spec = importlib.util.spec_from_file_location("news_engine_collector", pathlib.Path(__file__).with_name("collector.py"))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
NOW = dt.datetime(2026, 11, 15, tzinfo=dt.timezone.utc)
RSS = b"""<rss><channel><item><title>AI research</title><link>https://example.org/post</link><pubDate>Sat, 14 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>"""
ATOM = b"""<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>AI paper</title><link href="https://example.org/atom"/><updated>2026-11-14T12:00:00Z</updated></entry></feed>"""

class CollectorTests(unittest.TestCase):
    def test_rss(self):
        rows = collector.parse(RSS, "test", NOW)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["editorial_status"], "discovered")
    def test_atom(self):
        self.assertEqual(len(collector.parse(ATOM, "test", NOW)), 1)
    def test_unsafe_xml(self):
        with self.assertRaises(ValueError):
            collector.parse(b'<!DOCTYPE foo><rss/>', "test", NOW)
    def test_source_isolation(self):
        sources = [{"name": "bad", "url": "https://bad.example/feed"}, {"name": "good", "url": "https://good.example/feed"}]
        def get(url):
            if "bad" in url:
                raise TimeoutError()
            return RSS
        result, _ = collector.collect(sources, get, NOW)
        self.assertEqual(len(result["stories"]), 1)
        self.assertEqual([x["status"] for x in result["diagnostics"]], ["error", "ok"])
    def test_dedupe(self):
        sources = [{"name": "a", "url": "https://a.example/feed"}, {"name": "b", "url": "https://b.example/feed"}]
        self.assertEqual(len(collector.collect(sources, lambda _: RSS, NOW)[0]["stories"]), 1)
    def test_persistent_history(self):
        sources=[{"name":"a","url":"https://a.example"}]
        first,history=collector.collect(sources,lambda _:RSS,NOW)
        second,_=collector.collect(sources,lambda _:RSS,NOW+dt.timedelta(days=1),history)
        self.assertEqual((len(first["stories"]),len(second["stories"])),(1,0))
        with tempfile.TemporaryDirectory() as directory:
            path=pathlib.Path(directory)/"history.json"
            collector.save_json(path,history)
            self.assertEqual(collector.load_history(path),history["seen"])
    def test_expired_history(self):
        old={"url:https://example.org/post":(NOW-dt.timedelta(days=91)).isoformat()}
        result,_=collector.collect([{"name":"a","url":"https://a.example"}],lambda _:RSS,NOW,old)
        self.assertEqual(len(result["stories"]),1)
    def test_title_dedupe(self):
        other=RSS.replace(b"https://example.org/post",b"https://other.example/story")
        sources=[{"name":"a","url":"https://a.example"},{"name":"b","url":"https://b.example"}]
        result,_=collector.collect(sources,lambda url: RSS if "a.example" in url else other,NOW)
        self.assertEqual(len(result["stories"]),1)
    def test_invalid_history(self):
        with tempfile.TemporaryDirectory() as directory:
            path=pathlib.Path(directory)/"history.json"
            path.write_text("{}")
            with self.assertRaises(ValueError): collector.load_history(path)
    def test_reject_insecure(self):
        self.assertEqual(collector.safe_url("http://example.org"), "")
        self.assertEqual(collector.safe_url("https://user:pass@example.org"), "")

if __name__ == "__main__":
    unittest.main()
