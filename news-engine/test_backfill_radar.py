"""Read-only historical backfill tests. No GitHub credentials or publication."""
import datetime as dt
import json
import tempfile
from pathlib import Path
import unittest

import backfill_radar

NOW = dt.datetime(2026, 11, 19, 9, tzinfo=dt.timezone.utc)


def fixture(root, days=("2026-10-21", "2026-11-18")):
    data = Path(root)
    (data / "archive").mkdir(parents=True, exist_ok=True)
    (data / "history.json").write_text(json.dumps({"days": [d + ".json" for d in days]}))
    for date in days:
        report = {
            "report_date": date,
            "news": [{"title": "Official release of AI model", "url": "https://example.com/model?utm_source=radar"}],
            "top5": [{"title_en": "Official release of AI model", "source_url": "https://example.com/model"}],
            "china_ai_news": [{"title": "Chinese AI open source update", "url": "https://example.cn/news"}],
        }
        (data / "archive" / (date + ".json")).write_text(json.dumps(report), encoding="utf-8")
    return data


class BackfillTests(unittest.TestCase):
    def test_manifest_import_is_oldest_first_with_real_date_stamps(self):
        with tempfile.TemporaryDirectory() as t:
            weeks, audit = backfill_radar.archive_history(fixture(t), NOW)
            self.assertEqual(audit["archive_days"], 2)
            self.assertEqual(audit["archive_earliest"], "2026-10-21")
            self.assertEqual(audit["archive_latest"], "2026-11-18")
            self.assertGreater(audit["unavailable_dates_in_90_day_window"], 0)
            self.assertEqual(audit["status"], "partial_observed_archive_history")
            old = weeks["2026-W43"]
            self.assertEqual(old["url:https://example.com/model"], "2026-10-21T12:00:00+00:00")
            self.assertEqual(sum(len(x) for x in weeks.values()), 4)
            self.assertNotIn("url:https://example.com/model", weeks.get("2026-W47", {}))

    def test_dry_run_does_not_write(self):
        with tempfile.TemporaryDirectory() as t:
            weeks, _ = backfill_radar.archive_history(fixture(t), NOW)
            store = {}
            result = backfill_radar.persist_backfill(
                weeks, repo="owner/repo", token="mock",
                read=lambda _repo, _tok, wk: (store.get(wk, {}).copy(), None),
                write=lambda _repo, _tok, wk, s, sha: store.update({wk: s}))
            self.assertEqual(result["new_keys"], 4)
            self.assertEqual(result["weeks"], 2)
            repeated = backfill_radar.persist_backfill(
                weeks, repo="owner/repo", token="mock",
                read=lambda _repo, _tok, wk: (store.get(wk, {}).copy(), None),
                write=lambda _repo, _tok, wk, s, sha: store.update({wk: s}))
            self.assertEqual(repeated["new_keys"], 0)

    def test_wrong_archive_date_aborts(self):
        with tempfile.TemporaryDirectory() as t:
            data = fixture(t)
            file = data / "archive" / "2026-10-21.json"
            row = json.loads(file.read_text())
            row["report_date"] = "2026-10-22"
            file.write_text(json.dumps(row))
            with self.assertRaisesRegex(ValueError, "date mismatch"):
                backfill_radar.archive_history(data, NOW)

    def test_missing_archive_fails_closed(self):
        with tempfile.TemporaryDirectory() as t:
            data = fixture(t)
            (data / "archive" / "2026-11-18.json").unlink()
            with self.assertRaisesRegex(ValueError, "missing"):
                backfill_radar.archive_history(data, NOW)

    def test_oversized_or_invalid_manifest_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            data = fixture(t)
            (data / "history.json").write_text('{"days":["../etc/passwd"]}')
            with self.assertRaises(ValueError):
                backfill_radar.archive_history(data, NOW)

    def test_not_backfill_future_dates(self):
        with tempfile.TemporaryDirectory() as t:
            data = fixture(t, ("2026-11-18", "2026-11-20"))
            weeks, audit = backfill_radar.archive_history(data, NOW)
            self.assertEqual(audit["archive_days"], 1)
            self.assertEqual(audit["archive_latest"], "2026-11-18")


if __name__ == "__main__":
    unittest.main()
