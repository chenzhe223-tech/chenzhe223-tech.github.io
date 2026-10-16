import json
import unittest
from pathlib import Path

class DailyBriefContractTests(unittest.TestCase):
    def test_latest_data_has_enough_source_stories(self):
        data=json.loads(Path("radar/data/latest.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(data.get("news", [])), 5)

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
