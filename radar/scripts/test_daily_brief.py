import json
import unittest
from pathlib import Path

class DailyBriefContractTests(unittest.TestCase):
    def test_latest_data_has_enough_source_stories(self):
        data=json.loads(Path("radar/data/latest.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(data.get("news", [])), 5)

    def test_china_ai_news_contract_and_provenance(self):
        data=json.loads(Path("radar/data/latest.json").read_text(encoding="utf-8"))
        stories=data.get("china_ai_news", [])
        self.assertIsInstance(stories, list)
        self.assertGreaterEqual(data.get("china_sources_total", 0), 1)
        seen=set()
        for story in stories:
            self.assertTrue(story.get("url", "").startswith("https://"))
            self.assertTrue(story.get("title"))
            self.assertTrue(story.get("source"))
            self.assertTrue(story.get("category"))
            self.assertTrue(story.get("published"))
            self.assertEqual(story.get("region"), "China")
            self.assertNotIn(story["url"], seen)
            seen.add(story["url"])

    def test_top5_is_source_backed_when_present(self):
        data=json.loads(Path("radar/data/latest.json").read_text(encoding="utf-8"))
        urls={x.get("url") for x in data.get("news", [])}
        top5=data.get("top5", [])
        self.assertLessEqual(len(top5), 5)
        seen=set()
        for story in top5:
            self.assertIn(story.get("source_url"), urls)
            self.assertNotIn(story.get("source_url"), seen)
            seen.add(story.get("source_url"))
            scores=story.get("scores", {})
            if scores:
                for key in ("innovation","practicality","feasibility","impact","opportunity"):
                    self.assertGreaterEqual(int(scores[key]), 1)
                    self.assertLessEqual(int(scores[key]), 10)

if __name__ == "__main__":
    unittest.main()
