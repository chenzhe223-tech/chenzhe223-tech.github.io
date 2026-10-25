import json
import tempfile
import unittest
from pathlib import Path
from radar.scripts.skill_radar import actual_skill_files, canonical_project_id, classify_skill_type, infer_skill_category, identify_duplicate, load_recommendation_history, enrich_growth_metrics, score_candidate, build_radar

class SkillRadarTests(unittest.TestCase):
    def test_skill_categories_are_inferred_from_project_content(self):
        self.assertEqual(infer_skill_category({"name":"owner/OpenMontage","description":"agentic video production and media creation"}),"多模态与创作")
        self.assertEqual(infer_skill_category({"name":"owner/planning-with-files","description":"agent workflow planning and task management"}),"Agent 工作流与规划")
        self.assertEqual(infer_skill_category({"name":"owner/archify","description":"software architecture and code review"}),"软件工程与测试")
    def test_category_concentration_is_limited(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[]}))
            candidates=[{"name":f"owner/tool-{i}","url":f"https://github.com/owner/tool-{i}","quality_status":"PASS","total_score":95-i,"license":"MIT","daily_theme":"多模态与创作"} for i in range(3)]
            r=build_radar(candidates,Path(td),"2026-10-24",limit=8)
            self.assertEqual(len(r["selected"]),2)
            self.assertEqual(r["excluded"][0]["reason"],"category_saturation")
    def test_developer_concentration_is_limited(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[]}))
            candidates=[{"name":f"owner/tool-{i}","url":f"https://github.com/owner/tool-{i}","description":desc,"quality_status":"PASS","total_score":95-i,"license":"MIT","daily_theme":f"category-{i}"} for i,desc in enumerate(["image creative video design","data analytics SQL dashboard","research academic literature citation"])]
            r=build_radar(candidates,Path(td),"2026-10-24",limit=8)
            self.assertEqual(len(r["selected"]),2)
            self.assertEqual(r["excluded"][0]["reason"],"developer_saturation")
    def test_actual_skill_file_must_exist_in_tree(self):
        self.assertEqual(actual_skill_files({"tree":[{"path":"skills/research/SKILL.md"},{"path":"README.md"}]}),["skills/research/SKILL.md"])
        self.assertEqual(actual_skill_files({"tree":[{"path":"README.md"}]}),[])
    def test_skill_type_requires_actual_skill_files(self):
        self.assertEqual(classify_skill_type("owner/skills-pack","Agent skills collection","Install by copying skills/research/SKILL.md into your agent's skills directory."),"skill_pack")
        self.assertIsNone(classify_skill_type("owner/mcp-server","MCP server for web search","Run npm install and start the MCP server."))
        self.assertIsNone(classify_skill_type("owner/tutorial","Learn how to write skills","This tutorial explains concepts but contains no installable skill files."))
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
        self.assertIsNotNone(identify_duplicate(new,[old]))
    def test_history_reads_past_90_days_and_reports_coverage(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"2026-10-20.json"; p.write_text(json.dumps({"skills":[{"name":"owner/repo","url":"https://github.com/owner/repo"}]}))
            h=load_recommendation_history(Path(td),"2026-10-24")
            self.assertEqual(h["status"],"partial"); self.assertEqual(len(h["records"]),1)
    def test_history_failure_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            h=load_recommendation_history(Path(td),"2026-10-24")
            self.assertEqual(h["status"],"unavailable")
    def test_candidate_snapshot_calculates_observed_7d_growth(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"2026-10-17.json"
            p.write_text(json.dumps({"snapshot_date":"2026-10-17","candidates":[{"name":"owner/repo","url":"https://github.com/owner/repo","canonical_id":"github.com/owner/repo","stars_total":100}]}))
            items=[{"name":"owner/repo","url":"https://github.com/owner/repo","stars":145}]
            result=enrich_growth_metrics(items,Path(td),"2026-10-24")
            self.assertEqual(items[0]["stars_delta_7d"],45)
            self.assertEqual(items[0]["growth_baseline_7d_date"],"2026-10-17")
            self.assertEqual(items[0]["stars_delta_30d"],None)
            self.assertEqual(result["candidates_with_7d_delta"],1)
    def test_candidate_snapshot_starts_baseline_without_inventing_growth(self):
        with tempfile.TemporaryDirectory() as td:
            items=[{"name":"owner/repo","url":"https://github.com/owner/repo","stars":145}]
            result=enrich_growth_metrics(items,Path(td),"2026-10-24")
            self.assertIsNone(items[0]["stars_delta_7d"])
            self.assertIn("no historical",items[0]["growth_data_status"])
            self.assertTrue((Path(td)/"2026-10-24.json").exists())
            self.assertEqual(result["status"],"baseline_started")
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
    def test_critical_security_risk_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[]}))
            candidate={"name":"x/y","url":"https://github.com/x/y","quality_status":"PASS","total_score":95,"license":"MIT","critical_security_issue":True}
            r=build_radar([candidate],Path(td),"2026-10-24")
            self.assertEqual(r["selected"],[])
            self.assertEqual(r["excluded"][0]["reason"],"critical_security_risk")
    def test_score_below_60_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[]}))
            candidate={"name":"x/y","url":"https://github.com/x/y","quality_status":"PASS","total_score":59,"license":"MIT"}
            r=build_radar([candidate],Path(td),"2026-10-24")
            self.assertEqual(r["selected"],[])
            self.assertEqual(r["excluded"][0]["reason"],"score_below_60_or_invalid")
    def test_sub80_candidate_without_rare_value_is_accepted_when_otherwise_verified(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[]}))
            candidate={"name":"x/y","url":"https://github.com/x/y","quality_status":"PASS","total_score":76,"license":"MIT","canonical_id":"github.com/x/y","evidence_verified":True,"readme_verified":True,"actual_skill_file_count":1}
            r=build_radar([candidate],Path(td),"2026-10-24")
            self.assertEqual(len(r["selected"]),1)
    def test_sub80_candidate_with_verified_rare_value_is_accepted(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[]}))
            candidate={"name":"x/y","url":"https://github.com/x/y","quality_status":"PASS","total_score":76,"license":"MIT","canonical_id":"github.com/x/y","evidence_verified":True,"readme_verified":True,"actual_skill_file_count":1,"rare_value_verified":True,"rare_value_reason":"Distinct documented use case","rare_value_evidence_url":"https://github.com/x/y#readme"}
            r=build_radar([candidate],Path(td),"2026-10-24")
            self.assertEqual(len(r["selected"]),1)
    def test_unverified_candidates_not_selected(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[]}))
            r=build_radar([{"name":"x/y","url":"https://github.com/x/y","quality_status":"FAIL","total_score":99}],Path(td),"2026-10-24")
            self.assertEqual(r["selected"],[])
    def test_diversity_uses_actual_capability_not_shared_daily_theme(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td,"2026-10-20.json").write_text(json.dumps({"skills":[]}))
            candidates = [
                {"name":"a/image-skill","url":"https://github.com/a/image-skill","description":"image video creative design skill","quality_status":"PASS","total_score":95,"license":"MIT","daily_theme":"开发提效"},
                {"name":"b/data-skill","url":"https://github.com/b/data-skill","description":"data analytics SQL dashboard skill","quality_status":"PASS","total_score":94,"license":"MIT","daily_theme":"开发提效"},
                {"name":"c/research-skill","url":"https://github.com/c/research-skill","description":"research literature academic citation skill","quality_status":"PASS","total_score":93,"license":"MIT","daily_theme":"开发提效"},
                {"name":"d/security-skill","url":"https://github.com/d/security-skill","description":"security vulnerability evaluation skill","quality_status":"PASS","total_score":92,"license":"MIT","daily_theme":"开发提效"},
            ]
            r = build_radar(candidates,Path(td),"2026-10-24",limit=8)
            self.assertEqual(len(r["selected"]),4)
if __name__=="__main__": unittest.main()
