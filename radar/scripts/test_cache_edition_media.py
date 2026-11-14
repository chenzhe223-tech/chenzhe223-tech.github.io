from copy import deepcopy
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from PIL import Image
from radar.scripts.cache_edition_media import cache_report


class EditionMediaTests(unittest.TestCase):
    def setUp(self):
        output = BytesIO()
        Image.new("RGB", (100, 60), "#835c35").save(output, format="PNG")
        self.image = output.getvalue()
        self.story = {"title_zh": "来源报道", "image_match_status": "article_image", "image_url": "https://example.com/photo.png"}
        self.report = {"report_date": "2026-11-14", "top5": [deepcopy(self.story)], "news": [deepcopy(self.story)]}

    def test_source_copy_preserves_source_and_reuses_verified_local_file(self):
        with TemporaryDirectory(dir=Path.cwd()) as root:
            result = cache_report(self.report, root, lambda _: self.image)
            self.assertEqual(result["cached"], 1)
            self.assertEqual(self.report["top5"][0]["image_url"], self.story["image_url"])
            self.assertEqual(self.report["top5"][0]["image_local"], self.report["news"][0]["image_local"])
            self.assertEqual(len(self.report["top5"][0]["image_local_sha256"]), 64)
            cache_report(self.report, root, lambda _: self.fail("A valid cached file must be reused"))
            self.assertEqual(len(list(Path(root).rglob("*.webp"))), 1)

    def test_stock_and_private_urls_are_not_cached(self):
        self.report["top5"][0]["image_match_status"] = "thematic_fallback"
        self.report["xnews_voices"] = [{"image_match_status": "article_image", "image_url": "https://127.0.0.1/a.png"}]
        with TemporaryDirectory(dir=Path.cwd()) as root:
            result = cache_report(self.report, root, lambda _: self.fail("Untrusted image must not be fetched"))
            self.assertEqual(result["cached"], 0)

    def test_failed_or_nonimage_artwork_cannot_claim_a_cached_lead(self):
        with TemporaryDirectory(dir=Path.cwd()) as root:
            with self.assertRaises(RuntimeError):
                cache_report(self.report, root, lambda _: b"not an image")
            self.assertNotIn("image_local", self.report["top5"][0])

    def test_oversized_source_is_rejected(self):
        with TemporaryDirectory(dir=Path.cwd()) as root:
            with self.assertRaises(RuntimeError):
                cache_report(self.report, root, lambda _: b"a" * 8_000_001)

    def test_date_cannot_escape_edition_directory(self):
        self.report["report_date"] = "../../outside"
        with TemporaryDirectory(dir=Path.cwd()) as root, self.assertRaises(ValueError):
            cache_report(self.report, root, lambda _: self.image)
