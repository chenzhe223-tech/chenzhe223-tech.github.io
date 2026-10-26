"""Regression tests for final-poster image fetches, overlays, text wrapping and QR encoding."""
import io
import unittest
from unittest.mock import patch

import qrcode
from PIL import Image, ImageDraw
from radar.scripts import verify_poster

from radar.scripts import generate_poster as poster


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc, tb):
        return False
    def read(self, limit=-1):
        return self.payload[:limit] if limit and limit > 0 else self.payload


def png_bytes(size=(120, 80), color=(70, 100, 130)):
    image = Image.new("RGB", size, color)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class PosterGenerationTests(unittest.TestCase):
    def test_successfully_loads_matched_image(self):
        payload = png_bytes()
        story = {"title_zh": "测试新闻", "image_url": "https://images.example.test/news.png",
                 "image_fallback_url": "https://images.example.test/fallback.png",
                 "image_source": "Publisher", "image_match_status": "article_image"}
        with patch.object(poster.urllib.request, "urlopen", return_value=FakeResponse(payload)) as mocked:
            result = poster.image_for_story(story, 0)
        self.assertEqual(result.size, (120, 80))
        self.assertEqual(mocked.call_count, 1)

    def test_failed_remote_images_fall_back_after_three_candidates(self):
        story = {"title_zh": "AI 智能体企业软件", "image_url": "https://source.example.test/news",
                 "image_fallback_url": "https://source.example.test/fallback"}
        with patch.object(poster.urllib.request, "urlopen", side_effect=OSError("offline")) as mocked:
            result = poster.image_for_story(story, 0)
        self.assertEqual(result.size, (700, 380))
        self.assertLessEqual(mocked.call_count, 3)
        self.assertGreater(mocked.call_count, 0)

    def test_alpha_composite_checks_dimensions_and_preserves_canvas_size(self):
        background = Image.new("RGB", (32, 24), (0, 0, 0))
        overlay = Image.new("RGBA", (32, 24), (255, 255, 255, 80))
        merged = poster.composite_same_size(background, overlay)
        self.assertEqual(merged.size, (32, 24))
        with self.assertRaisesRegex(ValueError, "size mismatch"):
            poster.composite_same_size(background, Image.new("RGBA", (31, 24), (255, 255, 255, 80)))

    def test_chinese_text_wrap_respects_available_width(self):
        image = Image.new("RGB", (240, 100), "white")
        draw = ImageDraw.Draw(image)
        font = poster.font(18, True)
        lines = poster.wrap(draw, "AI 前沿简报每天精选值得关注的真实新闻", font, 110)
        self.assertGreater(len(lines), 1)
        for line in lines:
            self.assertLessEqual(draw.textlength(line, font=font), 110.5)

    def test_final_composite_qr_decodes_at_mobile_friendly_size(self):
        target = "https://chenzhe223-tech.github.io/radar/daily/"
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
        qr.add_data(target)
        qr.make(fit=True)
        qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        qr_image = qr_image.resize((poster.QR_SIZE, poster.QR_SIZE), Image.Resampling.NEAREST)
        final_image = Image.new("RGB", (poster.W, poster.H), (14, 34, 60))
        final_image.paste(qr_image, (poster.QR_X, poster.QR_Y))
        path = poster.POSTERS / "_test-final-qr.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            final_image.save(path, format="PNG", optimize=True)
            result = verify_poster.decode_poster(path, target)
            self.assertEqual(result["decoded_url"], target)
            self.assertEqual(result["qr_tile_px"], [240, 240])
            self.assertEqual(result["status"], "PASS")
        finally:
            path.unlink(missing_ok=True)

    def test_qr_encoder_produces_the_canonical_target_payload(self):
        target = "https://chenzhe223-tech.github.io/radar/daily/"
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=4)
        qr.add_data(target)
        qr.make(fit=True)
        image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        self.assertEqual(image.mode, "RGB")
        self.assertGreater(image.width, 100)
        self.assertEqual(target, poster.PUBLIC_URL)


if __name__ == "__main__":
    unittest.main()
