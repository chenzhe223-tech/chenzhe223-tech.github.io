"""Review-only editorial media pool. No publication or production integration."""
import argparse
import hashlib
import html
import json
from pathlib import Path
from urllib.parse import urlsplit

def safe_url(url):
    if not isinstance(url, str) or any(c.isspace() for c in url): return False
    try:
        u=urlsplit(url)
        return u.scheme == 'https' and bool(u.hostname) and not u.username and not u.password
    except ValueError: return False

def assemble(draft, assets):
    if not isinstance(draft, dict) or draft.get('publishable') is not False or draft.get('editorial_status') != 'requires_human_review':
        raise ValueError('review-only draft required')
    if not isinstance(draft.get('title'),str) or not isinstance(draft.get('body'),str): raise ValueError('invalid draft')
    if not isinstance(assets,list) or len(assets)>30: raise ValueError('invalid assets')
    clean=[]; ids=set()
    for a in assets:
        if not isinstance(a,dict) or not isinstance(a.get('id'),str) or not a['id'].strip() or a['id'] in ids: raise ValueError('duplicate or invalid asset id')
        if a.get('kind') not in ('image','video','document') or not safe_url(a.get('url')) or not safe_url(a.get('source_url')): raise ValueError('HTTPS media and provenance required')
        if a.get('rights_status') not in ('owned','licensed','permission_granted') or not isinstance(a.get('alt'),str) or not a['alt'].strip(): raise ValueError('rights and alt text required')
        ids.add(a['id']); clean.append({k:a[k] for k in ('id','kind','url','source_url','rights_status','alt')})
    out={'schema_version':1,'editorial_status':'requires_human_review','publishable':False,'candidate_id':draft.get('candidate_id'),'revision':draft.get('revision'),'title':draft['title'],'body':draft['body'],'assets':clean,'layout':[{'type':'headline'},{'type':'body'}]+[{'type':'asset','asset_id':a['id']} for a in clean]}
    out['sha256']=hashlib.sha256(json.dumps(out,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    return out

def preview(package):
    if package.get('publishable') is not False: raise ValueError('unpublished only')
    e=lambda s: html.escape(str(s),quote=True)
    figures=''.join('<figure><a rel="noopener noreferrer" href="'+e(a['source_url'])+'">Source</a><figcaption>'+e(a['alt'])+'</figcaption></figure>' for a in package['assets'])
    return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Editorial preview</title><style>body{font:16px/1.7 system-ui;max-width:760px;margin:auto;padding:clamp(16px,4vw,40px);overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><main><strong>未审核草稿 · 禁止发布</strong><h1>'+e(package['title'])+'</h1><pre>'+e(package['body'])+'</pre>'+figures+'</main></html>'

if __name__=='__main__':
    p=argparse.ArgumentParser()
    for arg in ('draft','assets','out','preview'): p.add_argument('--'+arg,required=True)
    a=p.parse_args()
    pack=assemble(json.loads(Path(a.draft).read_text(encoding='utf-8')),json.loads(Path(a.assets).read_text(encoding='utf-8')))
    for name,data in ((a.out,json.dumps(pack,ensure_ascii=False,indent=2)+'\n'),(a.preview,preview(pack))):
        dest=Path(name); dest.parent.mkdir(parents=True,exist_ok=True); dest.write_text(data,encoding='utf-8')
    print(json.dumps({'assets':len(pack['assets']),'publishable':False,'sha256':pack['sha256']}))
