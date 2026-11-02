import unittest
from PIL import Image, ImageDraw

from radar.scripts.generate_social_pack import (
    TEXT_BOUNDS, classify_topic, make_copy, render_skill_image, render_topic_image,
    select_topic_stories, social_layout_regions, story_title, wrap_lines, write_text
)
from radar.scripts.verify_social_pack import verify_manifest_matches_report, verify_image_layout


class SocialPackTests(unittest.TestCase):
    def test_social_manifest_must_match_exact_source_report(self):
        report = {
            "generated_at": "2026-11-02T09:30:00+08:00",
            "top5": [
                {"title_zh": f"新闻{i}", "source_url": f"https://example.com/{i}"}
                for i in range(5)
            ],
            "skills": [{
                "name": "demo/skill",
                "url": "https://github.com/demo/skill",
                "compatibility_status": "Claude Code only",
                "actual_skill_file_count": 74,
            }],
        }
        manifest = {
            "source_report_generated_at": report["generated_at"],
            "source_report_sha256": "abc123",
            "story_titles": [f"新闻{i}" for i in range(5)],
            "story_urls": [f"https://example.com/{i}" for i in range(5)],
            "skill": {
                "name": "demo/skill",
                "url": "https://github.com/demo/skill",
                "compatibility_status": "Claude Code only",
                "actual_skill_file_count": 74,
            },
        }
        titles, urls = verify_manifest_matches_report(report, manifest, "abc123")
        self.assertEqual(titles, manifest["story_titles"])
        self.assertEqual(urls, manifest["story_urls"])
        manifest["source_report_generated_at"] = "2026-11-02T08:38:00+08:00"
        with self.assertRaisesRegex(RuntimeError, "current formal report timestamp"):
            verify_manifest_matches_report(report, manifest, "abc123")

    def test_topic_classifier_uses_story_context(self):
        self.assertEqual(classify_topic({"title_zh": "DeepSeek Router-Worker 智能体"}, 0), "agent")
        self.assertEqual(classify_topic({"title_zh": "微信支付智慧经营机器人首次进店"}, 1), "retail")
        self.assertEqual(classify_topic({"title_zh": "ChatGPT 与 Codex 共享用量"}, 2), "usage")
        self.assertEqual(classify_topic({"title_zh": "中国人形机器人具身智能产业"}, 3), "robotics")
        self.assertEqual(classify_topic({"title_zh": "Meta Muse 智能购物代理"}, 4), "commerce")
        self.assertEqual(classify_topic({"title_zh": "Gemini 4 Carbon 网络安全漏洞检测"}, 0), "cybersecurity")

    def test_wrapped_text_respects_width(self):
        image = Image.new("RGB", (400, 120), "white")
        draw = ImageDraw.Draw(image)
        from radar.scripts.generate_poster import font
        lines = wrap_lines(draw, "这是一段用于检查中文标题换行是否超过可用宽度的测试文本", font(20, True), 140, 3)
        self.assertLessEqual(len(lines), 3)
        for line in lines:
            self.assertLessEqual(draw.textlength(line, font=font(20, True)), 141)

    def test_social_text_bounds_fail_closed_outside_canvas(self):
        image = Image.new("RGB", (900, 1200), "white")
        draw = ImageDraw.Draw(image)
        from radar.scripts.generate_poster import font as poster_font
        with self.assertRaisesRegex(ValueError, "Social text bounds overflow"):
            write_text(draw, "越界测试", (850, 20), poster_font(16, True), "black", 100)

    def test_social_layout_regions_cover_all_three_image_types(self):
        self.assertIn("right_qr_panel", social_layout_regions("main_poster"))
        self.assertIn("source_footer", social_layout_regions("topic_illustration"))
        self.assertIn("skill_content", social_layout_regions("skill_feature"))

    def test_social_image_layout_rejects_truncated_text(self):
        entry = {
            "filename": "01-main-poster.png",
            "image_type": "main_poster",
            "layout_regions": social_layout_regions("main_poster"),
            "text_bounds": [{
                "x": 40, "y": 40, "width": 300, "height": 30,
                "actual_width": 290, "truncated": True, "overflow": False
            }]
        }
        with self.assertRaisesRegex(RuntimeError, "contains truncated text"):
            verify_image_layout(entry)

    def test_topic_selection_preserves_all_five_top5_stories_in_order(self):
        top = [
            {"source_section": "global_news", "url": "https://global.example/1"},
            {"source_section": "global_news", "url": "https://global.example/2"},
            {"source_section": "unclassified", "url": "https://other.example/1"},
            {"source_section": "global_news", "url": "https://global.example/3"},
            {"url": "https://other.example/2"},
        ]
        selected = select_topic_stories(top)
        self.assertEqual([category for category, _ in selected],
                         ["global_news", "global_news", "unclassified", "global_news", "unclassified"])
        self.assertEqual([story["url"] for _, story in selected],
                         [story["url"] for story in top])

    def test_topic_selection_does_not_invent_missing_categories(self):
        top = [{"source_section": "global_news", "url": f"https://global.example/{i}"} for i in range(5)]
        selected = select_topic_stories(top)
        self.assertEqual(len(selected), 5)
        self.assertTrue(all(category == "global_news" for category, _ in selected))
        self.assertFalse(any(category == "china_ai_news" for category, _ in selected))

    def test_topic_image_is_independent_900x1200(self):
        story = {
            "title_zh": "DeepSeek 发布 Router-Worker 智能体原型",
            "summary_zh": "该项目把请求分发给隔离的 Worker 会话。",
            "why_zh": "它提供了可研究的多智能体任务编排样例。",
            "source": "GitHub",
            "url": "https://github.com/deepseek-ai/dsh-superagent-prototype",
            "published": "2026-11-01T00:00:00Z"
        }
        image = render_topic_image(story, 0, "2026-11-02", "global_news")
        self.assertEqual(image.size, (900, 1200))
        self.assertEqual(image.mode, "RGB")

    def test_skill_image_is_independent_900x1200(self):
        skill = {
            "name": "demo/planning-skill",
            "description_zh": "把长任务拆成可追踪的阶段，并通过文件保存进度。",
            "url": "https://github.com/demo/planning-skill",
            "official_website": "https://github.com/demo/planning-skill",
            "license_name": "MIT License",
        }
        image = render_skill_image(skill, "2026-11-02")
        self.assertEqual(image.size, (900, 1200))
        self.assertEqual(image.mode, "RGB")

    def test_copy_preserves_low_confidence_caveat_and_skill_compatibility(self):
        stories = [
            {
                "title_zh": f"核验新闻{i}",
                "summary_zh": "据单一来源披露，相关评分尚无独立评测。",
                "what_zh": "据单一来源披露，相关评分尚无独立评测。",
                "why_zh": "这提醒读者区分项目方披露与独立验证。",
                "source": "来源",
                "url": f"https://example.com/{i}",
                "confidence": "low" if i == 0 else "medium",
            }
            for i in range(5)
        ]
        report = {"editorial": {"trend_zh": "先核验，再判断。", "core_zh": "这是 DAVYLAB 分析。"}}
        skill = {
            "name": "demo/skill",
            "description_zh": "一个实用技能。",
            "url": "https://github.com/demo/skill",
            "official_website": "https://github.com/demo/skill",
            "license_name": "MIT",
            "compatibility_status": "Claude Code 专用；Codex/WorkBuddy 需适配；未实测安装",
        }
        wechat, _ = make_copy(report, stories, skill, "2026-11-02")
        self.assertIn("尚无独立评测", wechat)
        self.assertIn(skill["compatibility_status"], wechat)
        self.assertIn("MIT", wechat)
        self.assertIn("💡 DAVYLAB 观察", wechat)
        self.assertIn("DAVYLAB 基于本期公开来源的综合判断", wechat)

    def test_copy_contains_required_structure_and_all_five_stories(self):
        stories = [
            {"title_zh": f"测试新闻{i}", "summary_zh": "事实摘要。", "why_zh": "实际意义。", "source": "来源", "url": f"https://example.com/{i}"}
            for i in range(5)
        ]
        report = {"editorial": {"trend_zh": "智能体走进真实工作。", "core_zh": "这是 DAVYLAB 分析。"}}
        skill = {"name": "demo/skill", "description_zh": "一个实用技能。", "url": "https://github.com/demo/skill", "license_name": "MIT License"}
        wechat, moments = make_copy(report, stories, skill, "2026-11-02")
        for required in ("2026-11-02", "💡 DAVYLAB 观察", "❓", "作者：DAVYLAB｜让可能发生", "demo/skill"):
            self.assertIn(required, wechat)
        for story in stories:
            self.assertIn(story_title(story), wechat)
        self.assertIn("https://chenzhe223-tech.github.io/radar/daily/", wechat)


if __name__ == "__main__":
    unittest.main()
