import unittest
from radar.scripts.build_daily import _duplicate_match, _story_url_key, _story_tokens
from radar.scripts.run_horizon import remove_top5_duplicates_from_china

class HistoricalDedupeTests(unittest.TestCase):
    def test_english_source_title_matches_historical_original_title(self):
        old={"title_zh":"OpenAI收购Orchestra Bio，强化生物科技业务","title":"OpenAI acquires Orchestra Bio to beef up biotech business","url":"https://old.example/story","_history_date":"2026-10-21"}
        new={"title":"OpenAI acquires Orchestra Bio to beef up biotech business","url":"https://new.example/story"}
        self.assertIsNotNone(_duplicate_match(new,[old]))
    def test_near_identical_headline_is_filtered_after_ai_reselection(self):
        old={"title":"OpenAI收购Orchestra Bio，强化生物科技业务","url":"https://old.example/story","_history_date":"2026-10-24"}
        new={"title":"OpenAI收购Orchestra Bio","url":"https://new.example/story"}
        self.assertIsNotNone(_duplicate_match(new,[old],current_date="2026-10-25"))
    def test_old_near_event_does_not_hide_a_new_update(self):
        old={"title":"OpenAI收购Orchestra Bio，强化生物科技业务","url":"https://old.example/story","_history_date":"2026-10-20"}
        new={"title":"OpenAI收购Orchestra Bio","url":"https://new.example/story"}
        self.assertIsNone(_duplicate_match(new,[old],current_date="2026-10-25"))

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

    def test_top5_overlap_is_removed_from_china_section_and_public_count_is_capped(self):
        report = {
            "report_date": "2026-10-26",
            "top5": [{
                "title_zh": "南北阁发布 Nanbeige4.3-33B 开源模型",
                "title_en": "Nanbeige releases Nanbeige4.3-33B open agentic coding model",
                "original_title": "Nanbeige releases Nanbeige4.3-33B open agentic coding model",
                "source_url": "https://www.marktechpost.com/2026/10/25/nanbeige-releases-nanbeige4-3-33b-open-agentic-coding-model/",
            }],
            "china_ai_news": [
                {"title_zh": "南北阁发布 Nanbeige4.3-33B 开源智能体编程模型", "title": "Nanbeige releases Nanbeige4.3-33B open agentic coding model", "url": "https://www.marktechpost.com/2026/10/25/nanbeige-releases-nanbeige4-3-33b-open-agentic-coding-model/"},
                *[{"title": f"Distinct China AI story {i}", "url": f"https://example.com/china-ai-{i}"} for i in range(1, 10)],
            ],
        }
        result = remove_top5_duplicates_from_china(report)
        self.assertEqual(len(result["china_ai_news"]), 8)
        self.assertFalse(any("Nanbeige" in (x.get("title") or "") for x in result["china_ai_news"]))
        self.assertEqual(result["cross_section_dedupe"]["removed_from_china_ai_news"], 1)
if __name__=="__main__": unittest.main()
