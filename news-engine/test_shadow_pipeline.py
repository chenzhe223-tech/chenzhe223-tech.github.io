"""Full offline end-to-end shadow pipeline: never publishes or spends model tokens."""
import datetime as dt
import unittest

import article
import collector
import integration
import research
import studio

NOW = dt.datetime(2026, 11, 19, 9, tzinfo=dt.timezone.utc)
RSS = (b'<rss><channel><item><title>Example research project announces a new open source model</title>'
       b'<link>https://example.org/model</link>'
       b'<pubDate>Wed, 18 Nov 2026 13:00:00 GMT</pubDate></item></channel></rss>')
SOURCES = [{"name": "Independent sample", "url": "https://example.org/feed"}]


class ShadowPipelineTests(unittest.TestCase):
    def test_collector_to_research_to_evidence_to_editor_to_export(self):
        discovery, history = collector.collect(
            sources=SOURCES, http_get=lambda _: RSS, now=NOW)
        self.assertEqual(len(discovery["stories"]), 1)
        self.assertEqual(discovery["stories"][0]["verification_status"], "source_not_independently_verified")
        triage = research.research(discovery, now=NOW)
        self.assertEqual(len(triage["candidates"]), 1)
        candidate = triage["candidates"][0]
        self.assertEqual(candidate["verification_status"], "requires_primary_source_and_fact_check")
        self.assertEqual(candidate["source_urls"], ["https://example.org/model"])
        evidence = [{
            "claim": "The model announcement appeared on the cited official website.",
            "verified": True,
            "source_url": "https://example.org/model",
            "source_published_at": "2026-11-18T13:00:00+00:00",
            "checked_at": "2026-11-19T08:00:00+00:00",
        }]
        draft = article.build_draft(candidate, evidence)
        self.assertFalse(draft["publishable"])
        pack = studio.assemble(draft, [{
            "id": "source-doc", "kind": "document",
            "url": "https://example.org/model.pdf",
            "source_url": "https://example.org/model",
            "rights_status": "permission_granted",
            "alt": "Document source",
        }])
        rendered = studio.preview(pack)
        self.assertIn("未审核草稿", rendered)
        self.assertIn("https://example.org/model", rendered)
        self.assertEqual(pack["editorial_status"], "requires_human_review")
        export = integration.public_payload({
            **candidate, "publishable": False
        })
        self.assertFalse(export["publishable"])
        self.assertFalse(export["external_copy_allowed"])
        later, _ = collector.collect(
            sources=SOURCES, http_get=lambda _: RSS,
            now=NOW + dt.timedelta(days=1), history=history)
        self.assertEqual(len(later["stories"]), 0)

    def test_unverified_fact_never_enters_article(self):
        discovery, _ = collector.collect(sources=SOURCES, http_get=lambda _: RSS, now=NOW)
        candidate = research.research(discovery, NOW)["candidates"][0]
        draft = article.build_draft(candidate, [{
            "claim": "Fake profit claim",
            "verified": False,
            "source_url": "https://example.org/model",
            "source_published_at": "2026-11-18T13:00:00+00:00",
            "checked_at": "2026-11-19T08:00:00+00:00",
        }])
        self.assertEqual(draft["body"], "")
        self.assertFalse(draft["publishable"])


if __name__ == "__main__":
    unittest.main()
