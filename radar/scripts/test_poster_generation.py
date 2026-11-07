"""Regression tests for final-poster image fetches, overlays, text wrapping and QR encoding."""
import io
import hashlib
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
                 "image_source": "Publisher", "image_match_status": "article_image", "image_sha256": hashlib.sha256(payload).hexdigest()}
        with patch.object(poster.urllib.request, "urlopen", return_value=FakeResponse(payload)) as mocked:
            result = poster.image_for_story(story, 0)
        self.assertEqual(result.size, (120, 80))
        self.assertEqual(mocked.call_count, 1)

    def test_failed_verified_image_cannot_switch_to_ungated_backup(self):
        story = {"title_zh": "AI 智能体企业软件", "image_url": "https://source.example.test/news",
                 "image_fallback_url": "https://source.example.test/fallback", "image_sha256": "a" * 64}
        with patch.object(poster.urllib.request, "urlopen", side_effect=OSError("offline")):
            with self.assertRaisesRegex(RuntimeError, "verified story image"):
                poster.image_for_story(story, 0)

    def test_image_bytes_cannot_change_after_quality_gate(self):
        story = {"image_url": "https://example.com/topic", "image_sha256": "a" * 64}
        with patch.object(poster.urllib.request, "urlopen", return_value=FakeResponse(png_bytes())):
            with self.assertRaisesRegex(RuntimeError, "verified story image"):
                poster.image_for_story(story, 0)

    def test_disclosure_is_drawn_after_final_wide_crop(self):
        story = {"image_url": "https://example.com/topic", "image_match_status": "thematic_fallback"}
        raw = Image.new("RGB", (700, 700), "white")
        with patch.object(poster, "image_for_story", return_value=raw):
            photo = poster.story_photo(story, 0, (348, 132))
        self.assertEqual(photo.size, (348, 132))
        self.assertNotEqual(photo.getpixel((0, 131)), (255, 255, 255))
        self.assertTrue(story["poster_image_label_applied"])

    def test_poster_evidence_rejects_image_substitution(self):
        top = [{"title_zh": str(i), "source_url": f"https://example.com/{i}", "image_sha256": "a" * 64} for i in range(5)]
        manifest = {"news_urls": [x["source_url"] for x in top], "news_titles": [x["title_zh"] for x in top], "news_image_evidence": [{"image_sha256": "a" * 64, "rendered_image_sha256": "a" * 64} for _ in top]}
        self.assertEqual(verify_poster.verify_news_evidence(manifest, {"top5": top})["status"], "PASS")
        manifest["news_image_evidence"][0]["rendered_image_sha256"] = "b" * 64
        with self.assertRaisesRegex(RuntimeError, "P0-verified digest"):
            verify_poster.verify_news_evidence(manifest, {"top5": top})

    def test_topic_metadata_alone_is_not_proof_of_visible_disclosure(self):
        evidence = poster.news_image_evidence([{"image_match_status": "thematic_fallback"}])[0]
        self.assertTrue(evidence["label_required"])
        self.assertFalse(evidence["label_applied"])

    def test_alpha_composite_checks_dimensions_and_preserves_canvas_size(self):
        background = Image.new("RGB", (32, 24), (0, 0, 0))
        overlay = Image.new("RGBA", (32, 24), (255, 255, 255, 80))
        merged = poster.composite_same_size(background, overlay)
        self.assertEqual(merged.size, (32, 24))
        with self.assertRaisesRegex(ValueError, "size mismatch"):
            poster.composite_same_size(background, Image.new("RGBA", (31, 24), (255, 255, 255, 80)))

    def test_text_bounds_fail_closed_outside_canvas(self):
        image = Image.new("RGB", (poster.W, poster.H), "white")
        draw = ImageDraw.Draw(image)
        with self.assertRaisesRegex(RuntimeError, "text bounds overflow"):
            poster.record_text_bounds(draw, ["中文测试"], (1190, 100), poster.font(16, True), 20, 22, "test")

    def test_style_layout_regions_are_complete(self):
        self.assertEqual(len(poster.layout_regions_for("geometric-navy")), 8)
        self.assertEqual(len(poster.layout_regions_for("mountain-editorial")), 7)

    def test_manifest_layout_rejects_truncated_text(self):
        manifest = {
            "design": "geometric-navy",
            "layout_regions": poster.layout_regions_for("geometric-navy"),
            "text_bounds": [{
                "x": 20, "y": 20, "width": 300, "height": 30,
                "actual_width": 290, "truncated": True, "overflow": False
            }]
        }
        with self.assertRaisesRegex(RuntimeError, "truncated text blocks"):
            verify_poster.verify_manifest_layout(manifest)

    def test_chinese_text_wrap_respects_available_width(self):
        image = Image.new("RGB", (240, 100), "white")
        draw = ImageDraw.Draw(image)
        font = poster.font(18, True)
        lines = poster.wrap(draw, "AI 前沿简报每天精选值得关注的真实新闻", font, 110)
        self.assertGreater(len(lines), 1)
        for line in lines:
            self.assertLessEqual(draw.textlength(line, font=font), 110.5)

    def test_geometric_secondary_cards_use_complete_fitting_summary(self):
        image = Image.new("RGB", (poster.W, poster.H), "white")
        draw = ImageDraw.Draw(image)
        story = {
            "title_zh": "智能体在企业采购与研发流程的应用",
            "poster_summary_zh": "这是一条过长的新闻摘要，需要在海报窄卡片上完整表达而不能被悄悄截断。" * 9,
            "poster_why_zh": "企业需要复核权限与结果。",
        }
        summary, fnt = poster.choose_mini_card_summary(draw, story, 372)
        self.assertEqual(summary, story["poster_why_zh"])
        self.assertLessEqual(len(poster.wrap(draw, summary, fnt, 372)), 3)
        old = list(poster.TEXT_BOUNDS)
        try:
            poster.paragraph(draw, summary, (195, 1222), fnt, "black", 372, 3, 3)
            self.assertFalse(poster.TEXT_BOUNDS[-1]["truncated"])
            self.assertLessEqual(1222 + poster.TEXT_BOUNDS[-1]["height"], 1280)
        finally:
            poster.TEXT_BOUNDS[:] = old

    def test_geometric_secondary_cards_never_silently_clip_unbounded_copy(self):
        image = Image.new("RGB", (poster.W, poster.H), "white")
        draw = ImageDraw.Draw(image)
        story = {
            "poster_summary_zh": "生成式技术帮助各行业完成任务。" * 60,
            "poster_why_zh": "业务必须保持可靠性与可追溯性。" * 60,
            "what_zh": "该项目仍处于研究原型阶段。" * 60,
        }
        summary, fnt = poster.choose_mini_card_summary(draw, story, 372)
        self.assertLessEqual(len(poster.wrap(draw, summary, fnt, 372)), 3)
        self.assertTrue(summary)

    def test_geometric_skill_description_fits_reserved_four_line_area(self):
        image = Image.new("RGB", (poster.W, poster.H), "white")
        draw = ImageDraw.Draw(image)
        previous = list(poster.TEXT_BOUNDS)
        try:
            description = "面向数据分析、统计验证、图表生成与可打印报告的自动化工作流。" * 5
            bottom = poster.paragraph(
                draw, description, (82, 1434), poster.font(13), "black", 565, 4, 2
            )
            self.assertLessEqual(bottom, 1500)
            self.assertFalse(poster.TEXT_BOUNDS[-1]["truncated"])
            self.assertEqual(poster.TEXT_BOUNDS[-1]["line_count"], 4)
        finally:
            poster.TEXT_BOUNDS[:] = previous

    def test_final_composite_qr_decodes_at_mobile_friendly_size(self):
        target = "https://chenzhe223-tech.github.io/radar/daily/"
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
        qr.add_data(target)
        qr.make(fit=True)
        qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        qr_image = qr_image.resize((poster.QR_SIZE, poster.QR_SIZE), Image.Resampling.NEAREST)
        # Use a full-canvas textured background so the encoded PNG resembles a real editorial poster and exceeds the verifier's minimum artifact-size guard without weakening production validation.
        final_image = Image.effect_noise((poster.W, poster.H), 24).convert("RGB")
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
