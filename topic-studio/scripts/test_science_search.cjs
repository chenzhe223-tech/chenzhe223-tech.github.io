/* Standalone Node regression tests for bilingual fuzzy and synonym search. */
const assert=require("node:assert/strict");
const S=require("../science-search-utils.js");
assert.equal(S.translate("微塑料").translated,"microplastic");
assert.equal(S.translate("微塑料 肝脏").translated,"microplastic liver");
assert.equal(S.translate("人工智能").translated,"artificial intelligence");
assert.equal(S.onlineTerm("微塑料"),"microplastic");
assert.equal(S.onlineTerm("未知新术语"),"");
const paper={title:"Intrinsic physicochemical activity at microplastic–water interfaces",doi:"10.1038/s41586-026-11141-y",summary:"",authors:""};
assert.ok(S.matchScore(paper,"微塑料")>0,"Chinese query must match English title");
assert.ok(S.matchScore(paper,"microplatic")>0,"One-character English typo must match");
assert.ok(S.matchScore(paper,"microplastic")>0,"Exact search works");
assert.ok(S.matchScore(paper,"10.1038/s41586-026-11141-y")>0,"DOI search works");
assert.equal(S.matchScore(paper,"量子"),0,"Unrelated topic must not match");
assert.equal(S.matchScore(paper,"微塑料 肝脏"),0,"Multi-concept AND match prevents unrelated papers");
assert.equal(S.matchScore(paper,""),1,"Empty query shows all records");
const liver={title:"Microplastics accumulate in liver macrophages",doi:"10.1038/s41586-026-10000-a"};
assert.ok(S.matchScore(liver,"微塑料 肝脏")>0,"Compound Chinese query matches both concepts");
console.log("Science V2 bilingual fuzzy search: 12 assertions passed");
