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

### P1 — Character Bible
- Author-confirmed characters enter the existing shared character catalog with stable ID, editable gender/age/profession/personality, `version=1`.
- Linking a character snapshots immutable ID/version/appearance/outfit into the project; `characterOverrides` and aliases are scoped to one comic. No changes to the original asset on project edits.
- Director formal payload adds a character-bible record only for projects with pinned character references. The storyboard production prompt uses the same pinned version in all nine panels.
- For approved/queued projects, character edits must create a revision rather than changing a locked definition. Older projects without references keep their legacy contract.

### P2 — production routing compatibility
- Reuses existing creative director/style lock, storyboard edits, native/ChatGPT producer handoff, original-image import, failed upload resume, pilot review and remote GitHub QA.
- Paid model consent and server-side image model gates remain unchanged. Generating real new 1080×1440 illustrations and guaranteeing preview-to-final identity are **NOT** demonstrated here.

### P3 — export and verification compatibility
- Reuses existing ZIP import, standalone panel image export, private GitHub image verification and publisher queue/archive mechanisms. Actual complete nine-PNG plus cover+caption+sources verified export is **NOT** accepted until a real task satisfies all contract checks.
- No destructive database migrations; route and style changes are incremental and opt-in.
- Responsive CSS changed, desktop/mobile static contract checks exist. Authenticated multi-device GUI click tests are still required.

## Evidence and acceptance states

| Gate | Latest evidence | State |
| --- | --- | --- |
| Code Completed | Branch and draft PR #139 with real commits | PARTIAL (P0/P1 integration implemented; P2/P3 real generation/export acceptance pending) |
| Build Passed | PR CI: WORLD/TOON 3.0/4.0 regression, mobile layout contract, static quality gate; check the **latest** head status | AUTOMATED REGRESSION (not E2E) |
| Runtime Verified | Cloudflare existing Worker identity checked; V4 branch is not on live Worker | NOT VERIFIED FOR V4 |
| Functional Tested | Story-state, snapshot, QA receipt, character-prompt and route contracts under Node tests | PARTIAL; no signed-in real browser / model / cross-device proof |
| Production Deployed | Draft PR not merged or deployed | NO |
| Author Approved | Requires independent user decision | NO |
| WorkBuddy Ready / Published | Requires actual validated delivery and verified publisher receipt | NO |

## Mandatory end-to-end tests still outstanding
1. Three entry paths each create a project under real browser and authenticated sync.
2. Real DeepSeek screenplay and character draft requires explicit user approval of any possible model fees.
3. The **same character ID+version** appears across validated pilot, each distinct 1080×1440 PNG and publisher ZIP.
4. Real 9+cover generation preserves the approved pilot's original PNG bytes and style lock; assess readability, anatomy, Chinese text and crop.
5. GitHub private deliverables + SHA256 checks + independent pilot approval + final author approval before WorkBuddy queue.
6. Download and unpack real complete ZIP and verify caption/sources/manifest.
7. Desktop, tablet, phone interaction tests; signed-in Supabase save/refresh/multi-device recovery; failure/retry without duplicate charges.
8. Merge and deploy then verify Cloudflare live runtime SHA/source parity.

**Never reinterpret passing synthetic/offline CI as proof of real model artwork.**
