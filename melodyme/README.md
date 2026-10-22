# MelodyMe — Phase 1 product foundation

> 每一首歌，都是你走过的路。  
> 用音乐，记录更真实的你。

MelodyMe is an AI-assisted music-memory and personal storytelling product concept. This folder contains the Phase 1 interactive web prototype and implementation documents.

## Current status
- Product discovery / UI prototype: in progress.
- The prototype supports local-only memory drafting, editable story text, a visual poster preview, and a local timeline.
- It does **not** yet call a real AI model, play or stream copyrighted music, authenticate users, sync across devices, or publish private memories.
- Browser-local prototype data is not a substitute for a production database and may be cleared by the user/browser.

## Open locally
Open `index.html` in a modern browser. No build step is required for the prototype.

## Documents
- [Product requirements (PRD)](docs/PRD.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [QA plan](docs/QA_PLAN.md)

## Architecture direction (not yet implemented)
Keep the client lightweight; introduce server-side API boundaries for AI; use Supabase Auth/Postgres/Storage with RLS for user-owned data and Cloudflare Workers for secrets and server-side orchestration only after provider choices and deployment access are verified. Never expose provider secrets in frontend code.

## Product principles
1. One sentence is enough to start.
2. A memory is private by default.
3. AI proposes; the user decides.
4. Music metadata and playback must come from a lawful, verified source.
5. No feature is marked production-ready without real tests and evidence.
