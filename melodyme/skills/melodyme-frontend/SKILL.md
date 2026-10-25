---
name: melodyme-frontend
description: Implement and verify MelodyMe's mobile-first UI, responsive layout, visual hierarchy, accessibility, and design consistency.
---

# MelodyMe Frontend Engineering

Adapted for this project from the open-source [frontend skill in oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent/tree/dev/packages/shared-skills/skills/frontend). This file contains MelodyMe-specific engineering guidance rather than a vendored copy of the upstream skill. Consult the upstream license and attribution before copying any source text or assets.

## Design direction
Follow `docs/DESIGN_SYSTEM.md` as the authority. Current visual language: warm paper, deep navy, restrained lilac/rose accents, quiet dividers, editorial typography, deliberate geometry, and mobile-first composition.

## Workflow: inspect → define → build → simplify → verify
1. Read `docs/DESIGN_SYSTEM.md` and inspect the current page/components before making changes. For architectural changes, also read `docs/ARCHITECTURE.md`; for behavior changes, read `docs/QA_PLAN.md`.
2. Define the main user action and top three content priorities before changing layout. Keep required content and existing workflows.
3. Reuse existing design tokens and button/input/card patterns. Keep spacing, radii, heights, typography, focus, and disabled states consistent.
4. Remove redundancy rather than layering on more UI: duplicated selected track rows, duplicate audio players, repeated labels, decorative badges without a purpose, and competing primary actions.
5. For layout changes, state the intended reading order and mobile stacking order before editing.
6. Verify mobile and desktop behavior, including widths around 320–390 CSS px and 1024–1440 CSS px when tooling allows. Check for horizontal overflow and layout shifts.
7. Verify loading, empty, success, error, selected, disabled, and keyboard-focus states where relevant.
8. Preserve the static GitHub Pages deployment and current app behavior unless a specific feature justifies changing architecture.

## Interface quality rules
- One clearly dominant primary action per section; secondary actions should be quieter.
- Interactive touch targets generally at least 44 × 44 CSS px.
- Semantic buttons, accessible names, logical keyboard order, and visible focus rings.
- Do not use color as the only signal for state.
- Align content edges to a consistent grid; use stable aspect ratios for poster and album artwork.
- On mobile, stack panels in task order instead of squeezing them into narrow columns.
- Avoid visual density and redundant components. A selected track should not be repeated as a candidate unless the duplicate has a distinct, useful purpose.
- Respect `prefers-reduced-motion`; animations must not obstruct content or interaction.
- Do not remove existing poster modes, song selection, story, save/share flows, or plain-text paths as a side effect of visual cleanup.

## Regression checklist
- [ ] No duplicate selected track or confusing duplicate player.
- [ ] Primary action and task order are obvious.
- [ ] Buttons and form controls share consistent styles and states.
- [ ] No horizontal overflow at narrow widths.
- [ ] Focus, contrast, labels, and touch targets are usable.
- [ ] Poster, story, song search, save/share, and existing navigation still work.
- [ ] No new console errors, broken assets, or failed required network requests.
- [ ] Automated test results, deployment state, and actual device inspection are reported separately.

Do not claim an actual iPhone check unless it was performed on a real device.
