# WORLD/TOON · AI九格镜头表 / 2026-11-11

## Objective and scope
The production page `#/director` now automatically prepares a nine-panel screenplay when the author opens Step 03 with nine empty scenes. It derives context from the selected project's title, category, source summary, fictionalization, approved cast, series episode hints, selected style and narrative arc (including `反转寓言`). The output is **text/storyboards only, never a claim that completed comic images exist**.

## Generation modes
- **Default native AI (authenticated)**: existing Cloudflare Workers AI binding `@cf/google/gemma-4-26b-a4b-it`, per-account and per-user quotas. New `POST /api/ai/storyboard`, independent from `AI_ENABLED` which continues to gate the **disabled** A-track image and legacy script endpoints. Requires a valid Supabase user token, valid story, 2+ distinct cast descriptions and 9 valid AI results. Model's current listing was verified via Cloudflare model catalog; production end-to-end generation with a real signed-in user remains an explicit final test.
- **Fallback native rules**: if signed out, model binding unavailable, or AI request fails, generate a source-specific nine-panel *local structured draft*, labeled `local_structure_rules` and `非大模型输出`. No fake model provenance. Revisit and regenerate after logging in.
- **Bring your own API**: DeepSeek, OpenAI, Claude, Gemini, Kimi and Qwen. The Worker uses fixed HTTPS endpoints and provider-specific request formats; user-supplied model IDs must match that provider's model-name prefix. Keys are request-scoped, and the user confirms before a call that may incur provider charges. This integration is for storyboards; the full comic production handoff remains a separate workflow.
- **Manual correction**: five editable text fields per panel; independently supports title, scene, caption, dialogue, visual prompt. “仅填补空白字段” preserves existing edits; overwrite requires confirmation. Never overwrite uploaded art. Official queued tasks cannot have their creative inputs replaced.

## Persistence and approval
- `creativeDirection.storyboardProvenance`: `method`, `provider`, `model`, `at`, `analysis`, `authorEdited` (later human edits).
- `creative_direction.storyboard_generation` travels with approved ChatGPT handoff tasks but **never contains API keys**.
- The existing creator-controlled author review checkbox, original first-frame gate, full nine-panel QA and WorkBuddy publication approval remain mandatory and unchanged.

## Security & billing
`POST /api/ai/storyboard` requires Supabase authentication and bounded JSON, enforces daily per-user and global quota, and returns `no-store` results. It does not proxy arbitrary user URLs. API keys are used only for the selected upstream call and are not written to workspace data, database rows, browser storage or logs. The native model uses existing account resources and can consume Workers AI allowance; no provider call is issued automatically in BYOK mode. This endpoint creates screenplay text only; finished art still follows the existing production, GitHub QA and author-review workflow.

## Verification
- Unit contract and mocks: `.github/workflows/worldtoon-storyboard-ai.yml` tests nine-frame validation, native model path, provider restriction, no login, real user change protection, ephemeral key, provenance.
- Live source and browser: `.github/workflows/worldtoon-storyboard-live.yml` tests Cloudflare `/api/config`, unauthenticated endpoint rejection (HTTP 401), mobile 390px and desktop 1440px new fictional project creation, auto local fallback, 9 scenes, original author dialogue edits, no horizontal overflow, no API key in localStorage.
- Cloudflare Worker version `6d40f3b8-cf2c-4c76-9585-91a743e47170`, deployment `8bbae581-33ca-43b4-a079-8e7f5e6c29ad`, all 5 existing service bindings inherited.
- Browser CI: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/42962108331
- Unit CI: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/42961940015

### Outstanding proof
1. Genuine `@cf/google/gemma-4-26b-a4b-it` inference from an authenticated production user token: **NOT YET TESTED LIVE**. Mock tests and public model catalog availability do not establish actual quality or free allowance. No unauthorized paid model inference should be triggered solely for QA.
2. Real third-party network success (DeepSeek, OpenAI, Claude, Gemini, Kimi and Qwen): **NOT TESTED LIVE** without user-provided keys and explicit consent for provider billing. Do not report a provider as connected until a real authorized request succeeds.
3. Future visual image production and 9 real PNG deliveries remain entirely separate and require visual QA.

