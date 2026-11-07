"""Regression tests for deterministic image-display QA. No external hosts."""
import hashlib
import io
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw
from radar.scripts.image_visual_quality import assess_bytes, assess_cached_image, POLICY_VERSION


def sample_image(w, h):
    image = Image.new("RGB", (w, h), "#f2f1ef")
    draw = ImageDraw.Draw(image)
    for y in range(0, h, 15):
        draw.rectangle((0, y, w - 1, min(h - 1, y + 7)),
                       fill="#1d4b79" if y // 15 % 2 == 0 else "#db824e")
    dest = io.BytesIO()
    image.save(dest, format="PNG")
    return dest.getvalue()


class NewsVisualQualityTests(unittest.TestCase):
    def test_landscape_article_image_can_be_shown_without_cropping(self):
        raw = sample_image(960, 640)
        result = assess_bytes(raw, {"image_match_status": "article_image",
                                    "image_url": "https://publisher.example/news.png"})
        self.assertEqual(result["display_mode"], "verified_photo")
        self.assertEqual(result["policy_version"], POLICY_VERSION)
        self.assertFalse(result["semantic_match_model_verified"])

    def test_portrait_full_face_cannot_be_force_cropped_to_wide_card(self):
        result = assess_bytes(sample_image(500, 900), {"image_match_status": "article_image"})
        self.assertEqual(result["display_mode"], "info_card")
        self.assertIn("portrait_in_landscape_card", result["reasons"])

    def test_low_resolution_image_is_replaced_by_information_card(self):
        result = assess_bytes(sample_image(150, 100), {"image_match_status": "article_image"})
        self.assertIn("thumbnail_too_small", result["reasons"])
        self.assertEqual(result["display_mode"], "info_card")

    def test_stock_topic_image_is_never_passed_as_documentary_photo(self):
        result = assess_bytes(sample_image(950, 630), {
            "image_match_status": "thematic_fallback",
            "image_url": "https://images.unsplash.com/photo-any"})
        self.assertEqual(result["display_mode"], "info_card")
        self.assertIn("unverified_generic_topic_art", result["reasons"])

    def test_identical_pixels_do_not_override_verified_digest(self):
        raw = sample_image(960, 640)
        digest = hashlib.sha256(raw).hexdigest()
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / digest).write_bytes(raw)
            result = assess_cached_image(digest, {"image_match_status": "article_image"}, root)
            self.assertEqual(result["content_digest_sha256"], digest)
            (root / digest).write_bytes(b"altered")
            with self.assertRaisesRegex(ValueError, "verified_image_bytes_mismatch"):
                assess_cached_image(digest, {"image_match_status": "article_image"}, root)

    def test_invalid_image_cannot_silently_pass_pixel_quality_gate(self):
        with self.assertRaises(Exception):
            assess_bytes(b"not an image" * 30, {"image_match_status": "article_image"})


if __name__ == "__main__":
    unittest.main()
