"""P1 offline tests: no external API, credentials or publication."""
import datetime as dt
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("news_engine_research", pathlib.Path(__file__).with_name("research.py"))
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)
NOW = dt.datetime(2026, 11, 17, tzinfo=dt.timezone.utc)

def story(title="GitHub announces agent security research", url="https://github.blog/story"):
    return {"title": title, "url": url, "canonical_url": url,
            "published_at": "2026-11-16T12:00:00+00:00", "source": "GitHub Blog"}

class ResearchTests(unittest.TestCase):
    def test_score_deterministic(self):
        self.assertEqual(research.rank(story(), NOW), research.rank(story(), NOW))
        self.assertGreater(research.rank(story(), NOW), 0)

    def test_stale_and_future_not_ranked(self):
        s = story()
        s["published_at"] = "2026-11-01T12:00:00+00:00"
        self.assertEqual(research.rank(s, NOW), 0)
        s["published_at"] = "2026-11-18T12:00:00+00:00"
        self.assertEqual(research.rank(s, NOW), 0)

    def test_invalid_date_and_url(self):
        s = story()
        s["canonical_url"] = "http://example.org/story"
        self.assertFalse(research.valid_story(s))
        s = story()
        s["published_at"] = "2026-11-16"
        self.assertFalse(research.valid_story(s))

    def test_cross_source_is_not_fact_verification(self):
        a, b = story(), story(url="https://techcrunch.com/other")
        result = research.research({"schema_version": 1, "stories": [a, b]}, NOW)
        self.assertEqual(len(result["candidates"]), 1)
        candidate = result["candidates"][0]
        self.assertEqual(candidate["cross_source_status"], "multi_domain_candidate_unverified")
        self.assertEqual(candidate["verification_status"], "requires_primary_source_and_fact_check")
        self.assertEqual(len(candidate["source_urls"]), 2)

    def test_unrelated_stories_separate(self):
        a, b = story(), story("Scientists discover deep ocean species", "https://techcrunch.com/ocean")
        result = research.research({"schema_version": 1, "stories": [a, b]}, NOW)
        self.assertEqual(len(result["candidates"]), 2)

    def test_gateway_only_prepares_payload(self):
        candidate = research.research({"schema_version": 1, "stories": [story()]}, NOW)["candidates"][0]
        payload = research.gateway_request(candidate)
        self.assertEqual(payload["verification_status"], "unverified")
        self.assertEqual(len(payload["source_urls"]), 1)

    def test_schema_rejected(self):
        with self.assertRaises(ValueError):
            research.research({"stories": []}, NOW)

    def test_invalid_item_counted(self):
        result = research.research({"schema_version": 1, "stories": [story(), {"title": "bad"}]}, NOW)
        self.assertEqual(result["rejected_count"], 1)

if __name__ == "__main__":
    unittest.main()
