# Task 2 — workspace explanations, map sizing and research

Status: implemented and focused verification green, 2026-10-19.
Branch: `codex/workspace-flow-field-checks`; starting base `a002719`.

## Changes

- Exported idempotent `initDisclosure(details, options={})` from `ui.js`; existing body wrappers are reused. Native details/summary semantics, Enter/Space, focus, cancellation, rapid toggles, dynamic content and reduced-motion/no-WAAPI fallback are covered. Task 3 was informed of the helper contract.
- Added compact source/freshness/completeness trust text, explicit initial/refresh/failed-refresh/archive states and a details link that opens the lower disclosure, moves focus to its summary and respects reduced motion when scrolling. Reset clears previous quality facts while retaining the static model explanation.
- Recommendation disclosures reuse validated explanation facts, include residents/radius/competition/nearest competitor and model limits. Print creates explicitly open details in the separate report DOM; CSV/storage contracts remain unchanged.
- Added fine-pointer marker preview without changing selected rank/ARIA, restricted hover lift to unselected cards and hover-capable pointers, removed selected-card entrance replay and continuous selected glow. Panel entrance distance is 12px and panel delays are capped at 90ms; existing result/counter timing remains.
- Added RAF-coalesced ResizeObserver map invalidation, dimension guards and window-resize fallback. No model calculation, fitArea, selected-rank change or zoom reset occurs during size updates. Leaflet uses synchronous `pan:true, animate:false` offset compensation to retain geographic center.
- Renamed visible scenario text to research, retained all ids/storage/schema/filenames, hid empty section/navigation, kept first-save outside it, and revealed old records or corruption/unknown-version recovery. Last-record deletion returns focus to the reachable save action after it becomes enabled.
- Scoped saved-card comparison highlighting to `input[data-testid="compare-place"]:checked`; checklist inputs do not imply comparison selection. Real saved-card interaction coverage verifies both visual states.

## RED before implementation

`playwright-cli -s=workspace-flow run-code --filename=tests/browser/workspace-interactions.js`
failed with `Compact trust summary is missing` before production edits.

An added actual-center regression also caught `pan:false`: an 80px map-height change shifted the center by 115.95m despite preserving selected rank and zoom. Changed invalidation to synchronous Leaflet offset compensation.

## GREEN verification

Shared QA server: `http://127.0.0.1:5085`; no server was started or stopped.
Isolated browser: `workspace-flow` (closed after verification).

- `workspace-interactions.js`: green, no browser errors. Covers compact/closed data details, keyboard focus/Enter/Space, rapid toggles, changing content height, repeated initialization, motion preference changed during an active closing disclosure, marker preview without selection/API changes, computed unselected hover lift 3–6px and selected-card stability, no panel/result entrance replay on layer changes, first research save/reload/old records, last deletion focus, archive trust, explicit refresh/failed-refresh trust, corrupt/unknown storage recovery, complete open print disclosures, touch, no-WAAPI and no-ResizeObserver window fallback.
- Real disclosure size check: 1-recommendation rendering with compact settings changed map height from 660px to 867px; five guarded RAF invalidations, Leaflet internal size equalled actual container size, selection/zoom remained. Center moved 1.449m (half a screen pixel at this zoom) due to Leaflet integer pixel rounding; test tolerance is one screen pixel. No forced per-frame view reset is used.
- Separate direct map-container size change: observer invalidates, internal size matches container, selection/zoom and center remain.
- `scenarios-ui.js`: 17 existing UI/storage/print/CSV/archive/quality groups green, zero page errors. Only the deliberately changed Russian guidance label was adapted.
- `scenarios.js`: 11 existing API-free restore, custom snapshot, late-response, queued-save, two-tab, filter-reset, legacy-CSV, print and catalog-race groups green, zero page errors. Opens lower data details before refresh.
- `legacy-enrichment.js`: legacy records and malformed optional metadata remain readable/exportable/printable, zero page errors.
- `redesign.js`: complete existing motion/state/accessibility/contrast/390–768–1440px/200%-text/Material-fallback suite green, zero page errors. Viewport-delayed comparison, custom-area and Material progress checks scroll their tested region into view before retaining their original motion assertions. Held-response race checks the successful automatic center calculation's district/request key/analysis id remain intact after releasing the obsolete response.
- Node syntax checks: all eight changed JavaScript modules plus the new interaction test and adapted redesign test pass (10 files).

## Integration note

Existing `redesign.js` opens and waits for the intentionally closed lower data disclosure before inspecting its warning. Its comparison/custom/Material motion regions are explicitly brought into the viewport, preserving assertions while respecting deferred entrances and browser animation rendering. The old empty-after-district-change assumption was updated, with root agreement, to verify stale-response protection against the successful automatic calculation. The full regression is green.

Changes are confined to Task 2 modules/styles, its new test/report and four existing browser-test adaptations for deliberate visible-label/data-disclosure changes. Backend, score, grid, storage schemas and API contracts were not changed.
