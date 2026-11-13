"""Regression tests for the Pages refresh contract."""

import unittest
import ast
import textwrap
from pathlib import Path

from radar.scripts.pages_preflight import report_has_explicit_xnews_state


class PagesPreflightXNewsContractTests(unittest.TestCase):
    def test_each_python_step_imports_the_contract_it_calls(self):
        yaml = Path(".github/workflows/pages.yml").read_text(encoding="utf-8")
        uses = 0
        name = "report_has_explicit_xnews_state"
        for chunk in yaml.split("<<'PY'")[1:]:
            lines = chunk.splitlines()
            end = next(i for i, line in enumerate(lines) if line.strip() == "PY")
            script = textwrap.dedent("\n".join(lines[:end]))
            tree = ast.parse(script)
            if any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == name for n in ast.walk(tree)):
                uses += 1
                imports = [a.name for n in tree.body if isinstance(n, ast.ImportFrom)
                           and n.module == "radar.scripts.pages_preflight" for a in n.names]
                self.assertIn(name, imports, script[:240])
        self.assertGreaterEqual(uses, 4)
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
