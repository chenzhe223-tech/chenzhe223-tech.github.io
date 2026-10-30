# Topic Studio Visual DNA Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the DAVYLAB SOURCES sidebar rows and add six real page layouts plus six accessible navigation modes to Topic Studio.

**Architecture:** Extend the existing static HTML/CSS/vanilla-JS Visual DNA settings system. Persist a versioned layout configuration alongside the existing theme and motion settings, but keep each settings category independently resettable. Use data attributes and CSS grid areas to rearrange existing modules without changing business logic or data structures.

**Tech Stack:** HTML, CSS Grid/Flexbox, vanilla JavaScript, localStorage, existing GitHub Pages workflow, Playwright if available in the repository.

**Spec:** `docs/superpowers/specs/2026-10-30-topic-studio-visual-dna-design.md`

## Global Constraints
- Preserve existing topic data, APIs, business module IDs, and workflows.
- Do not modify the DAVYLAB homepage or other applications.
- Do not add runtime dependencies unless existing test infrastructure requires them.
- Theme, layout, navigation, typography and motion settings remain independently configurable and resettable.
- Respect prefers-reduced-motion and keyboard/touch accessibility.
- Layouts must use real module placement changes, not just different colors.

## Review Focus
- Corrupt or unavailable localStorage must safely fall back to defaults without preventing page startup.
- Long sidebar labels and narrow sidebars must not wrap the external-link arrow onto a second line.
- Hidden navigation must always retain a keyboard/touch accessible recovery trigger.
- Left/right navigation on mobile must not cover the primary title or first-screen action.
- Switching layout/navigation repeatedly must not duplicate controls, lose active section state, or alter business data.

---

### Task 1: Add regression coverage and map current module roles

**Files:**
- Inspect: `topic-studio/index.html`
- Inspect: existing repository test/workflow files (do not change unrelated workflows)
- Create or modify: existing frontend regression test location if present

**Interfaces:**
- Produces a verified list of existing section/module IDs and the test entrypoint used by later tasks.

- [ ] **Step 1: Inspect existing test scripts and workflows**
Run repository file search for Playwright, package scripts and GitHub Actions workflow configuration. Record the actual test command; do not invent one.
- [ ] **Step 2: Add failing structural assertions**
Cover source-link nowrap/ellipsis geometry, layout preset values, navigation mode values, and storage isolation between layout and theme.
- [ ] **Step 3: Run the focused tests**
Expected: FAIL because the new layout controls and behavior are not implemented.
- [ ] **Step 4: Commit the regression test baseline**

### Task 2: Repair DAVYLAB SOURCES navigation geometry

**Files:**
- Modify: `topic-studio/index.html` sidebar navigation CSS and the four DAVYLAB SOURCES anchors.

**Interfaces:**
- Source navigation rows retain the existing anchor hrefs and labels; CSS classes provide stable icon, label and external-link affordance.

- [ ] **Step 1: Write a regression test** asserting each source row has a single-line label region, ellipsis behavior, consistent min-height and a separately aligned trailing external-link marker.
- [ ] **Step 2: Run the test and confirm it fails** on the current wrapping behavior.
- [ ] **Step 3: Implement** `.source-nav`, `.source-nav__label` and `.source-nav__external` with grid/flex alignment, min-width:0 and white-space:nowrap; preserve all existing destinations.
- [ ] **Step 4: Run desktop and narrow-sidebar tests** at 1440px, 1024px and 390px.
- [ ] **Step 5: Commit** `fix: align topic studio source navigation`.

### Task 3: Implement six layout presets and independent layout persistence

**Files:**
- Modify: `topic-studio/index.html` layout settings dialog, Visual DNA settings defaults/read/write/apply functions and section module layout CSS.

**Interfaces:**
- Layout config shape: `{ preset: "editorial"|"balanced"|"vertical"|"compact"|"bento"|"split", contentWidth: "full"|"wide"|"standard"|"custom", customWidth: number, gap: number, columns: 2|3|"auto" }`.
- Navigation config shape: `{ mode: "left"|"right"|"top"|"bottom"|"floating"|"hidden", sidebarWidth: number, collapsed: boolean, drawerOpen: boolean }`.
- Settings read/write must merge defaults and tolerate legacy values and malformed JSON.

- [ ] **Step 1: Add failing tests** for all six preset identifiers, immediate application, independent reset and persistence after reload.
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Add the Page Layout tab** with six selectable preview tiles and controls for width, gap, columns and sidebar width.
- [ ] **Step 4: Add layout role attributes** to existing modules without changing their IDs, content, or business event handlers.
- [ ] **Step 5: Implement six CSS grid-area definitions** with explicit desktop/tablet/mobile fallbacks; ensure available content area uses at least 90% width after navigation.
- [ ] **Step 6: Implement versioned settings migration and category-specific reset** so layout reset cannot overwrite theme, font or motion.
- [ ] **Step 7: Run layout/persistence tests** including corrupted and unavailable localStorage cases.
- [ ] **Step 8: Commit** `feat: add customizable topic studio layouts`.

### Task 4: Implement six navigation modes and accessibility

**Files:**
- Modify: `topic-studio/index.html` navigation markup, navigation settings controls, responsive CSS and event handlers.

**Interfaces:**
- Navigation modes use the Task 3 `navigation.mode` values.
- One recovery control with stable ID `visualNavRecovery` remains available in floating/hidden modes and exposes `aria-expanded` and `aria-controls`.

- [ ] **Step 1: Add failing tests** for top/left/right/bottom/floating/hidden, keyboard recovery, Escape, click-outside, touch, and mobile left/right drawer fallback.
- [ ] **Step 2: Run tests and confirm failure.**
- [ ] **Step 3: Implement** navigation positioning, collapse/expand and drawer behavior without changing section navigation targets.
- [ ] **Step 4: Verify** switching modes clears stale drawer state and synchronizes aria attributes.
- [ ] **Step 5: Verify** at 768px, 390px and 360px that navigation never obscures the title or first-screen primary action.
- [ ] **Step 6: Commit** `feat: add accessible topic studio navigation modes`.

### Task 5: Full regression, visual QA and deployment verification

**Files:**
- Inspect/modify only relevant tests and `topic-studio/index.html`.

- [ ] **Step 1: Run the complete existing test suite** and the new regression tests.
- [ ] **Step 2: Run browser checks** at 1440px, 1024px, 768px, 390px and 360px; verify page identity, no blank/error overlay, console health, screenshots and at least one complete layout/navigation interaction loop.
- [ ] **Step 3: Verify persistence** for one combination of theme, custom color, layout, navigation, typography and content width after reload.
- [ ] **Step 4: Verify original workflows**: topic discovery, topic pool, calendar, published archive, AI analysis, NianBox import UI and growth lab.
- [ ] **Step 5: Check GitHub Pages deployment run** and then verify the live URL. Do not claim deployment success based on a commit SHA alone.
- [ ] **Step 6: Commit** final verified changes and report any untested browser/viewport or known limitations.

