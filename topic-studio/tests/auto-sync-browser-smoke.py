#!/usr/bin/env python3
"""True Chromium UI exercise with two independent localStorage devices.
NO CloudBase credentials and NO public data: SDK, RLS and CAS mocked in QA only.
Passing this test is NOT live Tencent Cloud RLS or iPhone hardware acceptance.
"""
from __future__ import annotations
from datetime import datetime, timezone
import json
from pathlib import Path
from threading import Lock
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "topic-studio/qa/auto-sync-browser-latest.json"
URL = "http://127.0.0.1:8765/topic-studio/"
ENV = "excess-tiglon-d6gjc77qr6fa193f2"
LOCK = Lock()
CLOUD: dict[str, dict] = {}
CALLS: list[str] = []
USER = {"id":"synthetic-owner-not-real","email":"synthetic@example.invalid"}
VENDOR = r"""
const owner={id:"synthetic-owner-not-real",email:"synthetic@example.invalid"};
const auth={
 async getSession(){return{data:{session:{user:owner}},error:null}},
 onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},
 async signInWithPassword(){return{data:{session:{user:owner}},error:null}},
 async signInWithOtp(){return{data:{verifyOtp:async({token})=>({data:{session:{user:owner}},error:null})},error:null}},
 async verifyOtp(){return{data:{session:{user:owner}},error:null}},
 async signOut(){return{error:null}}
};
const rdb={
 rpc:(name,args={})=>window.__qaCloudBasePg({kind:"rpc",name,args}),
 from:table=>({
  select:columns=>({
   order(){return this},
   range:(from,to)=>window.__qaCloudBasePg({kind:"list",table,columns,from,to})
  })
 })
};
const cloudbase={init:({env,authMode})=>{
 if(authMode!=="cloudbase")throw Error("NATIVE_AUTH_MODE_REQUIRED");
 if(env!=="excess-tiglon-d6gjc77qr6fa193f2")throw Error("WRONG_ENV");
 return{auth:()=>auth,rdb:()=>rdb};
}};
export default cloudbase;
"""
ACTIVATION = {"schema":1,"requiredSchemaVersion":2,"environmentId":ENV,"enabled":True,
 "permissionsVerified":True,"productionApproved":True,"tombstonesVerified":True,"pollSeconds":25,
 "note":"This file is only a QA request interception, NOT production activation"}


def check(ok, message):
    if not ok:
        raise AssertionError(message)


def serve_pg(req):
    if req["kind"] == "rpc":
        name=req["name"]
        CALLS.append(name)
        if name=="davylab_ts_v1_is_allowed":
            return {"data":True,"error":None}
        if name=="davylab_ts_v1_sync_capabilities":
            return {"data":{"schema":2,"owner_allowed":True,"revision_cas":True,"tombstones":True},"error":None}
        if name=="davylab_ts_v1_delete":
            args=req["args"];ident=args["p_type"]+"::"+args["p_id"]
            with LOCK:
                prior=CLOUD.get(ident)
                if not prior or prior["revision"]!=args["p_expected_revision"]:
                    return {"error":{"message":"DAVYLAB_REVISION_CONFLICT"}}
                stamp=datetime.now(timezone.utc).isoformat();prior.update(revision=prior["revision"]+1,deleted_at=stamp,updated_at=stamp)
                return {"data":{"doc_type":prior["doc_type"],"doc_id":prior["doc_id"],"revision":prior["revision"],"deleted_at":stamp},"error":None}
        if name!="davylab_ts_v1_put":
            return {"error":{"message":"Unsupported QA RPC"}}
        args=req["args"];ident=args["p_type"]+"::"+args["p_id"]
        with LOCK:
            prior=CLOUD.get(ident)
            if (prior["revision"] if prior else 0)!=args["p_expected_revision"]:
                return {"data":None,"error":{"message":"DAVYLAB_REVISION_CONFLICT"}}
            rev=(prior["revision"] if prior else 0)+1
            CLOUD[ident]={"doc_type":args["p_type"],"doc_id":args["p_id"],
                "payload":args["p_payload"],"revision":rev,
                "deleted_at":None,"updated_at":datetime.now(timezone.utc).isoformat()}
        return {"data":{"doc_type":args["p_type"],"doc_id":args["p_id"],"revision":rev,
            "inserted":prior is None},"error":None}
    if req["kind"]=="list":
        with LOCK:
            ordered=sorted(CLOUD.values(),key=lambda r:(r["doc_type"],r["doc_id"]))
            rows=ordered[req["from"]:req["to"]+1]
            return {"data":[dict(x) for x in rows],"error":None}
    return {"data":None,"error":{"message":"Unknown QA method"}}


def prepare(page,seed=None):
    page.expose_function("__qaCloudBasePg",serve_pg)
    page.route("**/cloudbase/vendor/cloudbase-sdk-v4.mjs",lambda r:r.fulfill(
        status=200,content_type="application/javascript",body=VENDOR))
    page.route("**/cloudbase/sync-activation.json",lambda r:r.fulfill(
        status=200,content_type="application/json",body=json.dumps(ACTIVATION)))
    if seed:
        page.add_init_script(
            "localStorage.setItem('davylab-topic-studio-v1',"+json.dumps(json.dumps(seed,ensure_ascii=False))+")")


def wait_synced(page):
    page.wait_for_function(
        "() => window.DAVYLABAutoSync?.status().phase==='synced'",
        timeout=25000)


def saved_title(page):
    return page.evaluate("""() => {
        const raw=localStorage.getItem('davylab-topic-studio-v1');
        const items=JSON.parse(raw||'[]');
        return items.find(x=>x.id==='qa-two-device-topic')?.title||null;
    }""")


def update_title(page,title):
    page.evaluate("""title=>{
       const found=topics.find(x=>x.id==='qa-two-device-topic');
       if(!found)throw Error('QA source topic missing');
       found.title=title;saveTopics();
    }""",title)


def test():
    seed=[{"id":"qa-two-device-topic","title":"电脑创建·从真实需求出发",
       "status":"inbox","column":"AI 实战手记","format":"文章",
       "angle":"仅为合成测试，不是用户真实稿件",
       "summary":"公开测试样例","sourceUrl":"https://example.org/qa",
       "createdAt":"2026-11-15T00:00:00Z"}]
    record={"status":"pass","method":"Two independent Chromium contexts, QA-only mock CloudBase SDK and in-memory RLS/CAS server",
        "production_routing":"NOT USED","live_cloudbase_verified":False,
        "date":datetime.now(timezone.utc).isoformat(),"results":[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"],
                executable_path="/usr/bin/google-chrome")
            try:
                ctx_a=browser.new_context(viewport={"width":1440,"height":900})
                ctx_b=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
                a=ctx_a.new_page();b=ctx_b.new_page()
                errors_a=[];errors_b=[]
                a.on("pageerror",lambda e:errors_a.append(str(e)))
                b.on("pageerror",lambda e:errors_b.append(str(e)))
                prepare(a,seed);prepare(b)
                a.goto(URL,wait_until="domcontentloaded",timeout=30000)
                wait_synced(a)
                check(saved_title(a)==seed[0]["title"],"Device A lost its first topic")
                check("topic::qa-two-device-topic" in CLOUD,"Topic not automatically uploaded at sign-in")
                record["results"].append("Windows viewport: login session restored, initial topic automatically uploaded")
                b.goto(URL,wait_until="domcontentloaded",timeout=30000)
                wait_synced(b)
                check(saved_title(b)==seed[0]["title"],"iPhone viewport did not automatically download cloud topic")
                check(b.locator("#topicList .topiccard").count()>=1,"iPhone in-memory topic cards were not refreshed")
                check(b.evaluate("document.documentElement.scrollWidth-innerWidth")<=3,
                      "Mobile page horizontally overflowed")
                record["results"].append("iPhone viewport: same account loaded topic without clicking Sync")
                update_title(b,"手机修改·自动同步")
                b.wait_for_function("""() => window.DAVYLABAutoSync?.status().phase==='synced' &&
                    JSON.parse(localStorage.getItem('davylab-topic-studio-v1'))[0].title==='手机修改·自动同步'""",
                    timeout=25000)
                b.wait_for_timeout(1200)
                check(CLOUD["topic::qa-two-device-topic"]["payload"]["title"]=="手机修改·自动同步",
                      "Phone modification did not automatically upload")
                a.evaluate("window.dispatchEvent(new Event('focus'))")
                a.wait_for_function("""() => JSON.parse(localStorage.getItem('davylab-topic-studio-v1'))[0].title==='手机修改·自动同步'""",
                    timeout=25000)
                check(a.locator("#topicList").inner_text().find("手机修改·自动同步")>=0,
                      "Desktop card did not re-render the new title")
                record["results"].append("Phone update automatically uploaded; desktop focus refreshed the changed card")
                update_title(a,"电脑再次编辑")
                a.wait_for_timeout(1400)
                check(CLOUD["topic::qa-two-device-topic"]["payload"]["title"]=="电脑再次编辑",
                      "Reverse edit did not reach cloud")
                b.evaluate("window.dispatchEvent(new Event('focus'))")
                b.wait_for_function("""() => JSON.parse(localStorage.getItem('davylab-topic-studio-v1'))[0].title==='电脑再次编辑'""",
                    timeout=25000)
                record["results"].append("Desktop to iPhone automatic return-trip worked")
                a.evaluate("""() => {const t=topics.find(x=>x.id==='qa-two-device-topic');showPrompt(t,true);const box=document.getElementById('promptBox');box.value+='\\nQA private manual edit';box.dispatchEvent(new Event('input',{bubbles:true}));window.DAVYLABArticleTheme.openTopic(t.id);const body=document.getElementById('atBody');body.value='合成稿件：跨端恢复正文';body.dispatchEvent(new Event('input',{bubbles:true}));}""")
                a.wait_for_timeout(1600)
                b.evaluate("window.dispatchEvent(new Event('focus'))")
                b.wait_for_function("""() => Object.values(JSON.parse(localStorage.getItem('inkora-private-prompt-drafts-v1')||'{}')).some(x=>x.text.includes('QA private manual edit')) && JSON.parse(localStorage.getItem('davylab-article-theme-topics-v2')||'{}').drafts?.['topic:qa-two-device-topic']?.body==='合成稿件：跨端恢复正文'""",timeout=25000)
                record["results"].append("Per-topic article body and manually edited AI prompt arrived on other device")
                a.evaluate("""() => {if(!recordSyncDeletion('topic','qa-two-device-topic'))throw Error('delete intent failed');topics=topics.filter(t=>t.id!=='qa-two-device-topic');saveTopics()}""")
                a.wait_for_timeout(1600)
                check(bool(CLOUD["topic::qa-two-device-topic"]["deleted_at"]),"CAS tombstone not recorded")
                b.evaluate("window.dispatchEvent(new Event('focus'))")
                b.wait_for_function("""() => !JSON.parse(localStorage.getItem('davylab-topic-studio-v1')||'[]').some(x=>x.id==='qa-two-device-topic')""",timeout=25000)
                record["results"].append("Explicit delete propagated without old-device resurrection")
                check(not errors_a and not errors_b,
                      "JavaScript runtime exception(s): "+str(errors_a[:2]+errors_b[:2]))
                record["results"].append("No uncaught JavaScript exception on either viewport")
                ctx_a.close();ctx_b.close()
            finally:browser.close()
    except Exception as e:
        record["status"]="fail";record["error"]=type(e).__name__+": "+str(e)
        raise
    finally:
        REPORT.parent.mkdir(parents=True,exist_ok=True)
        REPORT.write_text(json.dumps(record,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":record["status"],"checks":len(record["results"]),"cloud_operations":len(CALLS)},ensure_ascii=False))


if __name__=="__main__":
    test()
