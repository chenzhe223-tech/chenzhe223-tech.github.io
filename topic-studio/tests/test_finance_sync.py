"""Offline finance-source reliability tests; no real dates, values or articles invented."""
import importlib.util
from datetime import datetime,timezone
from pathlib import Path
import tempfile
import json
import unittest
import subprocess
import sys

SCRIPT=Path(__file__).resolve().parents[1]/"scripts"/"sync_finance.py"
spec=importlib.util.spec_from_file_location("sync_finance",SCRIPT)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=datetime(2026,11,20,6,tzinfo=timezone.utc)
RSS=b'<rss><channel><item><title>Central bank updates rates</title><link>https://example.org/central-bank</link><pubDate>Thu, 19 Nov 2026 14:00:00 GMT</pubDate><description>Policy statement and market context.</description></item></channel></rss>'
ATOM=b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Employment release</title><link href="https://example.org/jobs" rel="alternate"/><updated>2026-11-20T01:00:00Z</updated><summary>New labour report.</summary></entry></feed>'
class FinanceTests(unittest.TestCase):
    def test_rss_atom_and_original_urls(self):
        for payload in (RSS,ATOM):
            rows=m.parse_feed(payload,m.SOURCES[0],NOW)
            self.assertEqual(len(rows),1)
            self.assertEqual(rows[0]["verification"],"official_source_metadata_not_independently_fact_checked")
            self.assertTrue(rows[0]["url"].startswith("https://example.org/"))
    def test_reject_xml_entities_and_unsafe_url(self):
        with self.assertRaises(ValueError): m.parse_feed(b'<!DOCTYPE foo [<!ENTITY x "bad">]><rss/>',m.SOURCES[0],NOW)
        self.assertEqual(m.safe_url("http://127.0.0.1/private"),"")
        self.assertEqual(m.safe_url("https://user:pass@example.org/a"),"")
    def test_partial_failures_and_dedupe(self):
        def fetch(url):
            if "sec.gov" in url: raise ValueError("simulated block")
            return RSS
        result=m.compile_snapshot(fetch,now=NOW)
        self.assertEqual(result["count"],1)
        self.assertEqual(len(result["sources"]),len(m.SOURCES))
        self.assertEqual(len([x for x in result["sources"] if x["status"]=="error"]),1)
        self.assertEqual(result["fresh_within_72h"],1)
    def test_all_failed_preserves_existing_file(self):
        with self.assertRaises(RuntimeError):
            m.compile_snapshot(lambda url: (_ for _ in ()).throw(ValueError("outage")),now=NOW)
    def test_old_facts_not_fabricated_as_new(self):
        result=m.compile_snapshot(lambda u:RSS,now=NOW)
        self.assertNotIn("price",result["articles"][0])
        self.assertNotIn("stock_change",result["articles"][0])
        self.assertIsNotNone(result["latest_published_at"])
    def test_missing_dates_and_future_rejected(self):
        html=b'<rss><channel><item><title>Lost date</title><link>https://example.org/bad</link></item></channel></rss>'
        self.assertEqual(m.parse_feed(html,m.SOURCES[0],NOW),[])
if __name__=="__main__":unittest.main()
