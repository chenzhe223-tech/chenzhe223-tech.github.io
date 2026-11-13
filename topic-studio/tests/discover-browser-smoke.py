#!/usr/bin/env python3
"""Real Chromium layout smoke tests (read-only; no account/API access).

Uses the locally hosted static site and its committed discovery metadata.
A passing report only certifies the local build at the tested commit, NOT live Pages.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "qa" / "discover-ui-latest.json"
SERVER = os.getenv("TOPIC_STUDIO_TEST_URL", "http://127.0.0.1:8765/topic-studio/")
VIEWPORTS = [
    ("desktop", 1440, 900, 3),
    ("tablet", 1024, 768, 2),
    ("mobile", 390, 844, 1),
]
STABLE_IDS = [
    "#opportunityList", "#opportunityLens", "#xnewsList",
    "#xnewsSearch", "#opportunityResearch", "#discoverIdeas",
    "#feedList", "#ideaInput", "#sourceStatus",
]


def assert_true(value, message):
    if not value:
        raise AssertionError(message)


def measure(page):
    return page.evaluate(
        """() => {
          const pageEl = document.querySelector('#section-discover');
          const list = document.querySelector('#opportunityList');
          const tiles = [...document.querySelectorAll('#opportunityList .opportunity-card')];
          const xnews = [...document.querySelectorAll('#xnewsList .xnews-card')];
          const cols = getComputedStyle(list).gridTemplateColumns.trim().split(/\\s+/).length;
          const sourceRects = ['.opportunity-hub','.xnews-hub'].map(sel => {
            const rect = document.querySelector('#section-discover '+sel).getBoundingClientRect();
            return {x:Math.round(rect.x), width:Math.round(rect.width)};
          });
          const overflow = Math.max(0, document.documentElement.scrollWidth-window.innerWidth);
          const fontSize = tiles.length ? parseFloat(getComputedStyle(tiles[0].querySelector('h3')).fontSize) : null;
          return {viewport:innerWidth, listColumns:cols, opportunityCards:tiles.length,
                  xnewsCards:xnews.length, viewportOverflow:overflow,
                  sectionOverflow:Math.max(0,pageEl.scrollWidth-pageEl.clientWidth),
                  cardTitlePx:fontSize, sources:sourceRects};
        }"""
    )


def run():
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    output = {
        "status": "pass",
        "tested_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "method": "Chromium headless via Playwright, localhost static site, no publication",
        "scope": "Local build/layout smoke test only; not a live production QA claim",
        "results": [],
    }
    with sync_playwright() as playwright:
        launcher = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if chrome:
            launcher["executable_path"] = chrome
        browser = playwright.chromium.launch(**launcher)
        try:
            for name, width, height, expected_columns in VIEWPORTS:
                page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
                page.goto(SERVER, wait_until="domcontentloaded", timeout=25000)
                page.wait_for_function(
                    "() => Boolean(window.DAVYLABXNews && window.DAVYLABXNews.status().loaded)",
                    timeout=25000,
                )
                for selector in STABLE_IDS:
                    assert_true(page.locator(selector).count() == 1, f"{name}: missing {selector}")
                measured = measure(page)
                assert_true(measured["listColumns"] == expected_columns,
                            f"{name}: expected {expected_columns} columns, got {measured['listColumns']}")
                assert_true(measured["xnewsCards"] == 6,
                            f"{name}: expected six XNews cards, got {measured['xnewsCards']}")
                assert_true(measured["opportunityCards"] > 0, f"{name}: empty opportunity feed")
                assert_true(measured["sectionOverflow"] <= 2,
                            f"{name}: discovery module horizontal overflow: {measured['sectionOverflow']}")
                assert_true(measured["viewportOverflow"] <= 3,
                            f"{name}: page horizontal overflow: {measured['viewportOverflow']}")
                assert_true(measured["cardTitlePx"] >= 14,
                            f"{name}: opportunity card title is too small")
                assert_true(abs(measured["sources"][0]["x"]-measured["sources"][1]["x"]) <= 2,
                            f"{name}: primary source sections have different left edges")
                assert_true(abs(measured["sources"][0]["width"]-measured["sources"][1]["width"]) <= 2,
                            f"{name}: primary source sections have different widths")
                page.locator(".discover-quicknav [data-discover-target='discoverIdeas']").click()
                assert_true(page.locator("#discoverIdeas").evaluate("(el) => el.open"),
                            f"{name}: original idea toolbox did not open")
                assert_true(page.locator("#discoverIdeas").is_visible(),
                            f"{name}: revealed idea toolbox is not visible")
                assert_true(measure(page)["viewportOverflow"] <= 3,
                            f"{name}: toolbox causes horizontal overflow when opened")
                page.screenshot(path=str(ROOT / "qa" / ("discover-" + name + ".png")), full_page=False)
                output["results"].append({"viewport": name, **measured, "ideaToolboxOpened": True})
                page.close()
        finally:
            browser.close()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
