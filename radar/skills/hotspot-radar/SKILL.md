---
name: davylab-hotspot-radar
description: Discover and evaluate source-backed AI video, podcast, and social-content opportunities for DAVYLAB; produce traceable topic cards and editorial briefs without inventing metrics or claims.
---

# DAVYLAB Hotspot Radar

## Mission
Find useful, timely AI stories and creator formats that help ordinary people understand AI, use tools, and turn ideas into working products. This skill complements Davy Radar's existing daily news workflow; it does not replace the RSS/news pipeline or the News Image Match skill.

## When to use
- Find video topics, YouTube explainers, Shorts ideas, and creator-format examples.
- Discover AI/technology podcast episodes and extract source-backed takeaways.
- Turn current AI news into differentiated WeChat public-account topics.
- Build an editorial shortlist for a human to select before drafting.

## Source hierarchy
1. Official product/company announcements and documentation for factual claims.
2. Public podcast RSS feeds and episode pages; public YouTube channel RSS feeds and video pages.
3. Public search results and Google Trends for discovery and directional interest signals.
4. Reputable technology publishers and publicly accessible creator pages.
5. Public Chinese AI media and platform pages where accessible without bypassing controls.

Use public, permitted access only. Respect robots rules, terms, rate limits, login walls, and copyright. Do not scrape private content, evade anti-bot controls, or download/reproduce full copyrighted transcripts. If a source is inaccessible, mark it inaccessible and continue with available sources.

## Workflow
1. Resolve the run date in Asia/Shanghai and the requested window. Default: last 7 days for news/episodes, with older evergreen examples clearly labeled.
2. Collect candidates from configured public RSS/Atom feeds and public YouTube channel feeds. The companion script `radar/scripts/discover_media.py` supports RSS/Atom feeds and writes JSON; it does not claim to query every platform.
3. Normalize each item to title, source, original URL, published timestamp, description/summary, content type, and collection timestamp.
4. Deduplicate canonical URLs and normalized titles. Preserve the original URL and source name.
5. Verify important claims against the original source and, when material, an independent reliable source. Distinguish fact, publisher interpretation, creator opinion, and model inference.
6. Score each candidate from 0–100 using the rubric below. Missing metrics are unknown, never zero and never fabricated.
7. Select a balanced shortlist across video, podcast, product/news, practical tutorial, and China AI where evidence allows.
8. Produce topic cards and save Markdown + JSON into the configured output location. Human approval is required before publication.

## Scoring rubric (0–100)
- Audience usefulness (0–25): practical value to ordinary people, makers, or AI tool users.
- Timeliness (0–20): recency and whether the development is still actionable.
- Evidence quality (0–20): official/primary source and independently checkable facts.
- Differentiation (0–15): a fresh angle beyond repeating the headline.
- Audience/content fit (0–10): fit with DAVYLAB's focus on accessible AI creation.
- Observable interest (0–10): only source-backed signals such as Google Trends direction, views, comments, or repeated independent coverage. If no signal is available, record "unknown" and do not invent a score; normalize scoring based on available evidence and flag low confidence.

A high score is a prioritization aid, not proof of truth or future performance. Add confidence: high / medium / low, based on source quality and metric completeness.

## Required topic-card fields
- `id`, `title`, `content_type` (video / podcast / news / tutorial / social)
- `source_name`, `source_url`, `published_at`, `collected_at`
- `summary` (brief paraphrase), `why_now`, `audience_value`
- `suggested_angle`, `headline_options`, `outline`
- `evidence_links`, `claims_to_verify`, `rights_notes`
- `score`, `score_breakdown`, `confidence`, `metrics`
- `status`: discovered / needs_verification / ready_for_editor / rejected

## Output format
For each run, provide:
1. Top 5 recommended topics, with the reason to cover now.
2. 3 backup topics and why they are lower priority.
3. A video adaptation idea and/or podcast angle when the source supports it.
4. A concise WeChat article outline with a practical takeaway.
5. Source and verification checklist.
6. JSON records suitable for GitHub storage.

Do not invent views, likes, downloads, listener counts, dates, quotes, transcripts, links, or trend direction. Do not describe a topic as "viral" without a measurable, dated signal. Summaries must be paraphrased; quotes should be short and attributed. If the available sources do not support five quality topics, return fewer and explain the gap.

## Integration
- Existing daily news pipeline: `radar/scripts/build_daily.py`
- Existing report: `radar/data/latest.json`
- New media discovery helper: `radar/scripts/discover_media.py`
- Default outputs: `radar/data/hotspot-radar/latest.json` and dated snapshots.
- Keep the existing public news brief and its publishing gates unchanged in this first iteration.
- WorkBuddy may read approved topic cards and save drafts in the official account backend; it must never publish without explicit human confirmation.

## Acceptance checklist
- Every recommended item has a working original source URL or is explicitly marked inaccessible.
- Timestamps are parsed from source metadata; unknown timestamps remain empty.
- Duplicate URLs and normalized titles are removed.
- Unknown popularity metrics are never fabricated.
- The JSON schema and script tests pass.
- No public page or official-account post is published automatically by this skill.
