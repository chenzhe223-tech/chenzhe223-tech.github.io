---
name: news-image-match
description: Match each DAVYLAB AI briefing story to a relevant, traceable image. Use after Horizon has selected and summarized stories, before publishing JSON or generating the daily poster.
---

# News Image Match Skill

## Purpose
Assign each news card its own image that is tied to the article or to the specific entities/event it covers. This skill complements Horizon; it does not replace news collection, source verification, ranking, or translation.

## Required order
1. **Use the feed-provided editorial image first** when the RSS/Atom item contains an image enclosure, media thumbnail, or image embedded in its summary. Validate the URL before publishing.
2. **Inspect the original article page** and prefer og:image, og:image:url, twitter:image, twitter:image:src, or link rel=image_src. Keep the article URL as the provenance page. Do not scrape behind logins or bypass access controls.
3. **Search Openverse** only if the source page has no usable image. Use the story's original headline and named company, person, product, or event. Require lexical/entity relevance between the story and image title/landing page. Preserve creator, landing page, license and license URL.
4. **Search Wikimedia Commons** if Openverse has no suitable candidate. Preserve the file page, creator, license, and required attribution.
5. Reject broken URLs, non-image responses, tracking pixels, obviously generic results, unrelated entities, duplicates already assigned to a different story, and candidates without enough relevance evidence.

## Quality and integrity rules
- Never map an image based only on a broad category such as AI, technology, or business.
- Never use a random stock image as if it illustrated a particular news event.
- Treat publisher OG images as source images whose reuse terms may be unclear; don't claim they are freely licensed.
- For open-license results, preserve the license and creator information and show an attribution link when available.
- Prefer the actual event/article image. A topic image from Openverse or Wikimedia is a fallback, not proof that the image depicts the event itself.
- If no candidate passes the gate, publish no image for that card and use a restrained "暂无可靠配图 / No verified image" placeholder.
- Keep source URLs, image landing pages, attribution, license, match status and match time in structured data.
- Do not invent image URLs, licenses, creators, or attribution details.

## Horizon integration
Run python radar/scripts/news_image_match.py after python radar/scripts/run_horizon.py and before committing daily report JSON. The script enriches the curated top5, plain-news fallback cards, and China AI cards. It uses only Python standard-library modules and public sources; failures in an image source should not fail the daily news build.

## Match status values
- feed_image: a validated image supplied by the source feed.
- article_image: a validated editorial image found on the source article page.
- openverse_topic: a text-relevance-gated image from Openverse.
- wikimedia_topic: a text-relevance-gated image from Wikimedia Commons.
- none: no qualifying image found; render a placeholder instead of a generic photo.
