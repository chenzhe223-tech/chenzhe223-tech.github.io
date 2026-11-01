import unittest
from PIL import Image, ImageDraw

from radar.scripts.generate_social_pack import (
    classify_topic, make_copy, render_topic_image, story_title, wrap_lines
)


class SocialPackTests(unittest.TestCase):
    def test_topic_classifier_uses_story_context(self):
        self.assertEqual(classify_topic({"title_zh": "DeepSeek Router-Worker 智能体"}, 0), "agent")
        self.assertEqual(classify_topic({"title_zh": "微信支付智慧经营机器人首次进店"}, 1), "retail")
        self.assertEqual(classify_topic({"title_zh": "ChatGPT 与 Codex 共享用量"}, 2), "usage")

    def test_wrapped_text_respects_width(self):
        image = Image.new("RGB", (400, 120), "white")
        draw = ImageDraw.Draw(image)
        from radar.scripts.generate_poster import font
        lines = wrap_lines(draw, "这是一段用于检查中文标题换行是否超过可用宽度的测试文本", font(20, True), 140, 3)
        self.assertLessEqual(len(lines), 3)
        for line in lines:
            self.assertLessEqual(draw.textlength(line, font=font(20, True)), 141)

    def test_topic_image_is_independent_900x1200(self):
        story = {
            "title_zh": "DeepSeek 发布 Router-Worker 智能体原型",
            "summary_zh": "该项目把请求分发给隔离的 Worker 会话。",
            "why_zh": "它提供了可研究的多智能体任务编排样例。",
            "source": "GitHub",
            "url": "https://github.com/deepseek-ai/dsh-superagent-prototype",
            "published": "2026-11-01T00:00:00Z"
        }
        image = render_topic_image(story, 0, "2026-11-02")
        self.assertEqual(image.size, (900, 1200))
        self.assertEqual(image.mode, "RGB")

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
        self.assertIn("正式简报", moments if "正式简报" in moments else wechat)


if __name__ == "__main__":
    unittest.main()
