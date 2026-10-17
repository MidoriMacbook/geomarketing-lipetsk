# Material Web и визуальный референс Skiper UI

## Реально используемый компонент

Локальный @material/web2.5.0: entry импортирует только md-linear-progress.
Элемент находится в #analysis-progress и показывается при реальном расчёте или
обновлении. Indeterminate ожидание имеет доступное имя, без фиктивного процента.
После завершения или отмены запроса полоса скрывается.

Native button/select/checkbox/range/dialog сохранены: DOM API, доступные имена,
focus/Escape и сценарии уже на них опираются. Их замена потребовала бы адаптера
без улучшения текущего сценария. Неиспользуемые регистрации подготовки удалены.
--md-* ссылаются на общие токены цвета, высоты, формы и шрифта.
С 17 октября экранные токены графитово-бирюзовые; отдельная Material-палитра
не добавляется. Печатная палитра светлая, progress в отчёт не попадает.
Флаг html[data-material-web="ready"] и событие material-web-ready сохранены.

## Reduced motion и отказ bundle

CSS страницы не управляет Shadow DOM. Поэтому ui.js при reduced-motion снимает
indeterminate, скрывает Material, отменяет shadow animations после Lit update
и показывает статический .progress-fallback. Runtime смена preference работает
без перезагрузки; revision guard защищает от отложенного старого обновления.

Fallback — div с role=progressbar, именем и без aria-valuenow. Если bundle
не загрузился, он показывает ожидание; API, карта и native controls работают.
Бизнес-логика не ждёт whenDefined. После ожидания обе версии скрыты.

## Сборка

package.json и pnpm-lock.yaml фиксируют версии. Rollup/node-resolve собирают
scripts/frontend/material-web-entry.js в static/vendor/material-web/material-components.js.
Source map не публикуется; восемь модулей приложения сборки не требуют.

```powershell
pnpm install --frozen-lockfile
pnpm run check:material
```

check:material проверяет entry и пересобирает vendor; запускать затем build:material
не требуется. Bundle хранится в Git, Python/Render не требуют Node.
CI Node24/pnpm11.25.0 пересобирает файл, проверяет отсутствие diff и синтаксис JS.

## Skiper UI

Skiper UI просмотрен в браузере как референс компактной навигации, выразительной
типографики и коротких микровзаимодействий. Он не устанавливается: React/TSX/
shadcn/Tailwind не входят в стек проекта. Исходники и платные компоненты
не копируются; motion написан на CSS/WAAPI.

## Дальнейшее внедрение

Для нового Material-контрола сначала зафиксировать native-контракты, обосновать
пользу, добавить один импорт, сопоставить токены и проверить keyboard/focus,
цели44px, mobile, reduced-motion и отказ bundle.
tests/browser/material-web.js проверяет реальный upgraded DOM; redesign.js —
поведение progress при запросе и оба fallback-сценария.
