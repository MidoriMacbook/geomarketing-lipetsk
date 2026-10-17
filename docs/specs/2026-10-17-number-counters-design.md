# Плавное нарастание чисел

Прямой запрос пользователя: добавить анимации загрузки чисел в согласованном
тёмном интерфейсе. Реализуется count-up для четырёх KPI и числовых метрик/score
рекомендаций; координаты, ранги, радиусы и даты не анимируются.

Первое появление:0→результат за1100ms с замедлением. Refresh: прежнее видимое
значение→новое, включая уменьшение. Одинаковые значения не перезапускаются.
Новый анализ после смены фильтра начинается с0. Offscreen старт ждёт viewport.

Числа расчёта остаются финальными в состоянии приложения и доступном DOM:
визуальный aria-hidden overlay рисует промежуточное число через CSS generated
content, итоговый span занимает прежнее место и не меняет ширину на каждом кадре.
textContent/копирование/ARIA/печать и отчёт не зависят от animation finish.
Один общий requestAnimationFrame, без измерений раскладки внутри tick.

Риски: старый tick после нового расчёта (отмена при reset/rebuild, record identity);
лишние анонсы screen reader (overlay aria-hidden, final text постоянен);
вечный pending/hidden tab (observer cleanup, final при reduce/print/hidden).
Без IntersectionObserver — немедленный старт; reduced-motion — сразу финал.
Новых пакетов нет, API/storage/model/CSV не меняются.

Приёмка: browser RED до реализации, промежуточные числа и неизменный final DOM,
refresh вверх/вниз, interruption/reset, offscreen, reduce startup/runtime,
print/hidden/noObserver, нули, реальный результат. Затем scoped regression,
синтаксис/validator, независимое ревью, CI/main/Render/public.
