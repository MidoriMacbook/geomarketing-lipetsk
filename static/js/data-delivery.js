// Pure copy shared by the refresh status and provenance panel.
export function deliverySummary(data) {
  return data?.data_delivery?.mode === 'daily'
    ? 'Выгрузка OpenStreetMap собирается раз в сутки. Кнопка проверяет наличие новой версии; дата относится к исходным данным.'
    : '';
}

export function refreshMessage(data) {
  if (data?.data_delivery?.mode === 'daily') {
    const messages = {
      updated: 'Новая версия данных получена. Расчёт обновлён; дата выгрузки указана выше.',
      unchanged: 'Новых данных пока нет. Используется последняя выгрузка; её исходная дата сохранена.',
      checking: 'Проверка обновлений уже выполняется. Пока показана доступная версия.',
      unavailable: 'Не удалось проверить обновления. Сохранены доступные данные и их исходная дата.'
    };
    return messages[data.data_delivery.status] || 'Используется последняя доступная ежедневная выгрузка.';
  }
  const fresh = data?.source === 'osm' && ['houses', 'competitors'].every(key => data.data_meta?.[key]?.cached === false);
  return fresh
    ? 'Данные получены из OpenStreetMap, расчёт обновлён. Числа могут остаться прежними, если в источнике нет изменений.'
    : `Свежие данные получены не полностью. Расчёт использует доступную копию. ${data?.warning || 'Проверьте даты источников выше и повторите обновление позже.'}`;
}
