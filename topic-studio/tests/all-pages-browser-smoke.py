#!/usr/bin/env python3
"""DAVYLAB Topic Studio: integration smoke for all pages, read-only outside test browser.
This script runs against a localhost checkout. It creates only synthetic browser localStorage.
Never logs in, reads real accounts, or publishes.
"""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parents[1]
REPORT = BASE / "qa" / "all-pages-ui-latest.json"
URL = os.environ.get("TOPIC_STUDIO_TEST_URL", "http://127.0.0.1:8765/topic-studio/")
PAGES = ["discover", "library", "visual", "calendar", "published", "workflow", "growth", "research"]
VIEWPORTS = [
    ("ultrawide", 2560, 1440),
    ("desktop", 1440, 900),
    ("tablet", 1024, 768),
    ("mobile", 390, 844),
]
SEED = [
    {
        "id":"qa-seeded-topic-001",
        "title":"DAVYLAB QA：Agent 工作流的真实边界",
        "angle":"以已有公开来源讨论可执行性",
        "summary":"合成 QA 选题，不代表真实文章或经历",
        "sourceTitle":"QA synthetic topic",
        "sourceUrl":"https://example.org/davylab-qa-agent",
        "column":"AI 实战手记",
        "format":"文章",
        "status":"inbox",
        "plannedDate":"",
        "origin":"qa-test",
        "scores":{"reader":4,"timely":3,"practical":4,"distinct":3,"brand":4},
        "createdAt":"2026-11-12T12:00:00.000Z",
    }
]


def check(condition, msg):
    if not condition:
        raise AssertionError(msg)


def stats(page, section):
    return page.evaluate(
        """section => {
          const el=document.querySelector('#section-'+section);
          const content=document.querySelector('main>.content');
          const box=el.getBoundingClientRect();
          const first=[...el.children].find(n=>n.getBoundingClientRect().width>20);
          const fr=first?first.getBoundingClientRect():null;
          return {
            visible:getComputedStyle(el).display!=='none',display:getComputedStyle(el).display,
            width:Math.round(box.width),
            firstChildLeft:fr?Math.round(fr.left-box.left):null,
            firstChildWidth:fr?Math.round(fr.width):null,
            firstChildFraction:fr?Number((fr.width/box.width).toFixed(3)):0,
            pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
            sectionOverflow:Math.max(0,el.scrollWidth-el.clientWidth),
            contentWidth:Math.round(content.getBoundingClientRect().width)
          };
        }""", section
    )


def get_local(page, key):
    return page.evaluate("(k)=>JSON.parse(localStorage.getItem(k)||'[]')", key)


def visit_section(page, section):
    page.evaluate("(section)=>changeSection(section)", section)
    page.wait_for_timeout(85)
    current=page.locator("#section-"+section)
    check("active" in (current.get_attribute("class") or ""), section+": navigation failed")
    return stats(page, section)


def scenario(page, label):
    page.goto(URL+"?qa=all-pages-v1", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_function("() => Boolean(window.DAVYLABXNews?.status().loaded && window.DAVYLABTopicPool && window.DAVYLABProductivity)", timeout=30000)
    page.wait_for_selector("#opportunityList .opportunity-card", timeout=18000)
    check(len(get_local(page, "davylab-topic-studio-v1"))>=1, label+": seed missing")
    measurements=[]
    for section in PAGES:
        measurement=visit_section(page, section)
        check(measurement["visible"],label+"/"+section+": hidden")
        check(measurement["pageOverflow"]<=3,label+"/"+section+": page horizontal overflow="+str(measurement["pageOverflow"]))
        check(measurement["sectionOverflow"]<=3,label+"/"+section+": section horizontal overflow="+str(measurement["sectionOverflow"]))
        check(measurement["firstChildFraction"]>=0.70,label+"/"+section+": first module too narrow="+str(measurement))
        check(abs(measurement["firstChildLeft"])<=28,label+"/"+section+": module not left-aligned="+str(measurement))
        check(measurement["contentWidth"]<=1530,label+"/"+section+": excessively wide content")
        if section!="discover":
            check(measurement["display"]=="block",label+"/"+section+": section root improperly treated as grid="+measurement["display"])
        measurements.append({"page":section,**measurement})
        if label in ("desktop","mobile"):
            page.screenshot(path=str(BASE/"qa"/("page-"+label+"-"+section+".png")), full_page=False)
    # Test the previously broken visual-layout geometry.
    visit_section(page,"visual")
    shell=page.locator("#section-visual .vd-shell")
    check(shell.count()==1,label+": visual studio absent")
    visual_layout=shell.evaluate("(el)=>({grid:getComputedStyle(el).gridTemplateColumns,width:el.getBoundingClientRect().width,columns:el.children.length})")
    check(visual_layout["width"]>220,label+": visual editor collapsed")
    check(page.locator("#vdChoiceCards .vd-choice").count()>=3,label+": visual options missing")
    # Growth: create an experiment only from the synthetic QA topic.
    visit_section(page,"growth")
    check(page.locator("#growthSprintDesk").count()==1,label+": growth desk absent")
    page.locator("#pdGrowthTopic").select_option("qa-seeded-topic-001")
    page.locator("#pdGrowthHypothesis").select_option("转发价值")
    page.locator("#pdCreateExperiment").click()
    growth=get_local(page,"davylab-growth-lab-v1")
    check(isinstance(growth,dict),label+": growth local state missing")
    linked=[e for e in growth.get("experiments",[]) if e.get("sourceTopicId")=="qa-seeded-topic-001"]
    check(len(linked)==1,label+": growth experiment was not created or duplicated")
    check(linked[0].get("status")=="planned",label+": growth experiment incorrectly published")
    page.locator("#pdExperimentList [data-pd-edit]").first.click()
    check(page.locator("#viralExperimentForm").get_attribute("data-edit-id")==linked[0].get("id"),
          label+": linked experiment cannot be reopened for editing")
    page.locator("#pdCreateExperiment").click()
    growth=get_local(page,"davylab-growth-lab-v1")
    check(sum(1 for e in growth.get("experiments",[]) if e.get("sourceTopicId")=="qa-seeded-topic-001")==1,label+": duplicate experiment created")
    # Research: use actual checked-in metadata, never fabricated stats.
    visit_section(page,"research")
    check(page.locator("#researchEvidenceDesk").count()==1,label+": research desk absent")
    page.locator("#pdResearchQuery").fill("Agent")
    page.locator("#pdFindSources").click()
    check(page.locator("#pdSourceList .pd-source").count()>=1,label+": no public source metadata")
    page.locator("#pdBuildBrief").click()
    brief=page.locator("#pdResearchBrief").input_value()
    check("原文：" in brief and "https://" in brief,label+": source-backed brief absent")
    check("尚未独立核验" in brief,label+": research brief missing evidence status")
    page.locator("#pdSaveBrief").click()
    stored=get_local(page,"davylab-topic-research-briefs-v1")
    check(len(stored)==1,label+": research brief not persisted")
    page.locator("#pdResearchBrief").fill(brief+"\n## QA 自定义备注：人工核查中")
    page.locator("#pdSaveBrief").click()
    stored=get_local(page,"davylab-topic-research-briefs-v1")
    check(len(stored)==1,label+": editing research brief created a duplicate")
    check("QA 自定义备注" in stored[0]["body"],label+": research brief update lost changes")
    page.locator("#pdResearchBrief").fill("")
    page.locator("#pdBriefArchive [data-pd-load]").first.click()
    check("QA 自定义备注" in page.locator("#pdResearchBrief").input_value(),
          label+": saved research brief could not be reopened")
    # Regression: bookmark always reveals exact persisted source even if status/format/search hide it.
    visit_section(page,"library")
    page.locator("#searchTopics").fill("definitely-absent")
    page.locator("#formatFilter").select_option("贴图")
    page.locator("#libraryFilters [data-status='published']").click()
    check(page.locator("#topicList .topiccard").count()==0,label+": precondition filter should hide all topics")
    visit_section(page,"discover")
    add=page.locator("#opportunityList button[data-op-add]").first
    check(add.count()==1,label+": no source available to bookmark")
    add.click()
    check("active" in (page.locator("#section-library").get_attribute("class") or ""),label+": bookmark didn't open library")
    check(page.locator("#searchTopics").input_value()=="",label+": bookmark did not clear search")
    check(page.locator("#formatFilter").input_value()=="all",label+": bookmark did not clear format filter")
    check(page.locator("#libraryFilters .active").get_attribute("data-status")=="all",label+": bookmark did not clear status filter")
    check(page.locator("#topicList .topiccard").count()>=2,label+": saved topic not displayed")
    saved=get_local(page,"davylab-topic-studio-v1")
    check(len(saved)>=2,label+": bookmark failed to persist")
    check(page.locator("#topicList .topiccard-focused").count()==1,label+": bookmark did not highlight exact topic")
    new_id=page.locator("#topicList .topiccard-focused").get_attribute("data-topic-id")
    check(any(x.get("id")==new_id for x in saved),label+": highlighted topic differs from persisted topic")
    # Saved-state card must be navigable, not disabled.
    visit_section(page,"discover")
    view=page.locator("#opportunityList button[data-op-view]").first
    check(view.count()==1,label+": saved topic card not navigable")
    view.click()
    check("active" in (page.locator("#section-library").get_attribute("class") or ""),label+": view bookmark did not navigate")
    check(page.locator("#libraryVisibleCount").count()==1,label+": library filter count absent")
    check(page.locator("#topicList .topiccard").count()>=2,label+": view bookmark cannot find saved entry")
    check(len(get_local(page,"davylab-topic-studio-v1"))>=2,label+": source bookmark lost after navigation")
    return {"viewport":label,"pages":measurements,"visual":visual_layout,
            "bookmarkPersisted":True,"bookmarkReveal":True,"growthLinkedExperiment":True,
            "researchSourceBrief":True,"overflow":stats(page,"library")["pageOverflow"]}


def main():
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    output={"status":"pass","tested_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "method":"Chromium Playwright local static test, synthetic localStorage only",
            "scope":"checkout smoke test, not production Pages or real user/account data",
            "results":[]}
    try:
        with sync_playwright() as browser_api:
            launcher={"headless":True,"args":["--no-sandbox","--disable-dev-shm-usage"]}
            system_chrome=shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
            if system_chrome:
                launcher["executable_path"]=system_chrome
            browser=browser_api.chromium.launch(**launcher)
            try:
                for name,w,h in VIEWPORTS:
                    page=browser.new_page(viewport={"width":w,"height":h},device_scale_factor=1)
                    errors=[]
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    # Initialize fake local content in the isolated QA origin.
                    page.add_init_script("window.localStorage.setItem('davylab-topic-studio-v1', "+json.dumps(json.dumps(SEED),ensure_ascii=False)+");")
                    result=scenario(page,name)
                    check(not errors,name+": runtime JS exceptions: "+" | ".join(errors[:4]))
                    result["runtimeExceptions"]=0
                    output["results"].append(result)
                    page.close()
            finally:
                browser.close()
    except Exception as err:
        output["status"]="fail"
        output["error"]=type(err).__name__+": "+str(err)
        REPORT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        raise
    REPORT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"pass","pagesPerViewport":len(PAGES),"viewports":[r["viewport"] for r in output["results"]]},ensure_ascii=False))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
