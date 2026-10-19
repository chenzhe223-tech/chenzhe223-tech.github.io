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
3. **Reuse Horizon's AI interpretation**: make visual-search phrases from the headline, What / Why / Action, and summary. Expand Chinese named entities into searchable English phrases where helpful. This uses analysis already present in the report and adds no paid-model request.
4. **Search Openverse, then Wikimedia Commons** using the original headline and expanded semantic queries. Prefer matches with clear creator/license information.
5. **Search public Bing Images results** when open image libraries miss. Validate the image URL, enforce topic/entity relevance, and keep its landing page. Treat reuse rights as unverified unless the source states otherwise.
6. **Always provide a visual**: if article and network image searches miss, choose a contextual Unsplash topic illustration. Label it as an illustration and link the image source; never imply it is the reported event's actual photo.

## Quality and integrity rules
- Never map an image based only on a broad category such as AI, technology, or business.
- Never use a random stock image as if it illustrated a particular news event.
- Treat publisher OG images as source images whose reuse terms may be unclear; don't claim they are freely licensed.
- For open-license results, preserve the license and creator information and show an attribution link when available.
- Prefer the actual event/article image. A topic image from Openverse or Wikimedia is a fallback, not proof that the image depicts the event itself.
- If no article/search image passes the relevance gate, use a contextual topic illustration rather than an empty card. Clearly label illustrations as illustrations, not event photos.
- Store a separate image_fallback_url for browser and poster recovery if the selected image later fails.
- Keep source URLs, image landing pages, attribution, license, match status and match time in structured data.
- Do not invent image URLs, licenses, creators, or attribution details.

## Horizon integration
Run python radar/scripts/news_image_match.py after python radar/scripts/run_horizon.py and before committing daily report JSON. The script enriches the curated top5, plain-news fallback cards, and China AI cards. It uses only Python standard-library modules and public sources; failures in an image source should not fail the daily news build.

## Match status values
- feed_image: a validated image supplied by the source feed.
- article_image: a validated editorial image found on the source article page.
- openverse_topic: a text-relevance-gated image from Openverse.
- wikimedia_topic: a text-relevance-gated image from Wikimedia Commons.
- web_search_topic: a text-relevance-gated public-web result.
- thematic_fallback: a topic illustration, not event evidence.
- Normal daily cards should show an image or an illustration, never the old empty-image placeholder.
