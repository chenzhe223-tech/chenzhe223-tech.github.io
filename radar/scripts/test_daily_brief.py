import datetime as dt
import json
import unittest
from pathlib import Path
from unittest.mock import patch
from radar.scripts.build_daily import CHINA_NEWS_MIN, rank_diverse_china_items, verify_skill_candidate
from radar.scripts.run_horizon import build_selection_pool

class DailyBriefContractTests(unittest.TestCase):

    def test_top5_selection_pool_combines_global_and_china_ai_sources(self):
        global_news = [
            {"title": "Global story A", "url": "https://example.com/a", "source": "Global A"},
            {"title": "Global story B", "url": "https://example.com/b", "source": "Global B"},
        ]
        china_news = [
            {"title": "China story C", "url": "https://example.com/c", "source": "China C"},
            {"title": "China story D", "url": "https://example.com/d", "source": "China D"},
            {"title": "Duplicate A", "url": "https://example.com/a", "source": "Duplicate"},
            {"title": "China story E", "url": "https://example.com/e", "source": "China E"},
        ]
        pool = build_selection_pool(global_news, china_news)
        self.assertEqual(len(pool), 5)
        self.assertEqual([item["selection_section"] for item in pool].count("global_news"), 2)
        self.assertEqual([item["selection_section"] for item in pool].count("china_ai_news"), 3)
        self.assertEqual(len({item["url"] for item in pool}), 5)

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
        pool = list(data.get("news", [])) + list(data.get("china_ai_news", []))
        unique_urls = {x.get("url") for x in pool if isinstance(x, dict) and x.get("url")}
        self.assertGreaterEqual(len(unique_urls), 5, "The five-story shortlist must have at least five unique source-backed candidates across both news streams.")

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
            self.assertTrue(story.get("image_url", "").startswith("https://"), f"China AI story image missing: {story.get('title')}")
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
                topic = [
                    "智能客服部署案例", "视觉推理模型评测", "医疗影像辅助诊断", "企业知识库检索",
                    "具身机器人控制系统", "AI 芯片互联架构", "多模态视频生成工具", "开源代码审查助手",
                    "工业质检视觉模型", "端侧语音识别方案", "智能驾驶仿真平台", "科学文献分析代理",
                ][index]
                candidates.append({
                    "title": f"{source}发布/报道：{topic}方案 {index}",
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

    def test_china_news_ranking_can_buffer_two_extra_candidates_without_losing_diversity(self):
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
                    "title": f"{source}报道：AI 新闻主题 {index}",
                    "url": f"https://{domain}/news/buffer-{index}",
                    "source": source,
                    "published": stamp,
                })
                index += 1
        selected = rank_diverse_china_items(candidates, include_buffer=True)
        self.assertEqual(len(selected), 10)
        per_domain = {}
        for story in selected:
            domain = story["url"].split("/")[2]
            per_domain[domain] = per_domain.get(domain, 0) + 1
        self.assertLessEqual(max(per_domain.values()), 3)

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
        urls.update(x.get("url") for x in data.get("china_ai_news", []))
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
