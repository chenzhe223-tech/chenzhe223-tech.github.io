"""China coverage and five-dimension ranking: heuristics NEVER equal engagement."""
import importlib.util
from datetime import datetime,timezone,timedelta
from pathlib import Path
import sys,unittest
SCRIPTS=Path(__file__).resolve().parents[1]/"scripts"
sys.path.insert(0,str(SCRIPTS))
import finance_rank as rank
spec=importlib.util.spec_from_file_location("finance_sync_extended",SCRIPTS/"sync_finance.py")
source=importlib.util.module_from_spec(spec);spec.loader.exec_module(source)
NOW=datetime(2026,11,20,6,tzinfo=timezone.utc)
CN_RSS=b'<rss><channel><item><title>\xe4\xb8\xad\xe5\x9b\xbd\xe5\x85\xac\xe5\x8f\xb8\xe5\x8f\x91\xe5\xb8\x832026\xe5\xb9\xb4\xe4\xb8\x89\xe5\xad\xa3\xe5\xba\xa6\xe8\xb4\xa2\xe6\x8a\xa5</title><link>https://36kr.com/p/1234</link><pubDate>Fri, 20 Nov 2026 04:00:00 GMT</pubDate><description>Companies reported more news.</description></item></channel></rss>'
GLOBAL_RSS=b'<rss><channel><item><title>Federal report on household finances</title><link>https://example.com/report</link><pubDate>Fri, 20 Nov 2026 05:00:00 GMT</pubDate><description>Financial disclosures show changing policy.</description></item></channel></rss>'
class ChinaFinanceTests(unittest.TestCase):
 def test_source_coverage_and_scope(self):
  names=[s[0] for s in source.SOURCES]
  self.assertTrue(any("36氪" in n for n in names))
  self.assertTrue(any("中国日报" in n for n in names))
  self.assertTrue(any("南华早报" in n for n in names))
  rows=source.parse_feed(CN_RSS,("36氪","https://36kr.com/feed-newsflash","中国商业","media_report","中国"),NOW)
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]["region"],"中国")
  self.assertEqual(rows[0]["source_type"],"media_report")
  self.assertEqual(rows[0]["verification"],"media_report_metadata_not_independently_verified")
  self.assertEqual(rank.region_for("China exports climb","",None)[0],"中国")
  self.assertEqual(rank.region_for("EU monetary policy","",None)[0],"全球")
 def test_five_distinct_and_bounded_dimensions(self):
  r=source.parse_feed(CN_RSS,("36氪","https://36kr.com/feed-newsflash","中国商业","media_report","中国"),NOW)[0]
  value=rank.score(r,NOW)
  self.assertEqual(sum(rank.WEIGHTS.values()),100)
  self.assertEqual(set(rank.WEIGHTS),{"timeliness","readability","value","heat","appeal"})
  for k in rank.WEIGHTS:self.assertGreaterEqual(value[k],0);self.assertLessEqual(value[k],100)
  self.assertGreaterEqual(value["total"],0);self.assertLessEqual(value["total"],100)
  self.assertEqual(value["basis"],"editorial_heuristic_not_audience_metrics")
  self.assertNotIn("views",r);self.assertNotIn("shares",r)
 def test_freshness_changes_ranking(self):
  r=source.parse_feed(CN_RSS,("36氪","https://36kr.com/feed-newsflash","中国商业","media_report","中国"),NOW)[0]
  prior=dict(r,published_at=(NOW-timedelta(days=10)).isoformat(),id="fin-stale",url="https://36kr.com/p/old")
  self.assertGreater(rank.score(r,NOW)["timeliness"],rank.score(prior,NOW)["timeliness"])
  out=rank.sort_and_rank([prior,r],NOW)
  self.assertEqual(out[0]["priority_rank"],1)
  self.assertEqual([v["priority_rank"] for v in out],[1,2])
 def test_merge_preserves_china_and_is_source_attributed(self):
  def fetch(url):
   if "36kr.com" in url:return CN_RSS
   if "chinadaily" in url or "scmp" in url:raise RuntimeError("simulated source outage")
   return GLOBAL_RSS
  snap=source.compile_snapshot(fetch,now=NOW)
  self.assertEqual(snap["schema_version"],2)
  self.assertGreater(snap["china_count"],0)
  self.assertGreater(snap["count"],snap["china_count"])
  self.assertEqual(snap["rank_weights"],rank.WEIGHTS)
  self.assertEqual(snap["rank_method"],rank.VERSION)
  self.assertTrue(all("score" in a and "region" in a for a in snap["articles"]))
  self.assertFalse(any("views" in a or "share_count" in a for a in snap["articles"]))
  self.assertEqual(len([a for a in snap["articles"] if a["region"]=="中国"]),snap["china_count"])
 def test_existing_global_feed_still_supported(self):
  item=source.parse_feed(GLOBAL_RSS,source.SOURCES[0],NOW)[0]
  self.assertEqual(item["region"],"全球")
if __name__=="__main__":unittest.main()
