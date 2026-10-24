import unittest
from radar.scripts.quality_gate import compare_story, evaluate_quality_gate, norm_url, published_image_records, similarity, tokens

class QualityGateTests(unittest.TestCase):
    def test_unreachable_historical_image_is_reported_but_does_not_block_clean_current_assets(self):
        self.assertEqual(evaluate_quality_gate([],[],[],[],[],[{"url":"https://old.example/missing.jpg"}],[]),"PASS")
        self.assertEqual(evaluate_quality_gate([],[],[{"type":"image_unverifiable"}],[],[],[],[]),"FAIL")
        self.assertEqual(evaluate_quality_gate([],[],[],[{"type":"same_week_content_reuse"}],[],[],[]),"FAIL")
    def test_weekly_image_index_ignores_unpublished_rss_candidates(self):
        doc={"news":[{"title":"Unused RSS candidate","image_url":"https://example.com/unused.jpg"}],"top5":[{"title":"Published story","image_url":"https://example.com/published.jpg"}]}
        items=list(published_image_records(doc,"2026-10-23"))
        self.assertEqual([x["title"] for x in items],["Published story"])
    def test_url_normalization_ignores_tracking_and_host_prefix(self):
        self.assertEqual(norm_url("http://www.example.com/a/?utm_source=x#top"), "https://example.com/a")
    def test_exact_same_story_different_url_is_duplicate_by_title(self):
        old={"title":"OpenAI announces new frontier model","url":"https://a.example/news","_history_date":"2026-10-23"}
        new={"title":"OpenAI announces new frontier model","url":"https://b.example/story"}
        self.assertEqual(compare_story(new,[old])["kind"],"exact_title")
    def test_similar_headline_same_event_is_duplicate(self):
        old={"title":"UK announces £600m AI safety funding and biological safety lab","summary":"The government announced new AI safety funding","_history_date":"2026-10-23"}
        new={"title":"Britain unveils 600 million pounds for AI safety, including biosafety lab","summary":"Government funding for AI security","url":"https://example.com"}
        self.assertIsNotNone(compare_story(new,[old]))
    def test_same_company_only_does_not_trigger_duplicate(self):
        old={"title":"OpenAI launches a new coding agent for enterprise customers"}
        new={"title":"OpenAI announces a new voice model for mobile devices"}
        self.assertIsNone(compare_story(new,[old]))
    def test_cross_language_same_url_is_duplicate(self):
        old={"title":"Pathos AI teams up with Bristol Myers and Tempus","url":"https://example.com/news"}
        new={"title":"Pathos AI 携手 Bristol Myers 与 Tempus 推进药物研发","url":"https://example.com/news?utm_campaign=daily"}
        self.assertEqual(compare_story(new,[old])["kind"],"exact_url")
    def test_tokenizer_has_signal(self):
        self.assertIn("openai",tokens("OpenAI announces a new AI model"))
if __name__=="__main__": unittest.main()
