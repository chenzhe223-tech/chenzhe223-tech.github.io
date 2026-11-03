import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from radar.scripts import run_horizon
from radar.scripts.run_horizon import apply_claim_provenance, apply_verified_skill_metadata


class EditorialProvenanceTests(unittest.TestCase):
    def test_skill_count_and_host_compatibility_are_explicit(self):
        skills = [{
            "name": "Donchitos/Claude-Code-Game-Studios",
            "description_zh": "包含49个AI智能体、72个工作流技能。",
            "description_en": "49 AI agents, 72 workflow skills.",
            "actual_skill_file_count": 74,
            "skill_file_paths": [".claude/skills/game-design/SKILL.md"],
        }]
        apply_verified_skill_metadata(skills)
        self.assertIn("74个工作流技能", skills[0]["description_zh"])
        self.assertIn("74个SKILL.md文件", skills[0]["description_zh"])
        self.assertIn("74 workflow skills", skills[0]["description_en"])
        self.assertIn("74 SKILL.md files", skills[0]["description_en"])
        self.assertIn("Claude Code 专用", skills[0]["compatibility_status"])
        self.assertIn("Codex/WorkBuddy", skills[0]["compatibility_status"])

    def test_manual_editorial_cannot_override_skill_radar_with_unverified_skill(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            override_path = root / "radar" / "data" / "manual-editorial" / "2026-11-03.json"
            override_path.parent.mkdir(parents=True)
            stories = [
                {
                    "title_zh": f"核验新闻 {index}",
                    "what_zh": "公开来源确认的事实。",
                    "why_zh": "该变化值得持续观察。",
                    "source_url": f"https://source.example/{index}",
                    "published": "2026-11-02",
                }
                for index in range(1, 6)
            ]
            override_path.write_text(json.dumps({
                "report_date": "2026-11-03",
                "localization": {
                    "status": "manual_editorial_verified",
                    "provider": "DAVYLAB editorial review",
                    "sources_checked": 5,
                },
                "top5": stories,
                "editorial": {"core_zh": "核心观察", "trend_zh": "共同趋势"},
                "skills": [{
                    "name": "last30days",
                    "url": "https://github.com/mvanhorn/last30days-skill",
                    "license": "MIT",
                }],
            }, ensure_ascii=False), encoding="utf-8")
            verified_skill = {
                "name": "verified/data-skill",
                "url": "https://github.com/verified/data-skill",
                "canonical_id": "github.com/verified/data-skill",
                "quality_status": "PASS",
            }
            report = {"report_date": "2026-11-03", "skills": [verified_skill]}
            with patch.object(run_horizon, "ROOT", root):
                applied = run_horizon.apply_manual_editorial_override(report)
            self.assertTrue(applied)
            self.assertEqual(report["skills"], [verified_skill])
            self.assertEqual(report["top5"], stories)

    def test_source_grounded_editorial_fallback_is_created_when_missing(self):
        report = {
            "top5": [
                {"title_zh": "企业 Agent 合作", "what_zh": "企业服务合作推进智能体工作流。", "source": "A", "source_url": "https://a.example/1"},
                {"title_zh": "推理调用增长", "what_zh": "推理 token 调用量增长。", "source": "B", "source_url": "https://b.example/2"},
                {"title_zh": "开源智能体工具", "what_zh": "发布 Agent 研究原型。", "source": "C", "source_url": "https://c.example/3"},
                {"title_zh": "第四条", "what_zh": "工具更新。", "source": "D", "source_url": "https://d.example/4"},
                {"title_zh": "第五条", "what_zh": "产品应用。", "source": "E", "source_url": "https://e.example/5"},
            ],
            "editorial": {},
        }
        apply_claim_provenance(report)
        editorial = report["editorial"]
        self.assertTrue(editorial["core_zh"])
        self.assertTrue(editorial["trend_zh"])
        self.assertTrue(editorial["core_en"])
        self.assertTrue(editorial["trend_en"])
        self.assertEqual(len(editorial["source_basis"]), 5)
        self.assertEqual(editorial["analysis_label_zh"], "DAVYLAB 分析")

    def test_medium_confidence_benchmark_still_gets_source_attribution(self):
        report = {
            "top5": [{
                "confidence": "medium",
                "source": "MarkTechPost",
                "source_url": "https://marktechpost.com/benchmark",
                "title_zh": "Nace AI Drex Max v1",
                "what_zh": "Nace AI 发布27B模型，评分67.52。",
                "summary_zh": "该模型在测试中取得67.52分。",
                "what_en": "The model achieved a score of 67.52.",
            }]
        }
        apply_claim_provenance(report)
        story = report["top5"][0]
        self.assertIn("项目方/媒体披露", story["what_zh"])
        self.assertIn("尚无独立评测", story["what_zh"])
        self.assertIn("项目方/媒体披露", story["summary_zh"])
        self.assertIn("reported by the project or media", story["what_en"])

    def test_low_confidence_claim_is_attributed_and_caveated(self):
        report = {
            "top5": [{
                "confidence": "low",
                "source": "MarkTechPost",
                "source_url": "https://marktechpost.com/example",
                "title_zh": "Nace AI Drex Max v1",
                "what_zh": "Nace AI 发布27B模型，评分67.52。",
                "summary_zh": "Nace AI 发布了新的多模态决策模型。",
                "what_en": "Nace AI released a 27B multimodal decision model with a reported score of 67.52.",
                "editor_judgment_zh": "评分口径需要核实。",
            }]
        }
        apply_claim_provenance(report)
        self.assertEqual(report["editorial_policy_version"], "2026-11-02.2")
        self.assertEqual(report["editorial"]["analysis_label_zh"], "DAVYLAB 分析")
        self.assertEqual(report["editorial"]["source_basis"][0]["url"], "https://marktechpost.com/example")
        story = report["top5"][0]
        self.assertIn("据MarkTechPost报道", story["what_zh"])
        self.assertIn("尚无独立评测", story["what_zh"])
        self.assertIn("尚无独立评测", story["summary_zh"])
        self.assertIn("not independently verified", story["what_en"].lower())
        self.assertIn("低置信度", story["editor_judgment_zh"])


if __name__ == "__main__":
    unittest.main()
