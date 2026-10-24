import datetime as dt
import json
import unittest
from pathlib import Path
from unittest.mock import patch
from radar.scripts.build_daily import CHINA_NEWS_MIN, rank_diverse_china_items, verify_skill_candidate

class DailyBriefContractTests(unittest.TestCase):

    def test_china_near_duplicate_headlines_are_collapsed(self):
        candidates = [
            {"title": "Kimi K3.1 Pro上线 WorkBuddy", "url": "https://example.com/a", "published": "2026-10-25T01:00:00+00:00", "source": "A"},
            {"title": "Kimi K3.1 Pro接入 WorkBuddy", "url": "https://example.com/b", "published": "2026-10-25T00:00:00+00:00", "source": "B"},
            {"title": "MiniMax发布新的AI推理模型", "url": "https://example.com/c", "published": "2026-10-24T23:00:00+00:00", "source": "C"},
        ]
        ranked = rank_diverse_china_items(candidates)
        kimi = [item for item in ranked if "Kimi" in item["title"]]
        self.assertEqual(len(kimi), 1)

    def test_featured_skill_requires_live_license_and_readme(self):
        metadata = {
            "full_name": "example/verified-skill",
            "default_branch": "main",
            "html_url": "https://github.com/example/verified-skill",
            "description": "A verified browser automation skill",
            "stargazers_count": 25,
            "updated_at": "2026-10-22T12:00:00Z",
            "license": {"spdx_id": "MIT", "name": "MIT License"},
            "archived": False,
            "fork": False,
        }
        readme = b"# Verified Skill\n\nInstall the agent skill by copying skills/browser/SKILL.md into your agent's skills directory.\n" + b"Details. " * 30
        candidate = {"name": "example/verified-skill", "url": metadata["html_url"], "description": "candidate"}
        with patch("radar.scripts.build_daily.http_get", side_effect=[json.dumps(metadata).encode(), readme, json.dumps({"tree":[{"path":"skills/browser/SKILL.md"}]}).encode()]) as mocked:
            result = verify_skill_candidate(candidate)
        self.assertIsNotNone(result)
        self.assertEqual(result["license"], "MIT")
        self.assertEqual(result["license_name"], "MIT License")
        self.assertEqual(result["name"], "example/verified-skill")
        self.assertEqual(mocked.call_count, 3)

    def test_featured_skill_rejects_repository_without_detected_license(self):
        metadata = {
            "full_name": "example/unlicensed-skill",
            "html_url": "https://github.com/example/unlicensed-skill",
            "description": "License metadata absent",
            "license": None,
            "archived": False,
            "fork": False,
        }
        with patch("radar.scripts.build_daily.http_get", return_value=json.dumps(metadata).encode()) as mocked:
            result = verify_skill_candidate({"name": "example/unlicensed-skill"})
        self.assertIsNone(result)
        mocked.assert_called_once()

    def test_featured_skill_rejects_archived_or_forked_repository(self):
        for flag, value in (("archived", True), ("fork", True)):
            metadata = {
                "full_name": "example/unusable-skill",
                "html_url": "https://github.com/example/unusable-skill",
                "description": "Must not be featured",
                "license": {"spdx_id": "MIT", "name": "MIT License"},
                "archived": flag == "archived" and value,
                "fork": flag == "fork" and value,
            }
            with self.subTest(flag=flag):
                with patch("radar.scripts.build_daily.http_get", return_value=json.dumps(metadata).encode()) as mocked:
                    result = verify_skill_candidate({"name": "example/unusable-skill"})
                self.assertIsNone(result)
                mocked.assert_called_once()

    def test_featured_skill_rejects_missing_readme(self):
        metadata = {
            "full_name": "example/no-readme-skill",
            "html_url": "https://github.com/example/no-readme-skill",
            "description": "No readable README",
            "license": {"spdx_id": "MIT", "name": "MIT License"},
            "archived": False,
            "fork": False,
        }
        with patch("radar.scripts.build_daily.http_get", side_effect=[json.dumps(metadata).encode(), OSError("README unavailable")]):
            result = verify_skill_candidate({"name": "example/no-readme-skill"})
        self.assertIsNone(result)

    def test_latest_data_has_enough_source_stories(self):
        data=json.loads(Path("radar/data/latest.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(data.get("news", [])), 5)

    def test_china_ai_news_contract_and_provenance(self):
        data=json.loads(Path("radar/data/latest.json").read_text(encoding="utf-8"))
        stories=data.get("china_ai_news", [])
        self.assertIsInstance(stories, list)
        self.assertGreaterEqual(data.get("china_sources_total", 0), 1)
        self.assertGreaterEqual(len(stories), CHINA_NEWS_MIN, "The China AI module must publish at least six source-backed stories")
        now = dt.datetime.now(dt.timezone.utc)
        cutoff = now - dt.timedelta(days=7)
        fresh_count = 0
        seen=set()
        for story in stories:
            self.assertTrue(story.get("url", "").startswith("https://"))
            self.assertTrue(story.get("title"))
            self.assertTrue(story.get("source"))
            self.assertTrue(story.get("category"))
            self.assertTrue(story.get("published"))
            published = dt.datetime.fromisoformat(story["published"].replace("Z", "+00:00"))
            if published.tzinfo is None:
                published = published.replace(tzinfo=dt.timezone.utc)
            self.assertGreaterEqual(published, cutoff, f"China AI story is older than seven days: {story.get('title')}")
            self.assertLessEqual(published, now + dt.timedelta(hours=6))
            fresh_count += 1
            self.assertEqual(story.get("region"), "China")
            self.assertNotIn(story["url"], seen)
            seen.add(story["url"])
        self.assertGreaterEqual(fresh_count, CHINA_NEWS_MIN)

    def test_china_news_ranking_uses_multiple_publishers_before_relaxing_caps(self):
        base = dt.datetime.now(dt.timezone.utc)
        candidates = []
        publishers = [
            ("量子位", "qbitai.com", 4),
            ("36氪", "36kr.com", 3),
            ("雷峰网", "leiphone.com", 3),
            ("极客公园", "geekpark.net", 2),
        ]
        index = 0
        for source, domain, count in publishers:
            for _ in range(count):
                stamp = (base - dt.timedelta(minutes=index)).isoformat()
                candidates.append({
                    "title": f"中国 AI 产业新闻样例 {index}",
                    "url": f"https://{domain}/news/{index}",
                    "source": source,
                    "published": stamp,
                })
                index += 1
        selected = rank_diverse_china_items(candidates)
        self.assertGreaterEqual(len(selected), CHINA_NEWS_MIN)
        self.assertLessEqual(len(selected), 10)
        per_domain = {}
        for story in selected:
            domain = story["url"].split("/")[2]
            per_domain[domain] = per_domain.get(domain, 0) + 1
        self.assertLessEqual(max(per_domain.values()), 2, "The initial source mix should cap each publisher at two stories")

    def test_china_news_ranking_deduplicates_identical_titles_across_sources(self):
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        candidates = [
            {"title": "同一条中国 AI 新闻", "url": "https://qbitai.com/news/1", "source": "量子位", "published": now},
            {"title": "同一条中国 AI 新闻", "url": "https://36kr.com/news/2", "source": "36氪", "published": now},
            {"title": "另一条中国 AI 新闻", "url": "https://36kr.com/news/3", "source": "36氪", "published": now},
        ]
        self.assertEqual(len(rank_diverse_china_items(candidates)), 2)

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
