# AI Field Notes — AI World Atlas Design Spec

Status: V2 preview, deployed to GitHub Pages
Entry: https://chenzhe223-tech.github.io/ai-field-notes/v2/
Original V1 remains at: https://chenzhe223-tech.github.io/ai-field-notes/

## Product thesis

AI Field Notes is not a course catalog with a map illustration. It is a personal atlas of the AI world. Learning is the act of surveying territory, practice establishes a trail, demonstrated understanding turns a region into known land, and the unexplored frontier remains visible as an invitation to wonder.

Core line: **已知的，持续深入；未知的，保持好奇。**

## Cartographic interaction model

Each knowledge region has one of three states:
- `known`: the learner has explored and marked the region as understood; the territory is shown as surveyed.
- `exploring`: the learner has begun studying it; the region is shown as an active expedition.
- `unknown`: the region is visible but not yet learned; the map should communicate curiosity, not failure.

The states belong to the learner's personal map. In this preview they are stored in browser-local storage only. When account sync is implemented, these states must become user-owned records linked to the exact lesson/release used. A completion event from a lesson should update the matching map region. A user should also be able to reopen a known region to explore deeper questions.

### Mapped regions in the current prototype

1. 起点营地 — a starting marker, not a claimed completed knowledge area
2. 模型山脉 — models, context and limits
3. 提示词峡谷 — prompt and context design
4. Agent 群岛 — agents, workflows and decisions
5. 工具调用港湾 — tools, MCP and permissions
6. 知识库森林 — retrieval, RAG and traceable sources
7. 自动化边境 — workflow engineering and verification
8. 创造者之城 — personal projects and AI applications
9. 未知海域 — future topics without a fixed syllabus

These names are an authored metaphor for navigation. They are not claims that the listed taxonomy exhausts the AI field or that all areas are equally mature.

## Visual principles

- Map is the primary workspace and should receive the largest visual area on the homepage.
- Draw known territory in surveyed tones, the active trail in warm gold, and the frontier in dashed outlines and fog.
- Keep the central map cinematic but legible: restrained navy sea, muted land colors, sparse topographic lines, coordinate labels, compass and route.
- Avoid high-saturation gradients and excessive glow. Motion should hint at tide, drifting current and frontier fog rather than compete with content.
- The map node selection panel exposes the region description, topics, status, suggested next step and a clear action.
- Filter controls should expose all, known, in-progress and unknown areas.
- The unknown territory must remain visible even when the learner makes progress; this is a key product meaning, not an empty-state failure.

## Interaction requirements

- Selecting a region updates the detail panel without leaving the map.
- Atlas metadata comes from the D1-backed `/api/atlas/regions` endpoint; the first visit starts at the base camp, while content regions begin unexplored. A saved browser map is not overwritten by late API defaults.
- The archive page reads published course and version records from D1; the DAVY Radar page reads the versioned D1 index and shows a per-source history panel.
- Filters apply a visible state change to nodes.
- Starting an unknown region makes it `exploring`; marking an exploring region known updates the personal map and progress summary.
- Completing a lesson updates its associated map region.
- A known region can be reopened for deeper learning instead of becoming a dead end.
- Persist region states and a bounded exploration event trail locally; derive progress metrics from these records rather than fake counters.
- Offer JSON export/import to back up or move the personal map between browsers while cloud account sync is not yet implemented.
- DAVY Radar's public JSON is indexed hourly by a Cloudflare Cron Trigger. Its metadata changes produce new D1 snapshots; this source-index refresh is separate from automatic generation or publication of lessons.
- Confirm before resetting local map progress.
- Keyboard users can focus each map region and activate it with Enter or Space.
- Touch targets should be designed for touch use; reduce reliance on hover.
- Respect `prefers-reduced-motion`; animations should be CSS-transform/opacity based and nonessential.
- Mobile map should be horizontally scrollable so the full map, including the unknown frontier, remains discoverable rather than being cropped out.

## Open-source design skill references applied

### UI/UX Pro Max
Repository: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
MIT licence. Its UI/UX guidance was consulted for design consistency, responsive layout, accessibility and interaction-state review. This prototype applies the guidance manually; it does not bundle the CLI or copy its data files into the product.

### Official GSAP AI Skills
Repository: https://github.com/greensock/gsap-skills
MIT licence. The core and performance guidance was consulted for restrained animation, reduced-motion support, avoiding layout-heavy animation and keeping motion nonessential. The current map uses native SVG/CSS and does not load GSAP, to avoid adding an unnecessary dependency to this static preview.

## Data and privacy boundary

- This prototype does not require login and does not upload personal map state to the server.
- Local map key: `ai-field-notes.atlas-preview.v1`.
- The backend API and D1 schema are scaffolding. Do not label cloud sync, real search, paid entitlements or automatic content generation as complete.
- Do not use sample progress numbers as real learner analytics.
- Never replace the V1 source page while iterating on V2.

## Next engineering steps

1. QA the map in mobile Safari/Chrome, including horizontal pan and touch target selection.
2. Connect release/lesson records to D1-backed public read APIs and show actual source-backed lesson metadata.
3. Add secure account identity and server-authorized progress persistence.
4. Define map-region-to-lesson mappings in data rather than hardcoding all mappings in front-end code.
5. Integrate DAVY Radar records as discoverable map signals with source links and explicit publication dates.
6. Add real search: keyword search first, then evaluate a semantic search model against a fixed test set.
7. Add payments only after identity, entitlement checks, callback signature verification, refund/cancel/expiry behavior and test cases are complete.
8. Keep automatic content updates as drafts until evidence, link, structure and practice checks pass; publish immutable releases only.
