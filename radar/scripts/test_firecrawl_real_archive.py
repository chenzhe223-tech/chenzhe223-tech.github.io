"""Read-only integration checks against the real committed Radar archive."""
import datetime as dt
import unittest
from radar.scripts.firecrawl_candidate_audit import history, audit

class RealArchiveAuditTests(unittest.TestCase):
    def test_history_is_available_and_nonempty(self):
        records, error = history("2026-11-08", days=90)
        self.assertIsNone(error, error)
        self.assertGreater(len(records), 0)
        self.assertTrue(any(x.get("archive_date") for x in records))

    def test_known_cross_source_event_is_flagged(self):
        records, error = history("2026-11-08", days=90)
        self.assertIsNone(error, error)
        # Use a genuine source headline already present in 2026-10-29 archive.
        candidate = [{
            "title": "谷歌发布 Gemini 4 Carbon，主打编程、智能体与网络安全",
            "url": "https://new-publisher.example/another-carbon-report",
            "published": "2026-11-07T09:00:00+08:00",
            "source": "integration-fixture",
        }]
        result = audit(candidate, "2026-11-08", records)
        self.assertIn(result["results"][0]["status"], ("DUPLICATE", "REVIEW_DUPLICATE"))
        self.assertFalse(result["publish_allowed"])

    def test_recent_source_event_is_flagged(self):
        records, error = history("2026-11-08", days=90)
        self.assertIsNone(error, error)
        candidate = [{
            "title": "Gemini Omni 1.2 Flash: Fast and cost-effective with longer clips",
            "url": "https://another-publisher.example/omni-clip",
            "published": "2026-11-07",
        }]
        result = audit(candidate, "2026-11-08", records)
        self.assertIn(result["results"][0]["status"], ("DUPLICATE", "REVIEW_DUPLICATE"))

if __name__ == "__main__":
    unittest.main()
