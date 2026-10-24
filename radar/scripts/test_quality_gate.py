import unittest
from radar.scripts.quality_gate import compare_story, norm_url, similarity, tokens

class QualityGateTests(unittest.TestCase):
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
