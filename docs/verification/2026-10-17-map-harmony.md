# Приёмка палитры карты и мобильных отступов

База9504400, ветка codex/harmonious-map-mobile-spacing. Пользователь отверг
яркие аналитические цвета; новые близки к розово-лиловой палитре интерфейса.

- Причина тесных строк подтверждена: max900 recommendations padding:0.
  RED: Recommendation text touches its panel border. GREEN после padding16:
  текст подсказок на17px от внешней рамки; phone controls padding12/minheight44.
-360/390/430/768 и390 при200% текста без horizontal overflow;
  при200% кнопки увеличивают высоту до59.59px, надписи переносятся.
- Карта #C58CA6/#B94F7B/#E4D2EE/#8C709A; houses opacity.95,
  competitor outline#F0D9E4, светлые кольца скоплений и соответствующая легенда.
- Shared canvas2, CSS reads4/1; palette regression GREEN.
- Selected contrast GREEN: small text6.54, saved/dialog controls14.97,
  settings selection12.08. Redesign390/768/1440/200% GREEN/pageErrors[].
- Mobile map tiles6/6, tablet12/12, desktop16/16; targets>=44,
  text contrast5.84–16.48 и controls4.24. Desktop/mobile screenshots просмотрены.
- Validator63/JSsyntax/diff пройдены; нет dependencies/backend/model/storage изменений.
- Independent whole-branch review: Spec PASS, Quality APPROVED, findings none.

Source CI/main/Render/public идентификаторы будут записаны после публикации.
Chromium screenshots не заменяют аудит всех native controls и видов цветового зрения.
