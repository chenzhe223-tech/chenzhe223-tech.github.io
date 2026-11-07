import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from news_image_match import (
    _BingImageParser, candidate_relevance, derive_visual_search_queries,
    extract_image_candidates, is_generic_brand_asset, normalize_url, story_fallback_topic,
    build_illustration_prompt, firecrawl_enabled, THEME_PHOTOS, enforce_unique_story_images, _image_identity, MIN_IMAGE_RELEVANCE_SCORE, _thematic_fallback, _theme_backup_url, _theme_photo_url, IMAGE_MATCH_BUDGET_SECONDS, STORY_IMAGE_BUDGET_SECONDS,
)


class NewsImageMatchTests(unittest.TestCase):
    def test_friday_inventory_exhaustion_has_unused_technology_assets(self):
        import json
        root = Path(__file__).resolve().parents[2]
        used = set()
        for day in range(2, 7):
            doc = json.loads((root / f"radar/data/archive/2026-11-{day:02d}.json").read_text())
            for section in ("top5", "china_ai_news"):
                used.update(_image_identity(str(x.get("image_url") or "")) for x in doc.get(section, []))
        # A Saturday edition must have room for all 13 published cards, with no reuse.
        for index in range(13):
            result = _thematic_fallback({"title": "AI technology industry news"}, used)
            self.assertTrue(result["image_url"], f"inventory exhausted at card {index}")
            used.add(_image_identity(result["image_url"]))

    def test_image_matching_budgets_are_bounded(self):
        self.assertLessEqual(IMAGE_MATCH_BUDGET_SECONDS, 150)
        self.assertLessEqual(STORY_IMAGE_BUDGET_SECONDS, 10)

    def test_compute_fallback_pool_has_extra_server_rack_assets_for_chip_supply_stories(self):
        story = {"title_zh":"H200 芯片库存等待进口审批"}
        self.assertEqual(story_fallback_topic(story), "compute")
        self.assertIn("photo-1506399558188-acca6f8cbf41", THEME_PHOTOS["compute"])
        self.assertIn("photo-1698668975271-2ba9a323be6b", THEME_PHOTOS["compute"])
        self.assertGreaterEqual(len(set(THEME_PHOTOS["compute"])), 12)
        self.assertGreaterEqual(len(set(THEME_PHOTOS["robot"])), 7)
        self.assertGreaterEqual(len(set(THEME_PHOTOS["security"])), 6)

    def test_security_and_compute_topics_precede_generic_agent_keyword(self):
        self.assertEqual(
            story_fallback_topic({"title_zh":"GPT-6 Cyber 网络安全研究 Agent"}),
            "security",
        )
        self.assertEqual(
            story_fallback_topic({"title_zh":"Tencent Hy4 long-horizon agent model"}),
            "compute",
        )
        self.assertEqual(
            story_fallback_topic({"title_zh":"AI agent for browser automation"}),
            "product",
        )

    def test_security_fallback_uses_security_specific_assets(self):
        story = {"title_zh":"GPT-6 Cyber 网络安全研究"}
        result = _thematic_fallback(story, set())
        security_assets = {_theme_photo_url(pid) for pid in THEME_PHOTOS["security"]}
        self.assertEqual(story_fallback_topic(story), "security")
        self.assertIn(result["image_url"], security_assets)

    def test_robot_fallback_uses_robot_specific_assets_before_general_pool(self):
        story = {"title_zh":"ABB 工业机器人业务收购"}
        result = _thematic_fallback(story, set())
        robot_assets = {_theme_photo_url(pid) for pid in THEME_PHOTOS["robot"]}
        self.assertEqual(story_fallback_topic(story), "robot")
        self.assertIn(result["image_url"], robot_assets)

    def test_theme_backup_skips_images_already_used_this_week(self):
        story = {"title_zh":"AI smartphone product launch"}
        topic = story_fallback_topic(story)
        candidates = list(THEME_PHOTOS.get(topic, ())) + list(THEME_PHOTOS["general"])
        used = {_image_identity(_theme_photo_url(pid)) for pid in candidates[:4]}
        primary = _theme_photo_url(candidates[0])
        backup = _theme_backup_url(story, primary, used)
        self.assertTrue(backup)
        self.assertNotEqual(backup, primary)
        self.assertNotIn(_image_identity(backup), used)

    def test_theme_backup_fails_closed_when_all_weekly_assets_are_used(self):
        story = {"title_zh":"AI smartphone product launch"}
        topic = story_fallback_topic(story)
        candidates = list(THEME_PHOTOS.get(topic, ())) + list(THEME_PHOTOS["general"])
        used = {_image_identity(_theme_photo_url(pid)) for pid in candidates}
        self.assertEqual(_theme_backup_url(story, "", used), "")

    def test_thematic_fallback_does_not_make_network_requests(self):
        with patch("news_image_match.valid_image_url", side_effect=AssertionError("fallback must not call network")):
            result = _thematic_fallback({"title_zh": "AI 模型发布"}, set())
        self.assertTrue(result.get("image_url"))
        self.assertEqual(result.get("image_match_status"), "thematic_fallback")
        self.assertIn("主题配图", result.get("image_alt", ""))


    def test_duplicate_image_is_replaced_for_different_story_but_kept_for_crosslist(self):
        shared = "https://cdn.example.com/shared.jpg"
        unique = "https://cdn.example.com/unique.jpg"
        report = {
            "top5": [{"source_url": "https://example.com/story-a", "image_url": shared}],
            "china_ai_news": [
                {"url": "https://example.com/story-a", "image_url": shared},
                {"url": "https://example.com/story-b", "image_url": shared},
            ],
        }
        used = {_image_identity(shared)}
        with patch("news_image_match._thematic_fallback", return_value={"image_url": unique, "image_source": "thematic_fallback"}):
            enforce_unique_story_images(report, used)
        self.assertEqual(report["top5"][0]["image_url"], shared)
        self.assertEqual(report["china_ai_news"][0]["image_url"], shared)
        self.assertEqual(report["china_ai_news"][1]["image_url"], unique)

    def test_image_identity_normalizes_resized_variants(self):
        first = "https://coincentral.com/wp-content/uploads/2026/04/Deepseek-1-1200x800.jpg"
        second = "https://coincentral.com/wp-content/uploads/2026/04/Deepseek-1-2048x1365.jpg"
        self.assertEqual(_image_identity(first), _image_identity(second))

    def test_extracts_og_and_twitter_images_in_preferred_order(self):
        document = """
        <html><head>
        <meta name="twitter:image" content="/social.png">
        <meta property="og:image" content="https://cdn.example.com/disney-character-ai.jpg">
        </head></html>
        """
        found = extract_image_candidates(document, "https://example.com/story")
        self.assertEqual(found[0], "https://cdn.example.com/disney-character-ai.jpg")
        self.assertEqual(found[1], "https://example.com/social.png")

    def test_normalize_rejects_localhost_and_upgrades_http(self):
        self.assertEqual(normalize_url("http://images.example/a.jpg"), "https://images.example/a.jpg")
        self.assertEqual(normalize_url("https://localhost/a.jpg"), "")

    def test_rejects_publisher_logo_as_an_editorial_hero_image(self):
        self.assertTrue(is_generic_brand_asset("https://www.qbitai.com/wp-content/uploads/imgs/qbitai-logo-1.png"))
        self.assertTrue(is_generic_brand_asset("https://example.com/assets/site-icon.svg"))
        self.assertFalse(is_generic_brand_asset("https://example.com/news/ai-model-release.jpg"))

    def test_disney_candidate_passes_for_disney_character_ai_story(self):
        ok, score = candidate_relevance("Disney agrees to hire majority of Character.AI workforce", "Disney Character.AI logo")
        self.assertTrue(ok)
        self.assertGreater(score, 0)

    def test_unrelated_phone_photo_is_rejected_for_disney_story(self):
        ok, _ = candidate_relevance("Disney agrees to hire majority of Character.AI workforce", "Modern iPhone mobile apps screen")
        self.assertFalse(ok)

    def test_story_specific_chinese_keywords_overlap(self):
        ok, _ = candidate_relevance("清华开源智能体操作系统", "清华智能体操作系统项目")
        self.assertTrue(ok)

    def test_horizon_analysis_expands_chinese_story_into_visual_search_terms(self):
        story = {"title_zh":"智谱新模型，懂法方面全球第一了","summary_zh":"智谱发布法律推理能力更强的 GLM 模型。","category":"模型与技术进展"}
        queries = derive_visual_search_queries(story)
        self.assertTrue(any("Zhipu" in q or "GLM" in q for q in queries))
        self.assertLessEqual(len(queries), 4)

    def test_context_fields_expand_visual_search(self):
        story = {"original_title":"How Itaú is building generative AI for its entire customer base",
                 "what_en":"The bank is adding AI services throughout customer support.",
                 "category_en":"Products & Adoption"}
        queries = derive_visual_search_queries(story)
        self.assertTrue(any("Itaú" in q or "Itau" in q for q in queries))

    def test_bing_image_parser_extracts_actual_image_and_landing_page(self):
        import json
        meta = {"murl":"https://cdn.example.com/character-ai.jpg","purl":"https://example.com/disney-character-ai",
                "t":"Disney Character.AI","desc":"Disney Character AI image"}
        encoded = json.dumps(meta).replace("&","&amp;").replace('"',"&quot;")
        parser = _BingImageParser()
        parser.feed('<a class="iusc" m="' + encoded + '"></a>')
        self.assertEqual(parser.results[0]["url"], "https://cdn.example.com/character-ai.jpg")
        self.assertEqual(parser.results[0]["page_url"], "https://example.com/disney-character-ai")

    def test_ai_story_context_maps_to_topic_fallback(self):
        self.assertEqual(story_fallback_topic({"title_en":"New AI robot agent automation release"}), "robot")
        self.assertEqual(story_fallback_topic({"title_zh":"银行企业客户金融服务"}), "business")
        self.assertEqual(story_fallback_topic({"title_zh":"Itaú 为全部客户构建生成式 AI 服务","original_title":"How Itaú is building generative AI for its customer base"}), "business")

    def test_rejects_private_hosts_and_nonstandard_ports(self):
        self.assertEqual(normalize_url("https://192.168.1.8/image.jpg"), "")
        self.assertEqual(normalize_url("https://10.0.0.12/image.jpg"), "")
        self.assertEqual(normalize_url("https://service.local/image.jpg"), "")
        self.assertEqual(normalize_url("https://example.com:8443/image.jpg"), "")
        self.assertEqual(normalize_url("https://user:password@example.com/image.jpg"), "")

    def test_illustration_prompt_is_story_specific_and_clear_about_fiction(self):
        prompt = build_illustration_prompt({
            "title_zh": "智谱发布新的 GLM 模型",
            "summary_zh": "模型提升了法律推理能力",
        })
        self.assertIn("智谱发布新的 GLM 模型", prompt)
        self.assertIn("not event photography", prompt)
        self.assertIn("Do not invent documentary evidence", prompt)

    def test_thematic_fallback_pool_supports_weekly_unique_images(self):
        self.assertGreaterEqual(len(set(THEME_PHOTOS["general"])), 25, "General fallback pool must support a full weekly run without exhausting unique images")
        for topic in ("robot", "compute", "product", "business", "creative", "security"):
            self.assertGreaterEqual(len(set(THEME_PHOTOS[topic])), 5)
        self.assertTrue(all(photo_id.startswith("photo-") for values in THEME_PHOTOS.values() for photo_id in values))

    def test_single_brand_overlap_does_not_accept_unrelated_image(self):
        ok, score = candidate_relevance(
            "Apple Intelligence China rollout with Qwen in Siri and writing tools",
            "Fresh red apple fruit on a table",
        )
        self.assertFalse(ok)
        self.assertLess(score, MIN_IMAGE_RELEVANCE_SCORE)

    def test_fallback_topic_distinguishes_software_agents_from_physical_robots(self):
        self.assertEqual(story_fallback_topic({"title_zh":"DeepSeek dsh-superagent 编码智能体路由工作器"}), "product")
        self.assertEqual(story_fallback_topic({"title_zh":"Apple Intelligence 接入 Siri 和 iPhone 写作工具"}), "product")
        self.assertEqual(story_fallback_topic({"title_zh":"OpenAI 与 ServiceNow 扩大企业工作流合作"}), "business")
        self.assertEqual(story_fallback_topic({"title_zh":"中国具身智能人形机器人产业"}), "robot")

    def test_firecrawl_requires_explicit_opt_in_and_key(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {}, clear=True):
            self.assertFalse(firecrawl_enabled())
        with patch.dict("os.environ", {"FIRECRAWL_API_KEY":"test-key"}, clear=True):
            self.assertFalse(firecrawl_enabled())
        with patch.dict("os.environ", {
            "FIRECRAWL_API_KEY":"test-key", "RADAR_USE_FIRECRAWL":"true"
        }, clear=True):
            self.assertTrue(firecrawl_enabled())


if __name__ == "__main__":
    unittest.main()
