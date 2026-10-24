# DAVYLAB Skill Radar — evidence and release policy

## Pipeline

1. Discover candidate repositories through GitHub repository search across multiple Skill/Agent workflow queries.
2. Collect independent seven-day Hacker News Algolia story signals. Only exact owner/repository mentions count as repository-level evidence.
3. Verify live GitHub repository metadata, recognized SPDX license, and a readable README.
4. Require evidence that the README contains actual Skill files or installation paths (for example `SKILL.md`, `.claude/skills/`, `.codex/skills/`, `.agents/skills/`, or a documented Skill directory). MCP-only servers, ordinary software and tutorials are not treated as Skills.
5. Normalize repository identity and compare all accessible archive entries in the 90-day window. Same-day candidates are also deduplicated by identity, aliases and capability-text similarity.
6. A historical repeat is excluded unless a newer GitHub Release is independently verified after its previous recommendation and contains substantive change evidence. Only a bounded number of duplicate candidates are queried for release evidence per run.
7. Rank evidence-verified candidates using the 100-point model and preserve evidence, exclusions and history coverage in `skill_radar`.

## Score weights

- Recent heat and community evidence: 25
- AI trend relevance: 20
- Practical usefulness: 20
- Technical quality: 15
- Novelty: 10
- Maintenance recency: 10

Cumulative GitHub Stars are not historical growth. If the repository has no stored Stars snapshots, `stars_delta_7d` and `stars_delta_30d` remain null and the report says growth data is unavailable. Exact-match Hacker News links are recorded with a seven-day window. No match means no observed signal from that query, not proof that the project has no users.

## Fail-closed rules

- Missing or unreadable history prevents new Skill recommendations.
- Only live-verified repository/license/README candidates with an explicit Skill type and provenance can be selected.
- Known critical security flags, a score below 70, missing evidence, and duplicate recommendations block selection or publication.
- Incomplete archive coverage is labelled `partial`; it is never described as a complete 90-day scan.
- Static repository and README checks are not installation tests or a dedicated security audit. Those limitations remain explicit in the report.
- If the qualified list is empty, the Skill quality gate fails; the workflow must not fabricate recommendations to fill the quota.

## Durable data

Daily selected Skills and `skill_radar` diagnostics are written to `radar/data/latest.json` and `radar/data/archive/YYYY-MM-DD.json`. The daily workflow runs `radar/scripts/test_skill_radar.py` and the general release gate before publication.
