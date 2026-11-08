# DAVYLAB Radar — Daily collection resilience policy (2026-11-08)

## Delivery
- Target: 08:30 Asia/Shanghai each day. GitHub Actions starts at the target time; completion depends on upstream latency. Never claim guaranteed 08:30 publication.
- Recovery: 09:15, 10:00, 10:45 and hourly watchdog later in the day. Existing preflight must skip if a complete, verified report exists.
- Never overwrite a previously valid report if a mandatory P0 check fails.

## Collection waterfall
1. Prefer publisher original pages, official release feeds and trusted RSS/Atom sources already configured in `radar/scripts/build_daily.py`.
2. Firecrawl is optional for article metadata and content extraction. Missing key, HTTP error, quota, timeout or malformed response must not prevent fallback to original feed metadata and direct source pages.
3. Rotate to independent publishers already in FEEDS / CHINA_FEEDS when the primary source fails. Keep source URL and actual article date; do not use fetch timestamp as publication date.
4. Verify claims and event dates; reject unverified/future dates. Apply 90-day exact URL/title dedupe plus cross-publisher event review.
5. If reliable candidates are insufficient, retry with alternate official feeds; never recycle old news or invent filler.

## Scope
- Deliver website news, current featured Skill and existing **website main poster** only.
- Website poster stays 1200×1800 PNG with existing ISO-week visual lock, QR and QA rules. No visual changes permitted.
- Do **not** generate WeChat graphics, six social images, ZIP packages, social caption copy or Moments promotion copy.
- Firecrawl audit integration is initially advisory, logged as an artifact; no P0 gate is weakened.

## Operational verification
- Inspect GitHub Actions job conclusion, `radar/data/latest.json` report_date, quality_gate PASS, and final public URL.
- A passing unit test or scheduled trigger is not proof that the live report was deployed.
