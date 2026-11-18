"""Evidence-first review-only article drafting; no publication or AI calls."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

def _url(value):
    if not isinstance(value, str):
        return False
    try:
        p = urlsplit(value)
        return p.scheme == 'https' and bool(p.hostname) and not p.username and not p.password
    except ValueError:
        return False

def build_draft(candidate, evidence, previous=None, editor='news-engine'):
    """Only explicitly verified claims with source provenance enter draft body."""
    if not isinstance(candidate, dict) or not candidate.get('id') or not candidate.get('title'):
        raise ValueError('candidate id and title required')
    if not isinstance(evidence, list):
        raise ValueError('evidence must be a list')
    previous = previous or []
    if not isinstance(previous, list) or any(not isinstance(x, dict) or 'revision' not in x for x in previous):
        raise ValueError('invalid revision history')
    allowed = set(candidate.get('source_urls') or [])
    accepted, unresolved = [], []
    for row in evidence:
        if not isinstance(row, dict):
            raise ValueError('invalid evidence row')
        claim = row.get('claim')
        url = row.get('source_url')
        published = row.get('source_published_at')
        checked = row.get('checked_at')
        try:
            for stamp in (published, checked):
                parsed = dt.datetime.fromisoformat(stamp.replace('Z', '+00:00'))
                if parsed.tzinfo is None:
                    raise ValueError('timezone required')
            dates_ok = True
        except (ValueError, AttributeError, TypeError):
            dates_ok = False
        if (row.get('verified') is True and isinstance(claim, str) and claim.strip()
                and _url(url) and url in allowed and dates_ok):
            accepted.append({'claim': claim.strip(), 'source_url': url,
                             'source_published_at': published, 'checked_at': checked})
        else:
            unresolved.append({'claim': claim if isinstance(claim, str) else '',
                               'source_url': url if isinstance(url, str) else '',
                               'reason': 'missing verification, valid dates, or candidate provenance'})
    body = '\n\n'.join(f"{item['claim']} [来源：{item['source_url']}]" for item in accepted)
    rev = max((int(x['revision']) for x in previous), default=0) + 1
    payload = {'candidate_id': candidate['id'], 'title': candidate['title'],
               'body': body, 'evidence': accepted, 'unresolved': unresolved,
               'editorial_status': 'requires_human_review', 'publishable': False,
               'revision': rev, 'editor': editor}
    payload['content_sha256'] = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return payload

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--evidence', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--history')
    args = parser.parse_args()
    candidate = json.loads(Path(args.candidate).read_text(encoding='utf-8'))
    evidence = json.loads(Path(args.evidence).read_text(encoding='utf-8'))
    history_path = Path(args.history) if args.history else None
    history = json.loads(history_path.read_text(encoding='utf-8')) if history_path and history_path.exists() else []
    draft = build_draft(candidate, evidence, history)
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if history_path:
        history_path.parent.mkdir(parents=True, exist_ok=True)
        history_path.write_text(json.dumps(history + [draft], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
