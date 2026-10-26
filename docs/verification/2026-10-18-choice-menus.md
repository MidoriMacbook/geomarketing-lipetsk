# Приёмка оформленных меню

База1154e61. Область, тип бизнеса и радиус
своей области получили общий combobox в розово-сливовой палитре. Нативные
select остаются контрактом данных; отдельный optional module не блокирует карту.

- RED: исходный UI не содержит business-trigger; новый сценарий падает.
- GREEN choice-menus: пять бизнесов мышью, стрелки без commit, Escape cancel,
  End/Enter, кириллический typeahead/Tab, единственный popup, custom/radius,
  native disabled sync, outside/resize завершение, отсутствие модуля → native fallback.
- В разработке выявлено преждевременное закрытие из-за scrollIntoView всего
  документа и отложенной smooth-прокрутки focus. Прокручивается только меню;
  открытие фиксирует текущую позицию, внешний scroll закрывает при сдвиге якоря.
- 360/390px и 200% текста: меню внутри область просмотра, последний active row целиком
  внутри scrollport после анимации; horizontal overflow отсутствует.
- касания: отдельный Chromium hasTouch/isMobile390x640, tap pharmacy, 200% text,
  реальные CDP touchStart/8touchMove/touchEnd: scrollTop0→123 без commit/закрытия;
  затем tap beauty. DOM фокус остаётся на combobox. pageErrors[].
- Движение gm:choice-open/row/close/value присутствует; reduce без running effects.
  Раскрытие360ms, строки220ms со задержка по очереди, закрытие220ms через inert snapshot.
- Workspace19groups GREEN, включая catalog retry, model/API, storage/CSV/races;
  redesign390/768/1440/200% GREEN, области нажатия>=44, control boundary contrast4.24.
- Counters GREEN (middle5946/final12344/refresh12344), map-harmony GREEN:
  мобильный inset17, controls12, карта сохраняет4цвета/shared canvas2.
- Validator63, JS syntax и diff-check GREEN. Новых зависимостей нет.
- адаптивность в чистом контексте GREEN360/390/768/1024/1280/1440; 200% текста
  на360/390/1024/1280, управление>=44, legacy/print/reduce/focus. Исправлена старая
  формула теста: прозрачный фон теперь композируется с предками, как в redesign.
  Прежняя формула давала ложные1.03:1 для почти прозрачной розовой кнопки на тёмном.
- Вручную просмотрены desktop/mobile screenshots; popup расширен до256px
  для длинных названий, ограничен область просмотра; тень уменьшена отдельным token.
- Независимое проверка реализации и финальные deltas: Проверка требований и качества пройдена,
  нерешённых замечаний нет.

Source/main5a85c3f50f3f4a98eec2f425395d992bc7674ec2. CI39104675122 и39104732797
успешно, включая51backend tests, validator,10JS syntax и воспроизводимую Material build.
Render dep-dba6iiu1egvs73dclas0 live18октября2026 09:39:12Москва, trigger new_commit.
Public choice-menus GREEN: те же5options/keyboard/typeahead/viewport/reduce/fallback,
touch390/200% scroll0→123 и tap beauty, pageErrors[]. Public краткая проверка: health200,
реальный API3recs,2saved/2compare; карта390/768/1440 tiles6/12/16, без переполнения.
Начальный reduced-motion Material static резервный режим, running0. Все20HTML/CSS/JS/vendor/
favicon и2font hashes совпадают с Git runtime. Публичные desktop/mobile screenshots
лично просмотрены. Свои проверка браузеры закрыты, helper37208/child30756 остановлены
после проверки commandlines, localhost5085 не слушается. Финальный коммит отчёта
только документы [skip render].

Пределы: Chromium касания не заменяет проверку на физическом телефоне;
VoiceOver/TalkBack, Safari/Firefox и полный аудит доступности не выполнялись.
