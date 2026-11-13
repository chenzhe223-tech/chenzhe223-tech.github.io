# WORLD/TOON V4.0 — Upgrade acceptance ledger (2026-11-13)

## Scope and truth policy
This change is a **draft PR** to the existing deployed frontend source `comic-studio/`, paired with the existing private `chenzhe223-tech/worldtoon` delivery/QA contracts. It does not overwrite legacy works, character catalogs, style catalogs, GitHub delivery artifacts or existing Supabase/D1 records.

**Live site:** https://worldtoon.chenzhe223.workers.dev/
**PR:** https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/139
**Worker and image model:** Existing Cloudflare Worker `worldtoon`; `AI_ENABLED=false` is preserved. No paid image inference is started and no publish receipt is forged.

## Implemented change by phase

### P0 — unified entry and journey
- Home presents exactly three first-class paths: 热点改编 (existing topic/AI briefs/live), 一句话创作 (local editable draft; existing DeepSeek with user confirmation), 自主创作 (title/description/theme).
- All reuse the pre-existing project record and `#/workspace/<project_id>/<step>` routing. Seven stages: 故事方案 / 角色设定 / 剧情分镜 / 视觉风格 / 正式生成 / 审阅精修 / 导出发布.
- Previous/next navigation, selected project, local modification timestamp and consistent scene editor. Existing legacy routes are preserved.
- The source mode of imported news is explicitly marked as research-required; original ideas use `handoff.mode=original` instead of inventing news URLs.
- The story stage now renders one compact story form plus the existing live DeepSeek consent panel (rather than stacking the full legacy editor); legacy advanced routes remain accessible. In the real Chrome screenshot, the mobile work page height dropped from 5,505 CSS px to approximately 3,156 CSS px.

### P1 — Character Bible
- Author-confirmed characters enter the existing shared character catalog with stable ID, editable gender/age/profession/personality, `version=1`; selection offers gender/age/profession/origin-work facets. Newly created V4 projects opt into complete AI cast enrollment; identity deduplication matches project + role + original character name, never role alone. Legacy projects retain lead-only enrollment.
- Linking a character snapshots immutable ID/version/appearance/outfit into the project; `characterOverrides` and aliases are scoped to one comic. No changes to the original asset on project edits.
- AI-proposed characters remain `pending_author_confirmation` until the author explicitly confirms their draft into a fixed v1 asset; unconfirmed actors cannot enter the reusable selector or pass the director lock. The author can explicitly synchronize the pinned assets into the director cast.
- Director formal payload adds a character-bible record only for projects with pinned character references. The storyboard production prompt uses the same pinned version in all nine panels.
- For approved/queued projects, character edits must create a revision rather than changing a locked definition. Older projects without references keep their legacy contract.

### P2 — production routing compatibility
- Reuses existing creative director/style lock, storyboard edits, native/ChatGPT producer handoff, original-image import, failed upload resume, pilot review and remote GitHub QA.
- Paid model consent and server-side image model gates remain unchanged. Generating real new 1080×1440 illustrations and guaranteeing preview-to-final identity are **NOT** demonstrated here.

### P3 — export and verification compatibility
- Adds a real local original-byte PNG ZIP builder: requires every separate native PNG and distinct cover at least 1080×1440, 3:4 aspect, valid PNG ending/decoder, rejects duplicate panels, records actual SHA256, includes caption/sources and `manifest.json` with explicit QA/author/publish=false. It never synthesizes missing images.
- A **real Chrome download, decompression, filename check and original-byte SHA256 comparison** passed using explicitly labeled synthetic solid-color PNG **test fixtures only**. This is a software packaging test, NOT validation of editorial illustrations. Existing GitHub QA and WorkBuddy remain separate.
- No destructive database migrations; route and style changes are incremental and opt-in.
- Responsive CSS and Chinese font fallback were corrected after screenshot inspection. Real Chrome desktop and 390px-touch mobile click-through passed without horizontal overflow. Authenticated multi-device GUI click tests are still required.
- Read-only Supabase inspection: existing `public.worldtoon_workspaces` is a JSONB workspace with RLS enabled; SELECT/INSERT/UPDATE/DELETE policies restrict `user_id=auth.uid()`, and `worldtoon-private` bucket is private. No DB migration or user data modification was needed. Logged-in sync itself was NOT exercised.

## Evidence and acceptance states

| Gate | Latest evidence | State |
| --- | --- | --- |
| Code Completed | Branch and draft PR #139 with real commits | PARTIAL (P0/P1 integration implemented; P2/P3 real generation/export acceptance pending) |
| Build Passed | Latest frontend PR branch: 4/4 checks green — V3/V4 regression, mobile contract, static quality, real Chrome E2E; companion private repo PR #7 contract CI green | VERIFIED CI, not real-art E2E |
| Runtime Verified | Cloudflare existing Worker identity checked; V4 branch is not on live Worker | NOT VERIFIED FOR V4 |
| Functional Tested | Real offline Chrome desktop/mobile tests: three entry creations, DeepSeek consent gate without inference, role reuse and author confirmation, story refresh, ZIP download and SHA256 comparison | PARTIAL; no authenticated online browser/model/cross-device proof |
| Production Deployed | Draft PR not merged or deployed | NO |
| Author Approved | Requires independent user decision | NO |
| WorkBuddy Ready / Published | Requires actual validated delivery and verified publisher receipt | NO |

## Mandatory end-to-end tests still outstanding
1. Three entry paths create projects under real offline Chrome (PASS); authenticated Supabase cross-device sync remains outstanding.
2. Real DeepSeek screenplay and character draft requires explicit user approval of any possible model fees.
3. The **same character ID+version** appears across validated pilot, each distinct 1080×1440 PNG and publisher ZIP.
4. Real 9+cover generation preserves the approved pilot's original PNG bytes and style lock; assess readability, anatomy, Chinese text and crop.
5. GitHub private deliverables + SHA256 checks + independent pilot approval + final author approval before WorkBuddy queue.
6. Download/unpack + file hashes passed on synthetic image fixtures (PASS TECHNICAL); the same test with complete real licensed artwork still remains outstanding.
7. Desktop, tablet, phone interaction tests; signed-in Supabase save/refresh/multi-device recovery; failure/retry without duplicate charges.
8. Merge and deploy then verify Cloudflare live runtime SHA/source parity.

**Never reinterpret passing synthetic/offline CI as proof of real model artwork.**

## Evidence links / reproducibility
- Frontend draft: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/139
- Private QA companion draft: https://github.com/chenzhe223-tech/worldtoon/pull/7
- Browser regression: `node comic-studio/tests/worldtoon-v4-browser.cjs` from a Node 22 environment with `playwright-core@1.56.1` and Chrome 157, run by `.github/workflows/worldtoon-v4-browser.yml`.
- Native role and storyboard regression: `node comic-studio/tests/worldtoon-v4-smoke.cjs`; `node comic-studio/tests/comic-engine.cjs`.
- Private contract: `python -m unittest discover -s tests -p 'test_v4_character_contract.py' -v` with `jsonschema==4.25.1`; the existing index/QA remains fail-closed.
- Browser screenshot/artifact: GitHub Actions run 43410613464 contains `worldtoon-v4-browser-evidence`, including named desktop/mobile PNG screenshots and a **test fixture-only ZIP**.

## V4.0 ongoing follow-up — 2026-11-13

- Fixed full-cast AI role import for newly created V4 works, including supporting roles and custom gender. Character upserts now deduplicate by original name plus role within one project; previously two same-role leads could incorrectly reuse an ID. Legacy enrollment defaults unchanged.
- Formal generation-step progression no longer accepts a local `stagedFiles`/`stageUploaded` count as proof of upload. Only repository-derived verified `draft_uploaded`, `ready_for_workbuddy`, `publishing` or `published` status can mark step 5 complete; remote uploaded still requires separate QA and author approval.
- Added corresponding regression assertions. These are code and isolated test protections, not proof of real artwork or publication.


## GitHub automation evidence (2026-11-13 latest)

- Frontend GitHub Actions run `43412006808`: **PASS** on real Chrome desktop/mobile, screenshot captures, three creation paths, author-confirmed AI character, refresh recovery, billing consent cancel, actual ZIP download and decompression, full 9+cover original SHA256 comparison, **tampered manifest SHA256 rejection**, and successful local ZIP importer round-trip. Browser evidence uploaded as `worldtoon-v4-browser-evidence` (artifact `14028954401`). All image contents are synthetic test fixtures, not commercial comic illustrations.
- Frontend static, mobile-layout and V3/V4 contract CI on commit `ea62a8d3f676b0906cb49febf3c08fbb2d691a2f` all PASS. Private QA repository `chenzhe223-tech/worldtoon` PR #7 schema/role-version CI on `0f29614075453a4597699c0ab98a76e4aa3ad2f8` PASS.
- V4 formal ZIPs now verify `assets[].sha256` when re-imported, and refuse wrong project ID, wrong role ID/version or mismatched style lock; verified browser behavior is strictly **local technical workflow** without remote upload or publication.
- Existing production Cloudflare Worker still represents the older deployed release; no paid model inferencing, author approval, final visual QA or verified WorkBuddy publication has occurred.
