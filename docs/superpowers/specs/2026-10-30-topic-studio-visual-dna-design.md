# Topic Studio Visual DNA Layout Customization Design

## Intent
Upgrade the DAVYLAB Topic Studio sidebar alignment and add a full Visual DNA page-layout customization system so the content workbench can adapt its information structure without changing its publishing workflow or data.

## Goals
- Make every DAVYLAB SOURCES link a consistent single-line row with aligned icon, label and external-link affordance.
- Add six real layout structures: editorial, balanced, vertical, compact, bento and split.
- Add six functional navigation modes: top, left, right, bottom, floating and hidden, with accessible recovery controls.
- Add independent controls for content width, module gap, card columns and side navigation width.
- Persist layout, navigation position/collapse state and related parameters separately from theme, font and motion settings.
- Provide immediate preview, per-category reset and safe fallback when local storage is unavailable or corrupt.
- Preserve existing business modules, DOM anchors, data models, APIs, and current responsive behavior outside the authorized presentation changes.

## Non-goals
- Do not redesign the DAVYLAB homepage or other applications.
- Do not change topic discovery, topic library, calendar, published archive, AI analysis, NianBox import, Radar ingestion, growth lab, or publishing business logic.
- Do not replace the existing theme and motion system or introduce new runtime dependencies without necessity.
- Do not alter remote data schemas or APIs.

## Approaches
1. Replace the page wholesale with a new dashboard framework: rejected because it risks existing business workflows and data compatibility.
2. Add CSS-only layout presets without real module placement or navigation behavior: rejected because it would only simulate customization.
3. Extend the existing vanilla HTML/CSS/JS settings system with layout tokens, data attributes and responsive CSS: selected because it fits the current architecture and minimizes regression risk.

## Architecture
Keep the current single-page static HTML architecture. Add an independent versioned layout settings object within the existing Visual DNA settings key, with backward-compatible defaults. Use body data attributes/CSS grid areas for six layout structures and navigation modes. Keep module content and IDs intact; assign layout roles to existing section modules rather than cloning or moving business DOM. Add a single accessible navigation recovery trigger for hidden/floating/collapsed modes. All user settings remain client-side and separate from topic data.

## Visual rules
- QORE ice-blue glass visual identity remains the default.
- Main content uses at least 90% of the available width after navigation is accounted for.
- Cards in the same grid row stretch consistently without forced fixed heights.
- Sidebar source links use fixed row geometry, nowrap labels, ellipsis and a right-aligned external-link affordance.
- Desktop, tablet and mobile each have explicit navigation and layout fallbacks.
- Respect keyboard navigation, focus-visible, Escape, touch interaction and prefers-reduced-motion.

## Acceptance
- Six layouts visibly change module structure and are not color-only variants.
- All six navigation modes work with keyboard and touch, including hidden-navigation recovery.
- Layout width, gap, columns, and sidebar width update immediately and persist after reload.
- Layout reset does not reset theme, font or motion; theme reset does not reset layout.
- Malformed or unavailable localStorage does not break page initialization.
- At 1440px, 1024px, 768px, 390px and 360px there is no unintended horizontal overflow, clipped primary action, or navigation overlap.
- Existing business workflows and stored topic data remain unchanged.
- Deployment status is reported only after verifying the deployment workflow and live page.
