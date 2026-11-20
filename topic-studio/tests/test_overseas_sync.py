import importlib.util
import sys
from datetime import datetime,timezone
from pathlib import Path
import unittest
SCRIPT=Path(__file__).resolve().parents[1]/"scripts"/"sync_overseas.py"
sys.path.insert(0,str(SCRIPT.parent))
spec=importlib.util.spec_from_file_location("sync_overseas",SCRIPT)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=datetime(2026,11,20,7,tzinfo=timezone.utc)
ATOM=b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>AI tooling explained</title><link href="https://example.org/post" rel="alternate"/><published>2026-11-20T01:00:00Z</published><summary>Original technical analysis</summary></entry></feed>'
class OverseasTests(unittest.TestCase):
 def test_feed_provenance_and_no_false_xnews(self):
  s=m.compile_snapshot(fetch=lambda u:ATOM,now=NOW)
  self.assertEqual(s["count"],1)
  self.assertEqual(len(s["sources"]),3)
  self.assertEqual(s["articles"][0]["source_kind"],"independent_original")
  self.assertNotIn("xnews_url",s["articles"][0])
 def test_source_isolation(self):
  def fetch(u):
   if "github" in u:raise ValueError("temporary outage")
   return ATOM
  s=m.compile_snapshot(fetch=fetch,now=NOW)
  self.assertEqual(sum(x["status"]=="error" for x in s["sources"]),1)
 def test_all_sources_failed(self):
  with self.assertRaises(RuntimeError):
   m.compile_snapshot(fetch=lambda u:(_ for _ in ()).throw(ValueError("down")),now=NOW)
if __name__=="__main__":unittest.main()
