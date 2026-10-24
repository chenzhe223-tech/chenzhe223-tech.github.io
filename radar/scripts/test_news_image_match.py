import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from news_image_match import (
    _BingImageParser, candidate_relevance, derive_visual_search_queries,
    extract_image_candidates, is_generic_brand_asset, normalize_url, story_fallback_topic,
    build_illustration_prompt, firecrawl_enabled, THEME_PHOTOS,
)


class NewsImageMatchTests(unittest.TestCase):
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
        self.assertGreaterEqual(len(set(THEME_PHOTOS["general"])), 8)
        for topic in ("robot", "compute", "product", "business", "creative"):
            self.assertGreaterEqual(len(set(THEME_PHOTOS[topic])), 5)
        self.assertTrue(all(photo_id.startswith("photo-") for values in THEME_PHOTOS.values() for photo_id in values))

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
