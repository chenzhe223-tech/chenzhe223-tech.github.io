import unittest

from radar.scripts.run_horizon import apply_claim_provenance, apply_verified_skill_metadata


class EditorialProvenanceTests(unittest.TestCase):
    def test_skill_count_and_host_compatibility_are_explicit(self):
        skills = [{
            "name": "Donchitos/Claude-Code-Game-Studios",
            "description_zh": "包含49个AI智能体、72个工作流技能。",
            "actual_skill_file_count": 74,
            "skill_file_paths": [".claude/skills/game-design/SKILL.md"],
        }]
        apply_verified_skill_metadata(skills)
        self.assertIn("74个工作流技能", skills[0]["description_zh"])
        self.assertIn("74个SKILL.md文件", skills[0]["description_zh"])
        self.assertIn("Claude Code 专用", skills[0]["compatibility_status"])
        self.assertIn("Codex/WorkBuddy", skills[0]["compatibility_status"])

    def test_low_confidence_claim_is_attributed_and_caveated(self):
        report = {
            "top5": [{
                "confidence": "low",
                "source": "MarkTechPost",
                "what_zh": "Nace AI 发布27B模型，评分67.52。",
                "summary_zh": "Nace AI 发布了新的多模态决策模型。",
                "what_en": "Nace AI released a 27B multimodal decision model with a reported score of 67.52.",
                "editor_judgment_zh": "评分口径需要核实。",
            }]
        }
        apply_claim_provenance(report)
        story = report["top5"][0]
        self.assertIn("据MarkTechPost报道", story["what_zh"])
        self.assertIn("尚无独立评测", story["what_zh"])
        self.assertIn("尚无独立评测", story["summary_zh"])
        self.assertIn("not independently verified", story["what_en"].lower())
        self.assertIn("低置信度", story["editor_judgment_zh"])


if __name__ == "__main__":
    unittest.main()
