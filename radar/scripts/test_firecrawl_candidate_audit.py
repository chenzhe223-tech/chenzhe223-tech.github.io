import unittest
from radar.scripts.firecrawl_candidate_audit import audit, url_key, published_date

class FirecrawlCandidateAuditTests(unittest.TestCase):
    def test_url_normalization(self):
        self.assertEqual(url_key("http://www.example.com/a/?utm_source=x#frag"), "https://example.com/a")
    def test_date(self):
        self.assertEqual(published_date("2026-11-07T09:00:00Z"), "2026-11-07")
    def test_history_duplicate_and_candidate(self):
        rows = [{"title":"Gemini 4 Carbon", "url":"https://google.example/carbon", "published":"2026-10-28"},
                {"title":"Different launch", "url":"https://example.com/new", "published":"2026-11-07"}]
        old = [{"title":"Gemini 4 Carbon", "url":"https://old.example/story"}]
        result = audit(rows, "2026-11-08", old)
        self.assertEqual([r["status"] for r in result["results"]], ["DUPLICATE", "CANDIDATE"])
        self.assertFalse(result["publish_allowed"])
    def test_missing_history_fails_closed(self):
        result = audit([{"title":"News", "url":"https://example.com/a", "published":"2026-11-07"}],
                       "2026-11-08", None, "archive missing")
        self.assertEqual(result["results"][0]["status"], "HOLD")
    def test_missing_date_fails_closed(self):
        result = audit([{"title":"News", "url":"https://example.com/a"}], "2026-11-08", [])
        self.assertEqual(result["results"][0]["status"], "HOLD")
    def test_batch_duplicate(self):
        rows = [{"title":"Same", "url":"https://example.com/a", "published":"2026-11-07"},
                {"title":"Same", "url":"https://example.com/b", "published":"2026-11-07"}]
        result = audit(rows, "2026-11-08", [])
        self.assertEqual(result["results"][1]["status"], "DUPLICATE")

if __name__ == "__main__":
    unittest.main()
