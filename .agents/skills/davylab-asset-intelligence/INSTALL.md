# DAVYLAB Asset Intelligence — Setup & Activation

Project-level Agent Skills are in `.agents/skills/`. This commit cannot install packages on a local Windows/WorkBuddy machine or configure your secrets; use the relevant steps below.

## Included skills
- `davylab-asset-intelligence`: routing, safety rules and app integration contract.
- `firecrawl-web`: Firecrawl CLI/extraction instructions.
- `google-lens-pro`: upstream skill, docs, scripts and license; CLI needs a local Python setup.
- `baoyu-article-illustrator`: full selected upstream folder, with prompt/style/config references and MIT license.
- `imagegen`: OpenAI ImageGen skill with references, fallback script and license.

## Firecrawl setup
```bash
npm install -g firecrawl-cli
npx -y firecrawl-cli@latest init -y --browser
firecrawl setup core
```
For GitHub Actions, configure Secret `FIRECRAWL_API_KEY` and Variable `RADAR_USE_FIRECRAWL=true` only when you intentionally want the optional article-scrape fallback. Both are required. It may consume plan quota; default publishing remains on free source-first retrieval.

## Google Lens Pro setup
In an isolated Python environment:
```bash
python -m pip install google-lens-pro
patchright install chromium
```
Manual example: `python radar/scripts/reverse_image_search.py <public-https-image-url-or-local-file>`; add `--ocr-only` to skip browser-backed matching. It is not called by the scheduled daily build. Browser behavior may be changed or rate-limited upstream.

## Baoyu Article Illustrator
The full selected folder is already copied into `.agents/skills/baoyu-article-illustrator/`. A compatible agent runtime and image-generation backend are still needed. The upstream repo also documents `npx skills add jimliu/baoyu-skills` for installing into another local runtime.

## OpenAI ImageGen
The skill is in `.agents/skills/imagegen/`. Prefer the runtime's built-in generation feature. The included `scripts/image_gen.py` is only an explicit CLI fallback and needs `OPENAI_API_KEY`; do not run it unless you choose that route. Never paste keys into chat or commit them.

## Current status
- Davy Radar's source-first image matching is retained.
- Optional Firecrawl extraction fallback is implemented but disabled by default.
- Story records include an `image_generation_prompt` handoff; GitHub Actions does not create the image from that prompt.
- Reverse-image search is manual/on-demand.
- App-wide live image APIs still require a server-side Cloudflare Worker/service, auth, secret configuration, storage, and end-to-end validation.

## Licensing
Preserve upstream license files. Google Lens Pro has dual-license boundaries: its Community Core is MIT while specific Pro modules named in its upstream LICENSE are proprietary. Check current terms before commercial use or redistribution.
