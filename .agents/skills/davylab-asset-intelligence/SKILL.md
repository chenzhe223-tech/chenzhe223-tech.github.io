---
name: davylab-asset-intelligence
description: Orchestrate source-backed image search, page image extraction, reverse image lookup, article illustration planning, and AI image generation across DAVYLAB apps.
---

# DAVYLAB Asset Intelligence

## Select the right capability
- **Find/extract images from webpages:** use Firecrawl CLI/skills when installed; in Davy Radar, preserve the free source-first flow and use Firecrawl only as an explicit secondary fallback.
- **Reverse-image search / OCR:** use Google Lens Pro on demand with a supplied reference image. Never run it for every daily story by default.
- **Article illustration planning:** use the installed Baoyu Article Illustrator and its full style/config references.
- **Create/edit bitmap assets:** use OpenAI ImageGen through the current agent's built-in image generation capability. Use its CLI fallback only when explicitly requested.
- **Existing workbench:** Dashboard Studio at https://ds.dashboard-studio-1dp.pages.dev is a web app reference, not an installable npm package or image API.

## Workflow
1. Determine placement, ratio, audience, language and whether the image must be factual documentary photography or may be an illustration.
2. Prefer original publisher/feed images or official media pages; validate URL, MIME type, dimensions, relevance and availability.
3. If needed, search Openverse/Wikimedia and preserve creator, license, license URL and image landing page. Public-web discoverability does not imply reuse permission.
4. If no suitable image can be reused, prepare a contextual illustration prompt. Clearly label the result as generated/illustrative.
5. Preserve source page, direct image URL, creator/publisher, license/attribution, retrieval time, MIME/dimensions, match status, and generated flag.
6. Do not invent sources/licenses, bypass logins or paywalls, remove watermarks, expose secrets, or present generated imagery as an actual event photo.

## Future app integration contract
Use a same-origin API / Cloudflare Worker; never expose provider credentials in browser code:
- POST /api/assets/search
- POST /api/assets/extract
- POST /api/assets/reverse-search
- POST /api/assets/illustrate
- POST /api/assets/generate
- GET /api/assets/:id/metadata

Return normalized results and provenance. Enforce URL safety, auth, rate limits, quotas, caching and licensing metadata server-side. Do not call a provider integrated until an end-to-end test passes.

## Davy Radar handoff
The scheduled pipeline matches feed/article images and available-license images. It attaches an `image_generation_prompt` for agent use, but does not generate imagery itself. Firecrawl is disabled unless explicitly enabled. Google Lens is an on-demand utility.
