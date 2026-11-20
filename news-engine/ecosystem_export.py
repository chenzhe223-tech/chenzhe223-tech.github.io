"""P3 read-only contracts: export unverified research to ecosystem consumers.

No network, credentials, production writes, or publication side effects.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

TARGETS = ("ai_radar", "worldtoon", "vibe_studio", "wechat")

def _https(value):
    if not isinstance(value, str) or not value or any(c.isspace() for c in value):
        return False
    try:
        u = urlsplit(value)
        return u.scheme == "https" and bool(u.hostname) and not u.username and not u.password and not u.fragment
    except ValueError:
        return False

def export_contract(package, target):
    """Produce a bounded, source-linked, non-publishable JSON handoff."""
    if target not in TARGETS:
        raise ValueError("unknown target")
    if not isinstance(package, dict) or package.get("publishable") is not False or package.get("editorial_status") != "requires_human_review":
        raise ValueError("only review-only editorial packages allowed")
    title, body = package.get("title"), package.get("body")
    if not isinstance(title, str) or not title.strip() or len(title) > 300:
        raise ValueError("invalid title")
    if not isinstance(body, str) or len(body) > 30000:
        raise ValueError("invalid body")
    assets = package.get("assets", [])
    if not isinstance(assets, list) or len(assets) > 30:
        raise ValueError("invalid assets")
    clean = []
    for asset in assets:
        if not isinstance(asset, dict) or asset.get("kind") not in ("image", "video", "document"):
            raise ValueError("invalid asset")
        if not _https(asset.get("url")) or not _https(asset.get("source_url")):
            raise ValueError("invalid asset provenance")
        if asset.get("rights_status") not in ("owned", "licensed", "permission_granted"):
            raise ValueError("unlicensed asset")
        if not isinstance(asset.get("alt"), str) or not asset["alt"].strip():
            raise ValueError("missing alt")
        clean.append({key: asset[key] for key in ("kind", "url", "source_url", "rights_status", "alt")})
    sources = package.get("source_urls", [])
    if not isinstance(sources, list) or len(sources) > 30 or any(not _https(u) for u in sources):
        raise ValueError("invalid source URLs")
    # Sources can also be obtained from source-bearing editorial evidence.
    evidence = package.get("evidence", [])
    if not isinstance(evidence, list) or len(evidence) > 100:
        raise ValueError("invalid evidence")
    for item in evidence:
        if not isinstance(item, dict) or not _https(item.get("source_url")):
            raise ValueError("invalid evidence provenance")
        sources.append(item["source_url"])
    sources = list(dict.fromkeys(sources))
    if not sources:
        raise ValueError("no original source evidence")
    out = {
        "schema_version": 1, "target": target, "mode": "read_only_handoff",
        "publishable": False, "verification_status": "requires_independent_fact_check",
        "editorial_status": "requires_human_review", "external_copy_allowed": False,
        "candidate_id": str(package.get("candidate_id", ""))[:100],
        "revision": package.get("revision"), "title": title, "body": body,
        "source_urls": sources, "assets": clean,
        "instructions": "Editorial preview only. No auto-post, video rendering or comic generation.",
    }
    out["sha256"] = hashlib.sha256(json.dumps(out, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return out

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--target", required=True, choices=TARGETS)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = export_contract(json.loads(Path(args.input).read_text(encoding="utf-8")), args.target)
    dest = Path(args.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"target": args.target, "publishable": False, "sha256": result["sha256"]}))
