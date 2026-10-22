# Editorial hero — implementation plan

Goal: выполнить утверждённый светлый редизайн и опубликовать без потери функций.
Spec: docs/specs/2026-10-22-editorial-map-hero.md (подробный дизайн дан пользователем).
Architecture: статическая доступная HTML-обложка, CSS tokens, React effect island,
отдельный Rollup bundle; приложение Flask/Leaflet остаётся прежним.
Execution: subagent-driven-development; независимая параллельная wave CSS/island,
root HTML/navigation/tests/docs/integration. Общий QA server5085, отдельные browser names.
Assumptions: modern Chrome; без JS обложка и навигация читаются, API UI требует JS.

## Global constraints
Все прежние id/testid/схемы/API/10×10/CSV/print/Material и shared-height сохраняются.
Palette6 примитивов из spec; semantic components; AA; no perpetual/typewriter/WebGL.
Не повторять секционные reveal; данные/фокус не ждут анимаций; no initial hidden text.
Новые пакеты exact+lock, source/licence/provenance. Без несвязанных upgrades.

## Review Focus
Сбой/задержка island/font оставляет читабельный h1/CTA без CLS и дублей.
Sticky/mobile menu не скрывает anchors/focus, в том числе research-open/trust links.
Runtime reduce/print/offscreen очищают SplitText/blur/pointer и pending effects.
Dark map имеет независимые читаемые on-map токены; остальные панели светлые.
Shared CSS/helper/build изменения не теряют старые storage/report/race контракты.

## Task1 — light semantic system (worker style)
Own static/css/{tokens,base,layout,components,map,states,responsive,scenarios,field-checks}.css,
newstatic/css/hero.css, static/assets/fonts/playfair*, font licence, tests/browser/editorial-style.js.
Consumes root HTML hooks: .intro.editorial-hero/.hero-copy/#page-title.hero-title/
.hero-title-line/em/#hero-description.hero-description/.hero-links/.hero-meta/
#hero-art.hero-art/[data-hero-drift]/.hero-art-caption; nav #site-header/
#nav-menu/#nav-toggle/.header-location/.header-reserve/.is-scrolled/.nav-open.
Produces light AA tokens, localfont, responsive herostyles/map/control scopes.
Security:none. Does NOT cover JS/mount/build/menu logic; root/Task2 own them.
- [x] RED style test old dark palette/old display/no sticky/map contrast.
- [x] Implement tokens/CSS/font within prescribed visual framework; retain grid cap.
- [x] GREEN computed contrast,4widths/200%,states/targets/map,noJS; commit owned paths.

## Task2 — sourced React Bits island and build (worker island)
Own scripts/frontend/hero/**, scripts/frontend/hero-entry.js, rollup.config.js,
package.json,pnpm-lock.yaml,static/vendor/hero/**,.github/workflows/test.yml,
tests/browser/hero-island.js, newstatic/js/hero-loader.js if needed.
Consumes DOM hooks Task1/root above; existing motionReduced convention.
Produces build:hero/check:hero, generatedselfcontainedESbundle, source/license,
mount #hero-motion-root effect controller, init/runtime reduce, boundedpointer.
Use actual upstream SplitText/BlurText sources, adaptations clearly documented.
Coordinate section reveal with root: root ui.js disables old panel/card reveals;
island owns once-only KPI/workspace/saved/scenarios/data (max5) with fail-safe visibility.
Security:none (no untrusted/userHTML). Does NOT own app state/API/storage/HTML/CSS.
- [x] RED browser test island missing while fallback text remains available.
- [x] Install only required pinned deps; add source/provenance, cleanup-safe effects,
  local asyncloader/build. No duplicate h1; no proportional initial load/CLS regression.
- [x] GREEN delay/failure/noJS/reduce/print/pointer/offscreen/once/budget tests;
  rebuild hero+Material byte-identically, checksize, commit owned paths.

## Task3 — HTML/navigation and integration (root)
Own static/index.html, static/js/{navigation,ui}.js, tests/browser/editorial-navigation.js,
scripts/validate_project.py, docs/README/CHANGELOG/DEPLOYMENT/state/session-log.
Consumes Task1CSS and Task2bundle. Produces static SVGhero, accessible sticky mobile
navigation, anchors/focus offsets, no duplicate reveal, finalverified release.
Security:none. Does NOT change model/storage/API; no photoassets needed.
- [x] RED nav tests structure/noJS/menu/anchors/last research-open with sticky offset.
- [x] Implement HTML/SVG/menu, preserve oldids and model-button (secondary hero button
  separateid), mobilefallback, root ui.js single reveal owner coordination.
- [ ] Per-task independent reviews Spec+Quality; resolve findings, final matrix once:
  fullPython/Node/validator/JS/Material+hero/buildsize/palette + responsive/menu/
  scenarios/workspace/field/CSV/print; visual screenshots4widths/states.
- [ ] Wholebranch review, featureCI→mainFF→Renderlive→publicQA/hash→auditCI/owncleanup.
