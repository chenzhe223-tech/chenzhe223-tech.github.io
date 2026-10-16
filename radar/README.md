# Davy Radar · Daily

Daily AI news, a public GitHub Skill shortlist, and an optional Horizon-powered Chinese AI briefing for DAVYLAB.

## Schedule
GitHub Actions is configured for 01:00 UTC daily (09:00 Asia/Shanghai), with manual workflow dispatch. GitHub may delay scheduled starts during busy periods; 09:00 is the target, not an exact-time guarantee.

## Data pipeline
- `scripts/build_daily.py` collects public RSS feeds and public GitHub repository search results.
- News retains source, timestamp and original URL; AI-related headlines are filtered and deduplicated.
- The Skill list ranks public repositories by stars with a modest freshness adjustment. Stars are not downloads or actual usage.
- `scripts/run_horizon.py` runs the upstream MIT-licensed [Horizon](https://github.com/Thysrael/Horizon) project with DeepSeek, then attaches its Chinese daily digest to `data/latest.json`.
- `config/horizon.json` contains only non-secret runtime configuration. The API key is read from the GitHub Actions secret `DEEPSEEK_API_KEY`; never commit the key itself.
- Horizon webhook, email, and WeChat delivery are disabled. Results are published only to the website; no active notifications are sent.
- If AI analysis fails, the public RSS/GitHub report remains available and the page shows a non-sensitive status message.

## Published data
- Latest report: `data/latest.json`
- Daily snapshots: `data/archive/`
- Horizon runtime summaries: `data/horizon-data/summaries/` (generated in Actions; not required to be committed)
- Public page: https://chenzhe223-tech.github.io/radar/daily/

## Verification
The workflow logs show whether Horizon completed and whether the Chinese summary was attached. Public source links remain the basis for checking claims; model-generated analysis is editorial assistance, not independent verification.
