# Task1 — workspace layout report

Status: complete. Branch: `codex/workspace-flow-field-checks`; baseline: `a002719`.

## Scope and implementation

Owned files only:
- `static/index.html`
- `static/css/layout.css`
- `static/css/map.css`
- `static/css/responsive.css`
- `tests/browser/workspace-layout.js`
- this report

Read the user specification, the earlier workspace/design-system documentation, and the frontend-design, redesign-existing-projects and playwright-cli skills. Kept the existing Flask/ES module/Material/Leaflet stack, plum/pink tokens, local fonts, all prior HTML IDs/test IDs, data and application contracts.

The desktop grid stretches map and recommendations together. The map uses a flex column with a real minimum map area; its map canvas consumes the additional shared height. From 1024–1279px settings form a compact row above map/recommendations; from 1280px settings remain left. Smaller screens keep settings → map → recommendations in DOM order. The work-row height limit is `clamp(48rem,110dvh,76rem)`, adapting to viewport height and enlarged text. Recommendations scroll inside the labelled, keyboard-focusable `#result` region once the cap is reached; header and note stay outside the scrolling list. The settings panel can also scroll at its cap on desktop, avoiding an unbounded row with enlarged text. Mobile panels remain in ordinary document flow.

Added compact `trust-status`, `trust-summary`, `trust-details-link` hooks to the map heading. The details link points to the lower data section. Data and limitations now follow saved places and research immediately before the footer, with a default-closed native `data-details` and focusable native `data-summary`. Source/date placeholders and static limitations remain available without JavaScript. Preserved source/data-quality/data-warning/refresh-data IDs. Task2 owns the trust state, opening/focus behavior, disclosures and map ResizeObserver logic.

Moved the existing `scenario-save` action outside the conditionally hidden research section so the first research can be saved. Research navigation and section start hidden for Task2 to expose on records/recovery. Renamed static visible scenario labels to research while retaining scenario IDs. Linked Task3's `field-checks.css`.

## TDD / verification

RED: wrote and ran `tests/browser/workspace-layout.js` before production changes. The original CSS failed with map shorter than recommendations, blank remainder under map, missing shared row at 1024px, incorrect lower-section order, absent closed native details/trust hooks, save button inside research, and absent no-JS data limitations.

GREEN: final run passed 48 geometry cases:
- 1440, 1024, 768 and 390px widths, each at 100% and 200% root text size;
- zero, one and three recommendations;
- closed and expanded explanation details;
- desktop map/recommendation alignment and equal heights, no remainder below map;
- canvas height >=300px and bounded shared-row height;
- no horizontal page overflow in every case;
- mobile settings/map/recommendations order;
- labelled scroll region retains focus and End reaches its final content;
- saved → research → data → footer order, native default-closed data details, trust hooks, first-save action outside research;
- relevant action targets >=44px;
- JavaScript-disabled workspace/data content remains visible, native details opens and exposes source/refresh controls, no overflow.

Representative 100% results at a 1000px viewport height: 1440px map/recommendations both 1088.47px for zero/one closed recommendation and 1100px with long content; 1024px both 793.39px minimum and 1100px with long content. At 200% the long-content cap was 1536px, with all final actions reachable by keyboard.

Existing `tests/browser/map-harmony.js`: PASS. Verified 360/390/430/768/1440 widths and 390px at 200%, recommendation padding, all buttons >=44px, no overflow, unchanged approved map colors/opacity/outlines/rings, shared canvas count, no page errors.

Static comparison against `a002719:static/index.html`: all 101 prior IDs retained; all 106 current IDs unique. `git diff --check` passed. Desktop screenshot inspected using a temporary file outside the repository. Initial card entrances were still running during the screenshot; subsequent DOM inspection confirmed all three cards fully visible with no active animation. No screenshot committed.

Commands used isolated `playwright-cli -s=workspace-layout`, against the already running `http://127.0.0.1:5085`. The initial sandboxed Chrome launch failed due to Windows crashpad startup permissions; the escalated isolated browser session started and all tests ran successfully. No server was started or stopped. Browser session was closed after verification.

## Integration / limits

Task2 must supply the promised map resize observer, trust states, native disclosure enhancement, research recovery/visibility and JS visible-copy changes. Task3 supplies the linked field-checks stylesheet; an intermediate browser console contained a 404 for that file while Task3 was still implementing it. These files were not modified by Task1. No scoring, API, saved/scenario storage, CSV or print logic was changed here. No dependencies added.
