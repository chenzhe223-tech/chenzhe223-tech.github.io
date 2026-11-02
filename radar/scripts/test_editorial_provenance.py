import unittest

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
