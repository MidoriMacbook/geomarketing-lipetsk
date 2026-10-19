# Task 3 — field checklist implementation and verification

Status: GREEN, 2026-10-19. Implemented only assigned Task 3 source/tests/CI paths.
The HTML stylesheet link is owned by Task 1. Shared `initDisclosure` is owned by
Task 2 and consumed after constructing each native details widget.

## Delivered behavior

- Saved cards receive a closed “Проверить на месте” disclosure, “Проверка
  пользователя” hint, seven fixed boolean checks, progress, 44px checkbox labels,
  keyboard interaction and polite save/error feedback. No uploads, score changes,
  calculation requests or changes to the saved/scenario schemas.
- `geomarketing.field-checks.v1` has its own strict envelope and validation:
  schema_version 1, at most 48 unique exact IDs of 1–160 UTF-16 code units,
  exactly seven actual booleans, valid ISO calendar/time values and a complete
  envelope limit of 65536 UTF-16 code units. Null storage means empty; malformed,
  invalid, oversized and future data remain untouched on failed operations.
- Pure storage imports access no browser globals. Storage and locks are injected
  or resolved lazily in guarded calls. Missing Web Locks means readable but
  disabled checkboxes. Throwing global getters, get/set/remove failures, quota
  failures and lock rejection fail closed without breaking the map.
- Mutations take `saved.v1.write` then `field-checks.v1.write`; latest field values
  and strict saved membership are read within this protected transaction.
  The existing strict `readSaved` is injected by the saved-card integration
  instead of duplicating or weakening the saved schema parser.
- Saved removal reports explicit persisted status. Checklist cleanup runs only
  after successful saved persistence and stays inside the saved lock while taking
  the field lock (`savedLockHeld` is the internal integration option). Cleanup
  failure preserves the full field raw value and truthfully reports that the
  place was deleted but cleanup was incomplete. Queued late writes cannot recreate
  a deleted checklist.
- Surviving saved cards and checklist nodes are retained across renders/storage
  events. Open state and focused inputs survive updates. Removed widgets ignore
  asynchronous completion. Rejected writes refresh current persisted values,
  including changes from another tab, instead of restoring a stale click snapshot.
- Explicit recovery confirmation clears only the exact still-corrupt field key
  under locks. Cancellation, changed raw, valid replacements and future versions
  survive. Even an oversized future-version envelope cannot be reset.

## RED evidence before production changes

1. `node --test tests/unit/field-check-storage.test.js` failed with
   `ERR_MODULE_NOT_FOUND` for `static/js/field-check-storage.js`.
2. `playwright-cli -s=workspace-checklist run-code --filename=tests/browser/field-checks.js`
   failed waiting 30000ms for `[data-testid="field-checks"]` after saving a card.
   Chrome needed sandbox escalation to start; the isolated session then ran
   against the root-owned http://127.0.0.1:5085 server. No server was started/killed.

## GREEN verification

`node --test tests/unit/field-check-storage.test.js tests/unit/scenario-storage.test.js`
passes **75 tests**: 13 new field-storage tests and 62 existing scenario tests.
`node --check` passes for the three changed/new production modules.
`.venv/Scripts/python.exe scripts/validate_project.py` passes all 73 required
files, import DAGs, static assets, public DOM IDs and semantic palette rules.
Checklist colors consume existing tokens; no local color fallbacks remain.

New unit tests cover isolated/prototype-safe IDs, strict booleans/indexes/schema,
null vs invalid raw, duplicate IDs, 49 records, 161-character IDs, impossible dates
and time rollovers, exactly 65536 vs 65537 characters, future-version preservation,
record capacity, latest same/different-place concurrent writes, delayed saved-lock
membership revalidation, deletion/queued late writes, read-only without locks,
blocked reads, lock rejection (including native DOMException), quota, failed cleanup,
exact-raw recovery conflicts and import with throwing browser global getters.

`playwright-cli -s=workspace-checklist run-code --filename=tests/browser/field-checks.js`
passes with no page errors. It uses isolated contexts and real two-tab shared
storage/Web Locks, verifying:

- No checklist on unsaved recommendations; seven checks on saved cards; reload
  persistence, native Space keyboard toggling and 44px label target.
- Same/different-place concurrent writes preserve all changes; saved and field
  storage events preserve the exact widget and focused input nodes.
- No calculate requests from checklist/disclosure interactions; saved raw and
  current analysis remain unchanged by checks and corruption/recovery.
- Quota rollback and a delayed rejected lock followed by another tab's successful
  write refresh the latest persisted checkbox value.
- Corrupt raw disables edits; recovery dismissal preserves raw, confirmation
  resets only the field key, and future versions expose no normal reset.
- Failed saved deletion preserves both keys. Failed field cleanup after persisted
  deletion preserves the orphan raw and reports incomplete cleanup. Normal deletion
  removes its checklist, and another tab's late mutation rejects with `missing`.
- CSV retains its original columns, current print report remains complete.
- No-lock, field-get failure, throwing localStorage getter, throwing widget-time
  storage/locks getters, and legacy overlong saved IDs leave the app usable with
  read-only/unavailable checklists as appropriate.

CI adds only the new Node test command. The isolated CLI session is closed after
verification. Task 1/root own responsive/200% and visual checks.

## Limits and review notes

Two localStorage keys cannot commit atomically across a browser/process crash.
A crash after saved persistence and before field cleanup can leave an orphan;
it is preserved safely, late mutation is rejected, and there is no automatic
sweep/migration. A later explicit exact-raw recovery remains user-controlled.
Older app versions that do not participate in these locks cannot be coordinated.
Surviving saved IDs represent immutable app-created saved snapshots, consistent
with the existing save/remove flow. Checklist state never enters CSV/print schema.

Implementation commit: `87777f1` (`Add local field checks with serialized saved membership`).
Palette-token correction and this verification update are recorded in the
subsequent Task 3 follow-up commit.
