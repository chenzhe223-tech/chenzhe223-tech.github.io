import unittest
from radar.scripts.build_daily import _duplicate_match, _story_url_key, _story_tokens

class HistoricalDedupeTests(unittest.TestCase):
    def test_tracking_url_variants_are_same_story(self):
        a={"title":"A new AI product","url":"https://www.example.com/story/?utm_source=x"}
        b={"title":"Completely rewritten headline","url":"http://example.com/story#details"}
        self.assertEqual(_duplicate_match(b,[{**a,"_history_date":"2026-10-23"}])["kind"],"same_url")
    def test_chinese_title_paraphrase_shares_event_ngrams(self):
        a={"title":"英国宣布约6亿英镑AI安全投入，设立AI生物安全实验室"}
        b={"title":"英国加码人工智能安全，投入资金建设生物安全实验室"}
        self.assertGreater(len(_story_tokens(a["title"]) & _story_tokens(b["title"])), 5)
    def test_same_company_different_events_not_automatically_duplicate(self):
        old={"title":"OpenAI launches a new enterprise coding agent"}
        new={"title":"OpenAI releases a new voice model for mobile"}
        self.assertIsNone(_duplicate_match(new,[old]))
    def test_normalized_url_removes_tracking_and_fragment(self):
        self.assertEqual(_story_url_key({"url":"https://www.example.com/a?utm_medium=x#frag"}),"https://example.com/a")
if __name__=="__main__": unittest.main()
