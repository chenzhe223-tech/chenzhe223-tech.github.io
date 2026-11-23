"""Release-isolation and rollback regression tests. No production writes."""
import os
import unittest
from unittest.mock import patch

import integration as adapter


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.legacy_calls = []
        self.new_calls = []
    def legacy(self):
        self.legacy_calls.append(1)
        return {"source": "radar_legacy", "published": True}
    def candidate(self):
        self.new_calls.append(1)
        return {"schema_version": 1, "publishable": False,
                "editorial_status": "requires_human_review",
                "source_urls": ["https://source.example/notice"],
                "title": "Unreviewed research candidate"}

    def test_default_off_never_invokes_candidate(self):
        with patch.dict(os.environ, {"DAVYLAB_NEWS_ENGINE_ENABLED": "0"}):
            data, state = adapter.use_news_engine(legacy=self.legacy, candidate=self.candidate)
        self.assertEqual(data["source"], "radar_legacy")
        self.assertEqual(state["reason"], "disabled_or_unapproved")
        self.assertEqual(len(self.new_calls), 0)

    def test_approval_gate_separate_from_flag(self):
        data, state = adapter.use_news_engine(
            legacy=self.legacy, candidate=self.candidate, enabled=True, qa_approved=False)
        self.assertEqual(len(self.new_calls), 0)
        self.assertEqual(state["used"], "legacy")

    def test_approved_shadow_remains_unpublishable(self):
        result, state = adapter.use_news_engine(
            legacy=self.legacy, candidate=self.candidate, enabled=True, qa_approved=True)
        self.assertFalse(result["publishable"])
        self.assertEqual(state["used"], "news_engine_review_only")
        self.assertEqual(len(self.legacy_calls), 0)

    def test_failure_returns_legacy_without_affecting_publish(self):
        def error():
            raise ConnectionError("test simulated DNS failure")
        result, state = adapter.use_news_engine(
            legacy=self.legacy, candidate=error, enabled=True, qa_approved=True)
        self.assertEqual(state["reason"], "news_engine_failed")
        self.assertEqual(result["source"], "radar_legacy")

    def test_invalid_candidate_falls_back(self):
        result, state = adapter.use_news_engine(
            legacy=self.legacy, candidate=lambda: {"publishable": True},
            enabled=True, qa_approved=True)
        self.assertEqual(result["source"], "radar_legacy")
        self.assertEqual(state["reason"], "invalid_unreviewed_candidate")

    def test_export_never_leaks_secrets_or_claims_publishable(self):
        row = self.candidate()
        row["secret"] = "fake-key"
        result = adapter.public_payload(row)
        self.assertEqual(result["publishable"], False)
        self.assertNotIn("secret", result)
        self.assertEqual(result["verification_status"], "not_independently_verified")


if __name__ == "__main__":
    unittest.main()
