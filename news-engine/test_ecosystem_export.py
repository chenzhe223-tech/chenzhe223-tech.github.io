"""Offline P3 contract tests: no external network or production dependencies."""
import copy
import unittest
from ecosystem_export import export_contract, TARGETS

class EcosystemExportTests(unittest.TestCase):
    def setUp(self):
        self.package = {
            "publishable": False, "editorial_status": "requires_human_review",
            "title": "Research preview", "body": "Not verified",
            "candidate_id": "candidate-1", "revision": 2,
            "source_urls": ["https://example.org/primary"],
            "evidence": [{"source_url": "https://example.org/primary", "claim": "draft"}],
            "assets": [{"kind": "image", "url": "https://example.org/photo.png",
                        "source_url": "https://example.org/photo", "rights_status": "owned",
                        "alt": "Illustration"}],
            "api_key": "never-export-me",
        }
    def test_all_targets_are_review_only_and_do_not_mutate(self):
        before = copy.deepcopy(self.package)
        for target in TARGETS:
            result = export_contract(self.package, target)
            self.assertFalse(result["publishable"])
            self.assertEqual(result["target"], target)
            self.assertFalse(result["external_copy_allowed"])
            self.assertNotIn("api_key", result)
            self.assertEqual(result["source_urls"], ["https://example.org/primary"])
        self.assertEqual(self.package, before)
    def test_rejects_published_or_unprovenanced(self):
        for change in ({"publishable": True}, {"source_urls": [], "evidence": []},
                       {"assets": [{"kind": "image", "url": "http://unsafe.test",
                                   "source_url": "https://example.org", "rights_status": "owned",
                                   "alt": "x"}]}):
            row = {**self.package, **change}
            with self.assertRaises(ValueError):
                export_contract(row, "wechat")
    def test_rejects_unknown_target_and_rights(self):
        with self.assertRaises(ValueError):
            export_contract(self.package, "production")
        row = copy.deepcopy(self.package)
        row["assets"][0]["rights_status"] = "unknown"
        with self.assertRaises(ValueError):
            export_contract(row, "worldtoon")

if __name__ == "__main__":
    unittest.main()
