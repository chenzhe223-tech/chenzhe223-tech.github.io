"""Static guardrails for the local-only editorial workbench."""
import pathlib
import unittest
from html.parser import HTMLParser


class Nodes(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.viewport = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "meta" and a.get("name") == "viewport":
            self.viewport = True


class EditorHTMLTests(unittest.TestCase):
    def setUp(self):
        self.source = pathlib.Path(__file__).with_name("editor.html").read_text(encoding="utf-8")

    def test_accessible_editable_fields(self):
        parser = Nodes()
        parser.feed(self.source)
        self.assertTrue(parser.viewport)
        self.assertTrue({"upload", "title", "body", "mediaList", "editorForm", "save", "status"}.issubset(parser.ids))

    def test_offline_review_only_export(self):
        self.assertIn("publishable:false", self.source)
        self.assertIn("evidence_review_required:true", self.source)
        self.assertIn("requires_human_review", self.source)
        self.assertIn("URL.createObjectURL(blob)", self.source)

    def test_mobile_and_safe_preview(self):
        self.assertIn("@media(max-width:850px)", self.source)
        self.assertIn("textContent", self.source)
        self.assertIn('source.rel="noopener noreferrer"', self.source)


if __name__ == "__main__":
    unittest.main()
