const assert=require("node:assert/strict");
const B=require("../bridge.js");
const snapshot={account_name:"DAVYLAB",sync_status:"synced_via_browser",last_synced_at:"2026-11-20T01:01:16+08:00",articles:[
{id:"abc",title:"文章A",url:"https://mp.weixin.qq.com/s/abc",publishedAt:"2026-11-01",format:"文章",source:"WeChat Official Account backend"},
{id:"def",title:"贴图B",url:"https://mp.weixin.qq.com/s/def",publishedAt:"2026-11-03",format:"贴图",source:"WeChat Official Account backend"},
{id:"bad",title:"未核验",url:"https://mp.weixin.qq.com/s/bad",publishedAt:"2026-11-02",source:"manual"},
{id:"abc2",title:"重复",url:"https://mp.weixin.qq.com/s/abc",publishedAt:"2026-11-01",source:"WeChat Official Account backend"}
]};
const invalid=B.publishedArchive({...snapshot,sync_status:"unverified"});
assert.equal(invalid.items.length,0);
const archive=B.publishedArchive(snapshot);
assert.equal(archive.items.length,2);
assert.equal(archive.rejected,2);
assert.equal(archive.items[0].phase,"published");assert.equal(archive.items[0].readOnly,true);
assert.equal(archive.items[1].kind,"post");
const reviews=B.legacyReviews([
{url:"https://mp.weixin.qq.com/s/abc",checkpoint:7,reads:140,reviewDate:"2026-11-08"},
{url:"https://mp.weixin.qq.com/s/def",checkpoint:30,reads:null,reviewDate:"2026-12-03"},
{url:"https://mp.weixin.qq.com/s/abc",checkpoint:7,reads:140,reviewDate:"2026-11-08"},
{url:"https://mp.weixin.qq.com/s/abc",checkpoint:30,reads:550,reviewDate:"2026-12-01"},
{url:"https://mp.weixin.qq.com/s/bad",checkpoint:7,reads:1}
],archive.items);
assert.equal(reviews.metrics.length,2);
assert.equal(reviews.ignored,3);
assert.equal(reviews.metrics[0].views,140);
const blank={assets:[],tasks:[],metrics:[],releaseDates:{}};
const once=B.mergePreview(blank,archive,reviews);assert.equal(once.added,2);assert.equal(once.metricsAdded,2);
const twice=B.mergePreview(once.next,archive,reviews);assert.equal(twice.added,0);assert.equal(twice.metricsAdded,0);
assert.equal(twice.next.assets.length,2);assert.equal(twice.next.metrics.length,2);
assert.equal(blank.assets.length,0);
console.log("PASS read-only published archive, review mapping and idempotent merge");