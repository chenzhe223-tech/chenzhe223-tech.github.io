"""Offline contract test: no network calls, no private data, no invented metrics."""
import importlib.util
from datetime import datetime, timezone, timedelta
import pathlib
import tempfile
import unittest
import json

SCRIPT=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"sync_hotspots.py"
spec=importlib.util.spec_from_file_location("davylab_sync_hotspots",SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class HotspotSyncTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime(2026,11,13,9,0,tzinfo=timezone.utc)
        self.recent=int((self.now-timedelta(hours=7)).timestamp())
    def test_public_links_only(self):
        for url in ("http://127.0.0.1/secret","file:///etc/passwd","https://user:pass@example.com",
                    "http://localhost/","https://10.0.0.1","javascript:alert(1)","http://169.254.169.254/latest"):
            self.assertEqual(mod.safe_url(url),"")
        self.assertEqual(mod.safe_url("https://github.com/open/ai"),"https://github.com/open/ai")
    def test_hn_is_metadata_with_real_counts(self):
        row={"objectID":"12345","title":"Show HN: an AI agent research tool","url":"https://example.com/article",
             "created_at_i":self.recent,"points":59,"num_comments":24}
        data=mod.build_hn([row,row,{"objectID":"x","title":"bad","created_at_i":self.recent}],self.now)
        self.assertEqual(len(data),2)  # Deduplication happens at snapshot stage
        x=data[0]
        self.assertEqual(x["hn_points"],59)
        self.assertEqual(x["hn_comments"],24)
        self.assertIsNone(x["github_stars"])
        self.assertTrue(x["discussion_url"].startswith("https://news.ycombinator.com/item"))
        self.assertNotIn("story_text",x)
    def test_github_cumulative_stars_not_growth(self):
        x=mod.build_github([{"id":123,"full_name":"open/repo","html_url":"https://github.com/open/repo",
            "description":"Open AI model for research","created_at":"2026-11-13T02:00:00Z","stargazers_count":189},
            {"id":7,"full_name":"bad/local","html_url":"http://localhost/secret",
            "created_at":"2026-11-13T02:00:00Z","stargazers_count":12}],self.now)
        self.assertEqual(len(x),1)
        self.assertEqual(x[0]["github_stars"],189)
        self.assertIsNone(x[0]["hn_points"])
    def test_age_and_future_filter(self):
        self.assertEqual(mod.valid_date("2026-09-01T00:00:00Z",self.now),"")
        self.assertEqual(mod.valid_date("2026-11-15T00:00:00Z",self.now),"")
        self.assertTrue(mod.valid_date("2026-11-12T00:00:00Z",self.now))
    def test_snapshot_dedup_and_no_private_data(self):
        h={"objectID":"12345","title":"AI agent learning story","created_at_i":self.recent,
           "url":"https://example.com/agent","points":8,"num_comments":3,"author":"anon",
           "story_text":"Private or copyrighted full text"}
        data=mod.build_snapshot([[h],[h]],[],self.now)
        self.assertEqual(data["count"],1)
        self.assertEqual(data["items"][0]["id"],"hn-12345")
        self.assertNotIn("Private or copyrighted",json.dumps(data))
        self.assertNotIn("author",data["items"][0])
        self.assertIn("cumulative",data["engagement_note"])
    def test_invalid_count_is_unknown_not_zero(self):
        self.assertIsNone(mod.as_count(-1))
        self.assertIsNone(mod.as_count("fake"))
        self.assertIsNone(mod.as_count(True))
        self.assertEqual(mod.as_count(0),0)

if __name__=="__main__":
    unittest.main()
