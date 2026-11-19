"""Tests prove the history transaction without touching GitHub or production."""
import datetime as dt
import unittest

import history_backend as backend

NOW = dt.datetime(2026, 11, 19, 6, tzinfo=dt.timezone.utc)
RSS = b"""<rss><channel><item><title>Example announces a new research model</title>
<link>https://example.org/announcement</link>
<pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>"""
SRC = [{"name": str(i), "url": f"https://source{i}.example/feed"} for i in range(5)]


class HistoryBackendTests(unittest.TestCase):
    def test_separate_week_files_cover_full_90_days(self):
        keys = backend.history_weeks(NOW)
        self.assertIn(backend.week_key((NOW - dt.timedelta(days=90)).date()), keys)
        self.assertEqual(keys[-1], backend.week_key(NOW.date()))
        self.assertGreaterEqual(len(keys), 13)

    def test_second_run_dedupes_across_fresh_runners(self):
        store = {}
        def read(repo, token, week):
            return store.get(week, {}).copy(), str(len(store[week])) if week in store else None
        def write(repo, token, week, seen, sha):
            store[week] = seen
        first = backend.collect_persistently(repo="a/b", token="mock", sources=SRC,
             http_get=lambda _: RSS, now=NOW, read=read, write=write)
        second = backend.collect_persistently(repo="a/b", token="mock", sources=SRC,
             http_get=lambda _: RSS, now=NOW + dt.timedelta(days=1), read=read, write=write)
        self.assertEqual(len(first["stories"]), 1)
        self.assertEqual(len(second["stories"]), 0)
        self.assertEqual(first["history_new_keys"], 2)
        self.assertEqual(first["history_backend"], "github_weekly_isolated")

    def test_conflict_reloads_before_resolving_duplicates(self):
        store = {}
        attempts = []
        def read(repo, token, week):
            return store.get(week, {}).copy(), "sha" if week in store else None
        def write(repo, token, week, seen, sha):
            attempts.append(week)
            if len(attempts) == 1:
                store[week] = seen
                raise backend.StateConflict("simulated overlapping runner")
            store[week] = seen
        result = backend.collect_persistently(repo="a/b", token="mock", sources=SRC,
               http_get=lambda _: RSS, now=NOW, read=read, write=write)
        self.assertEqual(len(result["stories"]), 0)
        self.assertEqual(len(attempts), 2)

    def test_failed_source_blocks_history_advance(self):
        writes = []
        def http_get(url):
            if "source0" in url:
                raise TimeoutError("no DNS")
            return RSS
        with self.assertRaisesRegex(RuntimeError, "incomplete"):
            backend.collect_persistently(repo="a/b", token="mock", sources=SRC,
               http_get=http_get, now=NOW, read=lambda *args: ({}, None),
               write=lambda *args: writes.append(args))
        self.assertFalse(writes)

    def test_history_format_validation(self):
        key = backend.week_key(NOW.date())
        with self.assertRaises(ValueError):
            backend._validate({"schema_version":1,"week":key,
                               "seen":{"url:x":"timestamp unknown"}}, key)

    def test_no_token_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "token required"):
            backend._api("a/b", "", "GET", "2026-W47")

    def test_isolated_state_path(self):
        self.assertEqual(backend.STATE_BRANCH, "news-engine-state")
        self.assertTrue(backend.ROOT.startswith("news-engine/"))
        self.assertNotIn("radar", backend.ROOT)


if __name__ == "__main__":
    unittest.main()
