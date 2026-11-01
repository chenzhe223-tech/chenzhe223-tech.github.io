import json
import unittest
from unittest.mock import patch

from radar.scripts import build_daily


class FakeResponse:
    def __init__(self, final_url):
        self.final_url = final_url
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc, tb):
        return False
    def getcode(self):
        return 200
    def geturl(self):
        return self.final_url
    def read(self, size=-1):
        payload = b"<html><body>Official project documentation and installation instructions.</body></html>"
        return payload[:size] if size and size > 0 else payload


def payload(homepage="https://example.org"):
    return {
        "full_name": "demo/skill",
        "html_url": "https://github.com/demo/skill",
        "homepage": homepage,
        "description": "A practical agent skill for browser automation and workflow tasks.",
        "archived": False,
        "fork": False,
        "default_branch": "main",
        "license": {"spdx_id": "MIT", "name": "MIT License"},
        "stargazers_count": 1200,
        "pushed_at": "2026-10-30T00:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "open_issues_count": 2
    }


class SkillHomepageVerificationTests(unittest.TestCase):
    def run_candidate(self, metadata, final_url):
        readme = b"# Demo Skill\n\nInstall this agent skill from skills/agent/SKILL.md. It automates browser workflows."
        tree = {"tree": [{"path": "skills/agent/SKILL.md", "type": "blob"}]}
        responses = [json.dumps(metadata).encode(), readme, json.dumps(tree).encode()]
        with patch.object(build_daily, "http_get", side_effect=responses):
            with patch.object(build_daily.urllib.request, "urlopen", return_value=FakeResponse(final_url)):
                return build_daily.verify_skill_candidate({"name": "demo/skill", "url": "https://github.com/demo/skill"})

    def test_declared_homepage_is_http_verified(self):
        result = self.run_candidate(payload("https://example.org"), "https://example.org/docs")
        self.assertIsNotNone(result)
        self.assertTrue(result["official_website_verified"])
        self.assertEqual(result["official_website"], "https://example.org")
        self.assertEqual(result["official_website_final_url"], "https://example.org/docs")
        self.assertEqual(result["official_website_http_status"], 200)

    def test_repository_page_is_transparent_fallback_when_no_homepage_declared(self):
        result = self.run_candidate(payload(""), "https://github.com/demo/skill")
        self.assertIsNotNone(result)
        self.assertEqual(result["official_website_type"], "official_github_repository_page")
        self.assertTrue(result["official_website_verified"])


if __name__ == "__main__":
    unittest.main()
