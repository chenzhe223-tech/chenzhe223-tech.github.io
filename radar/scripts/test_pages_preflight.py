"""Regression tests for the Pages refresh contract."""

import unittest
from pathlib import Path

from radar.scripts.pages_preflight import report_has_explicit_xnews_state


class PagesPreflightXNewsContractTests(unittest.TestCase):
    def test_missing_status_requires_refresh(self):
        self.assertFalse(report_has_explicit_xnews_state({"xnews_voices": []}))

    def test_blank_status_requires_refresh(self):
        self.assertFalse(report_has_explicit_xnews_state({"xnews_status": "  ", "xnews_voices": []}))

    def test_non_string_status_requires_refresh(self):
        self.assertFalse(report_has_explicit_xnews_state({"xnews_status": 1, "xnews_voices": []}))

    def test_unrecognized_status_requires_refresh(self):
        self.assertFalse(report_has_explicit_xnews_state({"xnews_status": "future_unknown_state", "xnews_voices": []}))

    def test_missing_or_non_list_voices_requires_refresh(self):
        self.assertFalse(report_has_explicit_xnews_state({"xnews_status": "ok"}))
        self.assertFalse(report_has_explicit_xnews_state({"xnews_status": "ok", "xnews_voices": {}}))

    def test_explicit_empty_results_are_a_valid_state(self):
        for status in ("no_recent", "unavailable", "incompatible_schema", "incompatible_feed", "invalid_xml", "disabled"):
            with self.subTest(status=status):
                self.assertTrue(report_has_explicit_xnews_state({"xnews_status": status, "xnews_voices": []}))

    def test_populated_results_are_a_valid_state(self):
        self.assertTrue(report_has_explicit_xnews_state({"xnews_status": "ok", "xnews_voices": [{"url": "https://example.com"}]}))

    def test_pages_workflow_wires_contract_into_skip_gate(self):
        workflow = Path(".github/workflows/pages.yml").read_text(encoding="utf-8")
        self.assertIn("from radar.scripts.pages_preflight import report_has_explicit_xnews_state", workflow)
        self.assertIn("and report_has_explicit_xnews_state(report)", workflow)
        self.assertIn("if not report_has_explicit_xnews_state(d):", workflow)
        self.assertIn("assert report_has_explicit_xnews_state(data)", workflow)
        self.assertIn("if not report_has_explicit_xnews_state(report):", workflow)


if __name__ == "__main__":
    unittest.main()
