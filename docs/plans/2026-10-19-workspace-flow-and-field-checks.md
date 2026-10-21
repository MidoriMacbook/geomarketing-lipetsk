# Рабочая зона, объяснения и checklist — план

Goal: устранить разрыв под картой и связать анализ с локальной проверкой помещения.
Spec: docs/specs/2026-10-19-workspace-flow-and-field-checks.md, задана пользователем.
Stack: существующие Flask/ES modules/CSS/Leaflet/Material; без новых зависимостей.
Assumptions: native details/ResizeObserver/WebLocks поддерживаются современным
браузером; graceful fallback/readonly предусмотрены, старые данные не мигрируют.
Execution: subagent-driven-development; утверждённое подробное задание разрешает
реализацию и публикацию, повторная остановка на согласовании не нужна.

## Global constraints / Review focus

Сохранить10×10/API/saved.v1/scenarios.v1/ids/testids/ARIA/CSV/print/палитру/count-up.
Не выполнять score/сетевые запросы от hover/disclosure/checklist. Закрытые details
не скрывают информацию в печатном DOM; screen focus остаётся управляемым.
Проверить: динамическую высоту/отменённые анимации, hidden research first-save/recovery,
коррупцию field key без влияния на saved/map, две вкладки/удаление/late write,
CSS cap/scroll при200% и1024px. Каждый класс покрывается своей задачей ниже.

## Task1 — сетка и структура HTML (worker layout)

Own static/index.html, static/css/layout.css, static/css/map.css,
static/css/responsive.css; tests/browser/workspace-layout.js(new).
Read user-listed CSS/HTML and relevant design docs, frontend/redesign skills.
Consumes: текущиеid и новыеHTML ids из spec. Produces: растягиваемые map-card/#map,
адаптивная высота/комфортный предел; нижняяdata-section; компактныеtrust slots;
scenario-save вне hidden research; полеfieldsetCSSlink field-checks.css(создаётTask3).
Security:none. Excludes: JS размер карты/качество/исследования — Task2.

- [x] RED тест:1440/1024 map-card.height>=recommendations.height, нет остатка в
  рабочем ряду; data-section после saved/research и передfooter; native data-details
  defaultclosed,390order/44px/nooverflow. СуществующийCSS должен провалиться.
- [x] Implement grid/flex min/max, adaptive rec scrolling only atcomfortable cap,
  keep settings compact, preserve allIDs anddatacontents, relocateHTML.
- [x] GREEN layouttest andJSfreevisiblecontent,0/1/3cards includingexpanded;
  coordinate JS hooks withTask2, don't edit their files.
- [x] Commit ownedpaths andreportRED/GREEN.

## Task2 — объяснения, motion, map resize и исследования (worker flow)

Own static/js/{app,map,recommendations,ui,data-quality,scenarios,report,scenario-report}.js,
static/css/{components,states,scenarios,tokens}.css;
tests/browser/workspace-interactions.js(new). Existingtests may adapt only when
asserting deliberatelychangedvisiblelabels/hiddenresearch, preservecontractassertions.
Consumes Task1slots andexistingAPI explanation/quality. Produces initDisclosure(details,
options={}) exportui.js, hoverPlace(rank,active) exportmap.js, RAF ResizeObserver,
compacttrust/link/bottomfacts, fact-basedrecdisclosures, one-timepanels/buttonfeedback,
researchnaming/visibility+firstsave/recovery/oldrecords andfullprintmetadata.
Security:none (reusevalidatedAPI/DOMtext). Excludes: storage schema/model/backend changes.

- [x] RED interactiontest oldtrustmissing,fullqualityintrudes, explanation/focus/
  hoverrankunchanged, ResizeObserver afterdisclosure, researchinitialhiddenbut
  firstsavebuttonreachable andoldrecoverysurfacevisible.
- [x] Implement approvedfact-basedUI, cancellableaccessible disclosure, reduce runtime,
  hoverfinepointeronly/selectedsteady, actualheightresize withoutresetselection.
- [x] GREEN testpointer/keyboard/touch/reduce/fallback/print/CSV/refresherror/archive
  noAPIfromUIactions; adaptroot regression expectations only ifneeded.
- [x] Commit ownedpaths; coordinate sharedhelperTask3 andlayoutTask1.

## Task3 — локальная пользовательская проверка (worker checklist)

Own newstatic/js/field-check-storage.js, static/js/field-checks.js,
newstatic/css/field-checks.css, static/js/saved-places.js,
newtests/unit/field-check-storage.test.js, tests/browser/field-checks.js(new),
.github/workflows/test.yml (onlyaddnewNode testcommand).
Consumes Task2initDisclosure andexisting savedid/renderer. Produces fieldChecksBlock(id),
removeFieldChecks(id); pure readFieldChecks/setFieldCheck/deleteFieldChecks injected
storage/locks. Exactkey/schema/7items/limits in spec. NoDOMglobalsatpuremoduleimport.
Security:localuntrustedstorage; preflightreview required beforeimplementation.
Excludes: scores/API/oldschemas/actualphoto uploads. Fields appear only savedcards.

- [x] RED Node schema/isolatedrecords/strictbool/invalid/date/prototype-safeid/
  latestlock/twotabs/readonlynolock/quota/future/rawpreservation; browserwidgetabsent.
- [x] Implement storage+UI, checkbox44px+keyboard/progress/softfeedback; rollback
  failedwrites, preservefocusstorageevent, removedonlyaftersaveddeletesucceeds.
  Recoverymayresetonlyownkey afterconfirmation+exactrawguard, noautomaticrepair.
- [x] GREEN Node/browserreload/twotab/corruptkey/blockedstorage/nolock/delete+latewrites,
  modelunchanged/newcardsuntouched andnormalCSV/print stillwork.
- [x] Add Node testtoCI andcommitownedpaths.

## Task4 — integration/review/release (root)

Own docs/design/{design-system,redesign-spec}.md, docs/architecture/frontend.md,
README/CHANGELOG/DEPLOYMENT/state/session-log, docs/verification/2026-10-19-workspace-flow-and-field-checks.md,
scripts/validate_project.py (requirednewfilesonly), spec/plan andQAwrappers/artifacts.
Consumes Tasks1–3 commits. Produces verified main+Render; no newAPI/contracts.
Security:none. Excludes physicaldevices/newengines/OSMquality/nativePDFpagination.

- [x] Complete independenttaskreview(Spec+Quality); taskfixesRED→GREEN/re-review.
- [x] Singlefinalmatrix1440/1024/768/390/200%, mapheight0/1/3+expanded, no gap/dataorder,
  trustrefresh/error/archive, marker/card, checkliststorage/concurrency, oldstorage/
  reports,reduce/focus/touch44px,actualscreenshots+fullPython/Node/validator/JS/material.
- [ ] Wholebranchmostcapablereview thenfeatureCIgreen→mainFF→Renderlive.
- [ ] PublicUI/geometry/checklist/report/mobile/hash, docs/auditCI, ownQAcleanup.
  Finalanswer addressesnineuserrequestedpoints includingcause/fix/data/explanations/
  motion/checklist/files/tests/nextusefulfeatures.
