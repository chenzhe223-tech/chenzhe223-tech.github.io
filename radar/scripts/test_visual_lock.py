import unittest
from radar.scripts.visual_lock import validate_visual_lock

class VisualLockTests(unittest.TestCase):
    def test_w44_uses_locked_mountain_editorial(self):
        result = validate_visual_lock("2026-11-01")
        self.assertEqual(result["design_variant"], "mountain-editorial")
        self.assertEqual(result["canvas"], [1200, 1800])

    def test_retry_date_does_not_change_style(self):
        a = validate_visual_lock("2026-10-31")
        b = validate_visual_lock("2026-11-01")
        self.assertEqual(a["design_variant"], b["design_variant"])
        self.assertEqual(a["style_cycle_index"], b["style_cycle_index"])

    def test_w45_uses_geometric_navy(self):
        result = validate_visual_lock("2026-11-02")
        self.assertEqual(result["design_variant"], "geometric-navy")
        self.assertEqual(result["canvas"], [1200, 1800])

    def test_adjacent_iso_week_alternates(self):
        a = validate_visual_lock("2026-11-01")
        b = validate_visual_lock("2026-11-02")
        self.assertNotEqual(a["design_variant"], b["design_variant"])

if __name__ == "__main__":
    unittest.main()
