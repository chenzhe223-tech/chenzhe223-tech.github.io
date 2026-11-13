"""Offline validation for attributed XNews metadata snapshot sync."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "sync_xnews.py"
spec = importlib.util.spec_from_file_location("xnews_sync", SCRIPT)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def make(id, source_url="https://example.com/source", date="2026-11-12"):
    return {
        "id": id, "title": "AI 公司推出新工具：" + id,
        "date": date,
        "source_url": source_url,
        "dek": "可用于普通人的真实工作场景。" * 30,
        "tags": ["Agent", "AI", "教程"]
    }


class XNewsSyncTest(unittest.TestCase):
    def setUp(self):
        self.records = [
            make("entry-one", "https://example.com/one"),
            make("entry-two", "https://example.com/two", "2026-11-11"),
            make("entry-three", "https://example.com/three", "2026-11-10"),
        ]

    def test_metadata_only_and_sorting(self):
        snapshot = sync.build_snapshot(self.records, "2026-11-13T01:30:00+00:00")
        self.assertEqual(snapshot["count"], 3)
        self.assertEqual([x["id"] for x in snapshot["articles"]],
                         ["entry-one", "entry-two", "entry-three"])
        first = snapshot["articles"][0]
        self.assertEqual(first["original_url"], "https://example.com/one")
        self.assertEqual(first["xnews_url"], "https://xnews.qiaomu.ai/a/entry-one")
        self.assertLessEqual(len(first["summary"]), 240)
        self.assertNotIn("body_md", first)
        self.assertNotIn("original", first)
        self.assertEqual(first["verification"], "upstream_metadata_not_independently_verified")

    def test_duplicates_both_url_and_id(self):
        duplicate = make("entry-four", "https://example.com/one/")
        snapshot = sync.build_snapshot(self.records + [duplicate], "2026-11-13T01:30:00+00:00")
        self.assertEqual(snapshot["count"], 3)

    def test_reject_private_and_unsafe_urls(self):
        for value in ("javascript:alert(1)", "file:///tmp/key", "http://127.0.0.1/",
                      "http://192.168.1.4/", "http://localhost:8080/",
                      "https://user:password@example.com/private",
                      "https://example.internal/doc", "ftp://example.com/data"):
            with self.subTest(value=value):
                self.assertEqual(sync.public_http_url(value), "")
        self.assertEqual(sync.public_http_url("https://example.org/article"), "https://example.org/article")

    def test_empty_invalid_upstream_not_allowed(self):
        for payload in (None, {}, [], [{"id": "bad", "source_url": "javascript:alert(1)"}]):
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    sync.build_snapshot(payload, "2026-11-13T01:30:00+00:00")

    def test_invalid_upstream_preserves_existing_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp=Path(tmp)/"upstream.json"
            out=Path(tmp)/"snapshot.json"
            inp.write_text("[]", encoding="utf-8")
            out.write_text('{"keep":"last-good"}', encoding="utf-8")
            completed=subprocess.run(
                [sys.executable, str(SCRIPT), "--input", str(inp), "--output", str(out)],
                capture_output=True, text=True, timeout=10)
            self.assertNotEqual(completed.returncode, 0)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8")), {"keep":"last-good"})

    def test_bootstrapped_snapshot_attribution(self):
        path=Path(__file__).resolve().parents[1]/"data"/"xnews-discovery.json"
        cached=json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(cached["schema_version"], 1)
        self.assertGreaterEqual(cached["count"], 3)
        self.assertEqual(cached["count"], len(cached["articles"]))
        for row in cached["articles"]:
            self.assertTrue(row["xnews_url"].startswith("https://xnews.qiaomu.ai/a/"))
            self.assertTrue(sync.public_http_url(row["original_url"]))
            self.assertLessEqual(len(row["summary"]), 240)
            self.assertIn("upstream_metadata_not_independently_verified", row["verification"])


if __name__ == "__main__":
    unittest.main()
