import json
import tempfile
import unittest
from pathlib import Path
from radar.scripts.skill_radar import canonical_project_id, identify_duplicate, load_recommendation_history, score_candidate, build_radar

class SkillRadarTests(unittest.TestCase):
    def test_canonical_id_normalizes_url_git_and_case(self):
        self.assertEqual(canonical_project_id("https://WWW.GitHub.com/Owner/Repo.git?tab=readme"),"github.com/owner/repo")
    def test_same_project_different_url_is_duplicate(self):
        old={"name":"owner/repo","url":"https://github.com/owner/repo","_history_date":"2026-10-20"}
        new={"name":"repo","url":"http://www.github.com/owner/repo.git"}
        self.assertEqual(identify_duplicate(new,[old])["kind"],"canonical_id")
    def test_alias_name_duplicate(self):
        old={"name":"Skill Alpha","aliases":["AlphaSkill"]}
        self.assertEqual(identify_duplicate({"name":"AlphaSkill"},[old])["kind"],"name_or_alias")
    def test_shared_owner_does_not_imply_duplicate(self):
        old={"name":"OpenAI/coding-agent","description":"automated code editing and repository changes"}
        new={"name":"OpenAI/voice-agent","description":"real-time speech and audio conversations"}
        self.assertIsNone(identify_duplicate(new,[old]))
    def test_functionally_similar_candidates_detected(self):
        old={"name":"web-agent-skill","description":"browser automation agent that navigates websites and completes web workflows reliably"}
        new={"name":"browser-workflow-agent","description":"browser automation agent that navigates websites and completes web workflows reliably"}
        self.assertIsNotNone(identify_duplicate(new,[old],semantic_threshold=0.65))
    def test_history_reads_past_90_days_and_reports_coverage(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"2026-10-20.json"; p.write_text(json.dumps({"skills":[{"name":"owner/repo","url":"https://github.com/owner/repo"}]}))
            h=load_recommendation_history(Path(td),"2026-10-24")
            self.assertEqual(h["status"],"partial"); self.assertEqual(len(h["records"]),1)
    def test_history_failure_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            h=load_recommendation_history(Path(td),"2026-10-24")
            self.assertEqual(h["status"],"unavailable")
    def test_score_does_not_fabricate_growth(self):
        s=score_candidate({"name":"owner/repo","url":"https://github.com/owner/repo","stars":1000,"updated":"2026-10-20","license":"MIT","description":"Useful AI agent skill","evidence_verified":True},"2026-10-24")
        self.assertIsNone(s["stars_delta_7d"]); self.assertIsNone(s["stars_delta_30d"])
        self.assertIn("未推算",s["growth_data_status"])
    def test_recent_community_signal_is_recorded_and_scored(self):
        base={"name":"owner/repo","url":"https://github.com/owner/repo","stars":1000,"updated":"2026-10-20","license":"MIT","description":"A detailed and useful AI agent skill","evidence_verified":True,"readme_verified":True}
        without=score_candidate(base,"2026-10-24")
        with_signal=score_candidate({**base,"community_signals":{"count_7d":2,"evidence_urls":["https://news.ycombinator.com/item?id=1"]}},"2026-10-24")
        self.assertEqual(with_signal["community_count_7d"],2)
        self.assertGreater(with_signal["heat_score"],without["heat_score"])
    def test_score_total_is_weighted_and_bounded(self):
        s=score_candidate({"name":"owner/repo","url":"https://github.com/owner/repo","stars":10000,"updated":"2026-10-20","license":"MIT","description":"A detailed and useful AI agent skill","evidence_verified":True},"2026-10-24")
        self.assertGreaterEqual(s["total_score"],0); self.assertLessEqual(s["total_score"],100)
    def test_90_day_recommendation_is_blocked(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[{"name":"x/y","url":"https://github.com/x/y"}]}))
            candidate={"name":"x/y","url":"https://github.com/x/y","quality_status":"PASS","total_score":95,"license":"MIT","canonical_id":"github.com/x/y"}
            r=build_radar([candidate],Path(td),"2026-10-24")
            self.assertEqual(r["selected"],[])
            self.assertEqual(r["excluded"][0]["reason"],"duplicate")
    def test_verified_material_update_can_be_rerecommended(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[{"name":"x/y","url":"https://github.com/x/y"}]}))
            candidate={"name":"x/y","url":"https://github.com/x/y","quality_status":"PASS","total_score":95,"license":"MIT","canonical_id":"github.com/x/y","material_update_verified":True,"re_recommendation_reason":"Major security fix released","material_update_evidence_url":"https://github.com/x/y/releases/tag/v2"}
            r=build_radar([candidate],Path(td),"2026-10-24")
            self.assertEqual(len(r["selected"]),1)
    def test_unverified_candidates_not_selected(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[]}))
            r=build_radar([{"name":"x/y","url":"https://github.com/x/y","quality_status":"FAIL","total_score":99}],Path(td),"2026-10-24")
            self.assertEqual(r["selected"],[])
if __name__=="__main__": unittest.main()
