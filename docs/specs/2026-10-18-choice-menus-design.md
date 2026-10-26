# Оформленные меню выбора

Запрос: браузерные меню области/бизнеса выбиваются из оформления и не имеют
анимаций. Существующую розово-сливовую палитру и остальные функции сохраняем.

Решение: постепенное улучшение интерфейса трёх select (district/business/radius) единым
select-only combobox. Trigger с иконкой/значением/стрелкой, отдельное светлое меню,
hover/active/selected, галочка, раскрытие360ms, появление строк220ms со задержка по очереди,
закрытие220ms через существующий inert snapshot; reduced-motion сразу финал.
Меню в body, fixed, ограничено область просмотра, раскрывается вверх при недостатке места.
Scroll внешней страницы/resize/чужой focus/выбор другого поля закрывает его.

Native select остаётся источником значений/options/change для приложения,
после успешной инициализации скрывается и исключается из tab order. Без модуля
нативные поля остаются доступными. Catalog sync/disabled/retry сохраняются.
Label/description относятся к combobox; active descendant/listbox/option states,
стрелки/Home/End/PageUp/PageDown/typeahead, Enter/Space/Tab commit, Escape cancel.
DOM фокус остаётся на trigger, активный пункт прокручивается внутри меню.
Основа семантики: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/

Риски: сбои sync с каталогом (наблюдать options/disabled и change), orphan menu
при смене района/скрытии radius (закрывать при чужих change/hidden), выход за
viewport/200% text (max-height/scroll/перенос), потеря клавиатура или fallback.
Альтернативы: CSS-only native menu сохраняет системный вид в части браузеров;
новая UI-зависимость не нужна для четырёх/пяти пунктов. Выбран локальный модуль.
Модель/API/storage/DOM ids сохраняются; нативные contract tests могут задавать
значения скрытого select принудительно, новый сценарий использует настоящий UI.
