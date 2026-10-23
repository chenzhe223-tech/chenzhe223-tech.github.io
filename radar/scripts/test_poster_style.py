"""Tests for deterministic weekly poster style selection."""
import datetime as dt
import unittest
from radar.scripts.poster_style import STYLE_GEOMETRIC, STYLE_MOUNTAIN, poster_style_metadata

class PosterStyleScheduleTests(unittest.TestCase):
    def test_same_iso_week_keeps_one_style(self):
        a = poster_style_metadata("2026-10-19")
        b = poster_style_metadata("2026-10-23")
        self.assertEqual((a["iso_year"], a["iso_week"]), (b["iso_year"], b["iso_week"]))
        self.assertEqual(a["design_variant"], b["design_variant"])
        self.assertEqual(a["design_variant"], STYLE_GEOMETRIC)

    def test_adjacent_weeks_alternate(self):
        this_week = poster_style_metadata("2026-10-23")
        next_week = poster_style_metadata("2026-10-26")
        self.assertNotEqual(this_week["design_variant"], next_week["design_variant"])
        self.assertEqual(next_week["design_variant"], STYLE_MOUNTAIN)

    def test_retries_for_same_date_are_deterministic(self):
        self.assertEqual(poster_style_metadata("2026-10-23"), poster_style_metadata("2026-10-23"))

    def test_iso_year_boundary_still_alternates_by_consecutive_week(self):
        week_53 = poster_style_metadata("2026-12-31")
        next_year_week_1 = poster_style_metadata("2027-01-04")
        self.assertEqual(week_53["iso_week"], 53)
        self.assertEqual(next_year_week_1["iso_week"], 1)
        self.assertNotEqual(week_53["design_variant"], next_year_week_1["design_variant"])

    def test_dates_in_same_iso_week_across_calendar_year_match(self):
        a = poster_style_metadata("2026-12-31")
        b = poster_style_metadata("2027-01-01")
        self.assertEqual(a["style_cycle_index"], b["style_cycle_index"])
        self.assertEqual(a["design_variant"], b["design_variant"])

    def test_anchor_is_timezone_independent(self):
        result = poster_style_metadata(dt.date(2026, 10, 23))
        self.assertEqual(result["iso_year"], 2026)
        self.assertEqual(result["iso_week"], 43)

if __name__ == "__main__":
    unittest.main()
