import unittest

from news_image_match import candidate_relevance, extract_image_candidates, normalize_url


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

    def test_disney_candidate_passes_for_disney_character_ai_story(self):
        ok, score = candidate_relevance(
            "Disney agrees to hire majority of Character.AI workforce",
            "Disney Character.AI logo",
        )
        self.assertTrue(ok)
        self.assertGreater(score, 0)

    def test_unrelated_phone_photo_is_rejected_for_disney_story(self):
        ok, _ = candidate_relevance(
            "Disney agrees to hire majority of Character.AI workforce",
            "Modern iPhone mobile apps screen",
        )
        self.assertFalse(ok)

    def test_story_specific_chinese_keywords_overlap(self):
        ok, _ = candidate_relevance("清华开源智能体操作系统", "清华智能体操作系统项目")
        self.assertTrue(ok)


if __name__ == "__main__":
    unittest.main()
