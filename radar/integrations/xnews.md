# X News × DAVYLAB AI Radar integration

This is a **supplementary international long-read discovery channel**, not an
independent news verification service or a replacement for the daily AI brief.

## Upstream and reuse boundary

- Project: https://github.com/joeseesun/xnews
- Live journal: https://xnews.qiaomu.ai/
- RSS: https://xnews.qiaomu.ai/feed.xml
- RSS v1 contract: https://github.com/joeseesun/xnews/blob/main/content/SCHEMA.md
- Upstream website architecture: Python static build; primary Nginx VPS
  (`qiaomu-hostinger`, per upstream DEPLOYMENT.md); Cloudflare Worker fallback.
- Upstream README declares MIT licensing **for its source code**. That does not
  imply that authors' X posts, video, media, or translated articles are MIT.
  Our adapter is independently written; no upstream full-text article is copied.

## Pipeline

`radar/scripts/build_daily.py` requests RSS via the existing `http_get`
helper. `radar/scripts/xnews_sources.py` parses the RSS 2.0
`qiaomu:versions` v1 extension instead of the standard mixed
`content:encoded` field.

Only source date, original HTTPS URL/title, editorial Chinese headline, a
short labeled excerpt and X News article URL are kept. Readers can open both
the **author's original** and **X News's Chinese interpretation**. Original
full-text and media are neither embedded nor stored in DAVYLAB.

The adapter:
1. accepts only HTTPS source links and curator links from `xnews.qiaomu.ai`;
2. requires a source `pubDate` within 7 days; never equates ingestion date
   with original publication date;
3. deduplicates by original URL, then applies existing archive/history
   checks and same-day global-news matching;
4. shows up to six long-read entries with provenance and an
   "not independently verified" notice;
5. fails open when the upstream feed is offline, malformed or schema-shifted,
   leaving the core five stories, six China AI stories, Skills, daily poster,
   schedules and release workflow untouched.

New JSON fields:
- `xnews_voices`: optional array of curated long-read pointers
- `xnews_status`: `ok | no_recent | incompatible_schema | invalid_xml |
  incompatible_feed | unavailable`

The daily frontend hides this section if no qualifying items are available;
older archived reports remain compatible.

## Rollback and validation

To disable temporarily, set `RADAR_USE_XNEWS=false` on the build environment
once the optional switch has been merged; otherwise remove the isolated
`collect_xnews_articles` call in `build_daily.py`. This does not require
changing the daily deployment infrastructure.

Offline tests:
```bash
python -m unittest discover -s radar/tests -p 'test_xnews_sources.py' -v
```

Release gates: tests pass; JSON source URLs and timestamps correct; archived
dedupe works; desktop/mobile/English/Chinese cards render without overflow;
source outage does not block the original release; unchanged poster and
China AI coverage minimum. **GitHub PR creation is not production deployment.**
