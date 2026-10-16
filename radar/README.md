# Davy Radar · Daily

Daily AI news and popular public Skill repositories for DAVYLAB.

## Schedule
GitHub Actions is configured for 01:00 UTC daily (09:00 Asia/Shanghai), with manual workflow dispatch. GitHub's scheduled start can be delayed during busy periods; 09:00 is the target, not an exact-time guarantee.

## Data
- `scripts/build_daily.py` collects public RSS feeds and public GitHub repository search results.
- News retains source, timestamp and original URL. It filters AI-related titles/summaries and deduplicates headlines.
- The Skill list ranks public repositories by stars with a modest freshness adjustment. Stars are not downloads or actual usage.
- Daily JSON is published at `data/latest.json`; dated snapshots are stored under `data/archive/`.

## Horizon integration
This first version keeps the existing DAVYLAB GitHub Pages deployment and follows Horizon's daily-briefing pattern. It does not yet invoke Horizon's AI synthesis stage because that requires a model API key. The RSS/GitHub data pipeline can run without a model key. To enable Horizon summaries later, add a supported model key as a GitHub Actions repository secret (for example `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`) and configure a private, non-notifying Horizon run. Never put keys in repository files.

## Verify
Run `python radar/scripts/build_daily.py`, then open `radar/daily/index.html` through a local static server. The hosted page reads `../data/latest.json`.
