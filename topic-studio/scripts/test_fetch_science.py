"""Unit tests for DAVYLAB public scientific metadata ingestion. No network."""
import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

MODULE = Path(__file__).with_name("fetch_science.py")
spec = importlib.util.spec_from_file_location("fetch_science", MODULE)
science = importlib.util.module_from_spec(spec)
spec.loader.exec_module(science)
NOW = datetime(2026, 11, 23, tzinfo=timezone.utc)


def item(**extra):
    base = {
        "DOI": "10.1038/s41586-026-10000-a",
        "title": ["Interfacial chemistry of microplastics"],
        "container-title": ["Nature"],
        "published": {"date-parts": [[2026, 11, 20]]},
        "abstract": "<jats:p>Controlled measurement of molecules.</jats:p>",
        "author": [{"given": "A", "family": "Researcher"}],
    }
    base.update(extra)
    return base


class DiscoveryTest(unittest.TestCase):
    def test_real_doi_metadata_normalizes(self):
        x = science.normalize(item(), "nature", NOW)
        self.assertEqual(x["source"], "nature")
        self.assertEqual(x["journal"], "Nature")
        self.assertEqual(x["published_at"], "2026-11-20")
        self.assertEqual(x["verification"], "crossref_metadata_only")
        self.assertNotIn("<", x["summary"])

    def test_reject_bad_doi(self):
        self.assertIsNone(science.normalize(item(DOI="not a doi"), "nature", NOW))

    def test_reject_journal_mismatch(self):
        self.assertIsNone(science.normalize(item(**{"container-title": ["Different Journal"]}), "nature", NOW))

    def test_reject_unpublished_future_date(self):
        self.assertIsNone(science.normalize(item(published={"date-parts": [[2027, 1, 10]]}), "nature", NOW))

    def test_science_issn_source(self):
        x = science.normalize(item(**{"container-title": ["Science"]}), "science", NOW)
        self.assertEqual(x["journal"], "Science")

    def test_deduplicate_do_is_without_losing_summary(self):
        first = {"doi": "10.1126/science.abc123", "source": "science", "published_at": "2026-11-20", "summary": ""}
        second = {**first, "summary": "An available abstract"}
        result = science.merge([second], [first])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["summary"], "An available abstract")

    def test_reject_malicious_or_missing_date(self):
        self.assertEqual(science.date_string({"date-parts": []}, NOW), "")
        self.assertEqual(science.tidy('<script>alert(1)</script><b>ABC</b>'), 'alert(1) ABC')


if __name__ == "__main__":
    unittest.main()
