---
name: melodyme-frontend
description: Design, implement, and verify responsive MelodyMe web UI with a clear visual hierarchy, restrained styling, accessible controls, and mobile-first quality. Use for layout, styling, interaction, or frontend code changes.
---

# MelodyMe Frontend Quality

## Working posture

Adapted from the frontend workflow in https://github.com/code-yeongyu/oh-my-openagent/tree/dev/packages/shared-skills/skills/frontend. The upstream frontend skill is licensed under Apache-2.0. This file contains MelodyMe-specific operational rules rather than a verbatim copy.

Use the flow: **understand → brief → implement → subtract → verify**. Make the hierarchy intentional; do not add cards, badges, labels, gradients, or decorative elements without a job.

## Before editing

1. Read `../AGENTS.md`, `../../README.md`, and the relevant design/architecture/QA docs.
2. For an existing screen, inspect the actual current implementation and, where possible, capture a baseline before changing it.
3. Write a compact design brief in the task/PR:
   - One primary action.
   - Top three information priorities.
   - Required content and states.
   - What should intentionally be omitted.
   - Layout behavior at narrow phone and desktop widths.
4. Preserve the product flow and established design tokens. Do not invent a new visual language for a small local fix.

## Layout and visual hierarchy

- Mobile-first: validate around 320, 375/390, and 430 CSS px before desktop widths.
- Use a deliberate grid, consistent alignment, spacing scale, and clear reading order. Avoid arbitrary card stacks and competing panels.
- Keep the music/story content primary; supporting controls should not overwhelm it.
- Use consistent button heights, radius, typography, and state styling. Distinguish actions by hierarchy, not random size changes.
- Avoid repeated titles, duplicate selected-track cards, duplicate audio controls, and copy that merely repeats adjacent labels.
- Preserve appropriate image aspect ratios and prevent artwork, controls, and long text from overlapping.
- Motion must have a purpose and respect `prefers-reduced-motion`.
- All interactive controls need visible focus, meaningful labels, usable disabled/loading/error states, and touch targets of at least 44 CSS px.

## Interaction and content states

For each interactive feature, inspect default, hover where relevant, focus, pressed, disabled, loading, success, empty, error, and offline states as applicable. On touch devices, do not depend on hover.

Preserve user content across recoverable errors. Do not clear the memory/story form when catalog, AI text, or image generation fails.

## Accessibility and semantics

- Use semantic buttons, headings, labels, and landmarks.
- Ensure keyboard access and visible focus.
- Give icon-only buttons accessible names.
- Check contrast and zoom/reflow behavior.
- Avoid announcing frequent playback-time updates too aggressively to assistive technology.

## Verification gate

For UI changes:
1. Run the relevant available tests and lint/build checks.
2. Use Playwright or the project's existing browser QA when available.
3. Inspect screenshots at mobile and desktop sizes, not only a successful HTTP response.
4. Check browser console and network failures.
5. Test core flows: four-step memory journey, music search/selection, preview playback, story editing, poster generation/download, pure-text path, and back/skip behavior where relevant.
6. Record limitations honestly. Automated screenshot success does not replace physical iPhone Safari validation.

## MelodyMe non-negotiables

- Keep the four-step map-style flow, music memory story, poster modes, and pure-text path.
- Never fabricate music information.
- Never claim full-song playback or AI music generation.
- Keep AI-generated cover art visibly distinct from real album artwork.
- No UI polish may remove a meaningful existing function.
