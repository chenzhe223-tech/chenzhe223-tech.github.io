# AI Field Notes Learning Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the existing six-topic AI Field Notes page into a four-stage learning route with real mastery checkpoints and a final applied project.

**Architecture:** Keep the existing self-contained static HTML/CSS/JavaScript architecture. Add a compact learning-stage data model, local progress state, mastery checks, and a final applied project without introducing dependencies or changing the NianBox queue protocol.

**Tech Stack:** HTML, CSS, vanilla JavaScript, GitHub Pages, localStorage.

**Spec:** `docs/superpowers/specs/2026-10-28-ai-field-notes-learning-progression-design.md`

## Global Constraints

- Preserve Pro / 普惠 toggle, glossary, flashcards, quizzes, and NianBox capture queue.
- Clearly label additions beyond the source summary as teaching supplements.
- Local learning progress must be identified as browser-local, not cross-device synced.
- Chapter completion flags represent mastery, not simply opening a topic.
- Mobile-first; avoid horizontal overflow and glyph rendering issues.

## Review Focus

- Empty, malformed, or unavailable localStorage must not break the page.
- Reloading the page must preserve completed checkpoints.
- Incorrect answers must not mark a topic as mastered and must allow retry.
- NianBox capture queue keys and payload shape must remain compatible.
- Narrow mobile screens must keep map, stage navigation, and action controls usable.

---

### Task 1: Stage navigation and learning map

**Files:**
- Modify: `ai-field-notes/index.html`

**Interfaces:**
- Stage metadata contains id, title, subtitle, topics, and stage objective.
- Existing `topics` array remains the source of six core concepts.

- [ ] Add four-stage metadata and explicit concept-to-stage mapping.
- [ ] Replace the flat-only map presentation with four stage groups and six concept stops.
- [ ] Keep SVG flags hidden until mastery state says the stop is mastered.
- [ ] Add mobile responsive layout and keyboard-accessible map controls.
- [ ] Verify source structure and responsive rules.

### Task 2: Chapter learning sequence and mastery checks

**Files:**
- Modify: `ai-field-notes/index.html`

**Interfaces:**
- Progress key: `ai-field-notes.learning-progress.v2`
- Per-topic state: `read`, `understandingPassed`, `scenarioPassed`, `mastered`
- Existing legacy key `ai-field-notes.chapter-progress.v1` may be read only for migration hints, never auto-upgraded to mastery.

- [ ] Add a consistent chapter sequence: intuition, formal definition, mechanism, boundaries, scenario question, practice challenge.
- [ ] Separate read status from mastery status.
- [ ] Require an understanding check and a scenario check before mastery; allow retries.
- [ ] Persist progress safely and render status after reload.
- [ ] Add an explicit reset/retry affordance without deleting NianBox data.

### Task 3: Four-stage goals and final applied project

**Files:**
- Modify: `ai-field-notes/index.html`

- [ ] Show a clear objective and “you can do this now” outcome for each stage.
- [ ] Add a small applied project using a safe, concrete task: map a user goal to model, workflow/Agent, reusable Skill, external tools/MCP if needed, and verification/error handling.
- [ ] Evaluate project choices with explanatory feedback; mark final milestone only after required sections are answered.
- [ ] Mark new explanatory content as “教学补充” where it goes beyond the six-article source summary.

### Task 4: Preserve capture flow and regression review

**Files:**
- Modify: `ai-field-notes/index.html` only if necessary.

- [ ] Verify the capture queue still writes `nb.learning.pending-note.v1` and retains compatible payload fields.
- [ ] Verify Pro / 普惠, glossary search, flashcards, quiz, and save actions remain present.
- [ ] Run source-level checks for required selectors, keys, function references, and malformed script syntax where available.
- [ ] Review the final diff and report what is committed versus what was runtime-tested.

## Acceptance

- Four ordered stages with goals are visible and understandable.
- Six original concepts remain available and mapped to stages.
- Reading a chapter alone does not raise mastery flags.
- Passing both a concept check and scenario check sets mastery and persists after reload.
- The applied project has feedback and a final milestone.
- Existing NianBox capture integration and glossary/learning interactions remain intact.
- No claim of live deployment or mobile runtime pass without actual verification.


## Mobile bugfix follow-up — 2026-10-29

- Removed a legacy duplicate `renderProgress()` declaration that overrode the new mastery-based map renderer. This explains why chapter mastery and map progress could disagree.
- Changed chapter-answer handling to update the existing card in place instead of rebuilding all six cards. This avoids the page jumping to a different scroll position after selecting an answer.
- Reworked Quick Quiz into a finite assessment: answer feedback and explanation, disabled answer options after submission, explicit next-question progression, final score and percentage, pass/fail threshold of 80%, and restart action.
- Latest page commit: `0f1c93b4d7b3f12cd41168fb5c97ad7c393a0830`.
- Source-level verification: JavaScript syntax passed; only one `renderProgress()` definition remains; finite quiz result/restart functions exist; NianBox queue key and four stage markers remain.
- Still pending: actual iPhone runtime verification and live Pages propagation; connected browser session was unavailable during this run.
