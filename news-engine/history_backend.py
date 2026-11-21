"""Isolated GitHub-backed weekly history, retained for 90 days.

Never reads or writes Radar production paths. GitHub token must only be used in a
trusted workflow_dispatch run with contents:write; PR tests do not use tokens.
"""
from __future__ import annotations

import base64
import datetime as dt
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import collector

STATE_BRANCH = "news-engine-state"
ROOT = "news-engine/state/weeks"
MAX_STATE_BYTES = 950_000


class StateConflict(RuntimeError):
    pass


def week_key(date):
    year, week, _ = date.isocalendar()
    return f"{year}-W{week:02d}"


def history_weeks(now):
    cutoff = (now - dt.timedelta(days=collector.HISTORY_DAYS)).date()
    day = cutoff
    keys = []
    while day <= now.date():
        key = week_key(day)
        if key not in keys:
            keys.append(key)
        day += dt.timedelta(days=1)
    return keys


def _validate(data, week):
    if (not isinstance(data, dict) or data.get("schema_version") != 1
            or data.get("week") != week or not isinstance(data.get("seen"), dict)):
        raise ValueError("invalid weekly history schema")
    for key, stamp in data["seen"].items():
        if not isinstance(key, str) or not isinstance(stamp, str) or not (key.startswith("url:") or key.startswith("title:")):
            raise ValueError("invalid weekly history entry")
        try:
            parsed = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("invalid timestamp in weekly history") from exc
        if parsed.tzinfo is None:
            raise ValueError("history timestamp missing timezone")
    return data["seen"]


def _api(repo, token, method, week, body=None, *, transport=None):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
        raise ValueError("invalid repository")
    if not token:
        raise ValueError("GitHub token required; refusing non-durable collection")
    path = f"{ROOT}/{week}.json"
    url = "https://api.github.com/repos/" + repo + "/contents/" + path
    if method == "GET":
        url += "?ref=" + urllib.parse.quote(STATE_BRANCH, safe="")
    headers = {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": collector.USER_AGENT,
    }
    data = json.dumps(body, separators=(",", ":")).encode("utf-8") if body is not None else None
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    op = transport or urllib.request.urlopen
    try:
        with op(request, timeout=20) as response:
            response_bytes = response.read(MAX_STATE_BYTES * 2 + 1)
            if len(response_bytes) > MAX_STATE_BYTES * 2:
                raise ValueError("oversized GitHub state response")
            return json.loads(response_bytes)
    except urllib.error.HTTPError as exc:
        if method == "GET" and exc.code == 404:
            return None
        if method == "PUT" and exc.code in (409, 422):
            raise StateConflict("concurrent state change; reload before retry") from None
        raise RuntimeError(f"GitHub state {method} failed: HTTP {exc.code}") from None


def read_week(repo, token, week, *, transport=None):
    result = _api(repo, token, "GET", week, transport=transport)
    if result is None:
        return {}, None
    if not isinstance(result, dict) or result.get("encoding") != "base64" or not isinstance(result.get("sha"), str):
        raise ValueError("invalid GitHub state response")
    raw = base64.b64decode(result.get("content", ""), validate=False)
    if len(raw) > MAX_STATE_BYTES:
        raise ValueError("weekly history exceeds GitHub Contents API limit")
    seen = _validate(json.loads(raw), week)
    return seen, result["sha"]


def write_week(repo, token, week, seen, sha, *, transport=None):
    payload = {"schema_version": 1, "week": week, "seen": seen}
    _validate(payload, week)
    raw = (json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()
    if len(raw) > MAX_STATE_BYTES:
        raise ValueError("weekly history capacity reached; refusing data loss")
    body = {
        "message": f"chore(news-engine-state): update {week} dedupe history",
        "content": base64.b64encode(raw).decode("ascii"),
        "branch": STATE_BRANCH,
    }
    if sha:
        body["sha"] = sha
    _api(repo, token, "PUT", week, body=body, transport=transport)


def merge_oldest(target, incoming):
    """Keep oldest observed date for repeated keys, never rejuvenate old news."""
    for key, stamp in incoming.items():
        if key not in target or stamp < target[key]:
            target[key] = stamp
    return target


def collect_persistently(*, repo, token, sources=None, http_get=None, now=None,
                         read=read_week, write=write_week, retries=3):
    """Optimistic transaction: recompute candidates if another run wins."""
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("timezone-aware now required")
    current = week_key(now.date())
    weeks = history_weeks(now)
    for attempt in range(retries):
        merged, current_seen, current_sha = {}, {}, None
        for week in weeks:
            seen, sha = read(repo, token, week)
            # Preserve the earliest observed timestamp when the same URL/title
            # appears in multiple weeks (including imported Radar archives).
            merge_oldest(merged, seen)
            if week == current:
                current_seen, current_sha = seen, sha
        result, updated = collector.collect(
            sources=collector.SOURCES if sources is None else sources,
            http_get=collector.fetch if http_get is None else http_get,
            now=now, history=merged,
        )
        if not result["diagnostics"] or any(d["status"] != "ok" for d in result["diagnostics"]):
            raise RuntimeError("live source validation incomplete; refusing to advance persistent state")
        additions = {k: v for k, v in updated["seen"].items() if k not in merged}
        try:
            write(repo, token, current, {**current_seen, **additions}, current_sha)
            result["history_backend"] = "github_weekly_isolated"
            result["history_week"] = current
            result["history_previous_keys"] = len(merged)
            result["history_new_keys"] = len(additions)
            return result
        except StateConflict:
            if attempt == retries - 1:
                raise
    raise StateConflict("state updated too many times")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="news-engine/data/latest-shadow.json")
    args = p.parse_args()
    result = collect_persistently(repo=os.environ["GITHUB_REPOSITORY"], token=os.environ["GITHUB_TOKEN"])
    collector.save_json(Path(args.out), result)
    print(json.dumps({"stories": len(result["stories"]), "diagnostics": result["diagnostics"],
                      "history_backend": result["history_backend"], "new_keys": result["history_new_keys"]},
                     ensure_ascii=False))
