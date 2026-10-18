"""Pure provenance assessment; these labels never change model eligibility."""
from datetime import datetime, timezone
import math

from src.config import LOW_DATA_RESIDENTS, MIN_HOUSES


def _date(value):
    try:
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value, timezone.utc) if math.isfinite(value) else None
        if isinstance(value, str):
            parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return parsed.astimezone(timezone.utc) if parsed.tzinfo is not None else None
    except (ValueError, TypeError, OverflowError, OSError):
        pass
    return None


def _iso(value):
    return value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def assess_data_quality(*, source, metadata, house_count, residents,
                        competitor_count, warning=None, notice=None, now=None):
    """Use the oldest two known fetch dates, never calculation or save time.

    Fetch times in existing CacheInfo metadata are Unix seconds. ISO timestamps
    are accepted too, keeping the assessment usable outside the HTTP service.
    ``now`` is injectable for deterministic boundary checks.
    """
    now = now or datetime.now(timezone.utc)
    dates = [_date(metadata.get(dataset, {}).get('fetched_at'))
             for dataset in ('houses', 'competitors')]
    valid_dates = [value for value in dates if value is not None
                   and (value - now).total_seconds() <= 300]
    oldest = min(valid_dates) if valid_dates else None
    if source == 'demo':
        freshness, oldest = 'demo', None
    elif len(valid_dates) != 2:
        freshness = 'unknown'
    else:
        age = (now - oldest).total_seconds()
        freshness = 'fresh' if age <= 86400 else 'recent' if age <= 604800 else 'stale'

    reasons = []

    def reason(code, text):
        reasons.append({'code': code, 'text': text})

    reason('osm_coverage', 'Добровольная разметка OpenStreetMap может быть неполной; '
           'оценка жителей не является переписью населения')
    if source == 'demo':
        reason('demo_data', 'Демонстрационные данные: реальная полнота и свежесть не оцениваются')
    if house_count < MIN_HOUSES:
        reason('insufficient_houses', f'Учтено домов: {house_count}; для модели желательно не менее {MIN_HOUSES}')
    if residents < LOW_DATA_RESIDENTS:
        reason('low_residents', f'Оценочное число жителей: {residents}, менее {LOW_DATA_RESIDENTS}; '
               'спрос может быть занижен из-за неполной разметки домов')
    if competitor_count == 0:
        reason('no_mapped_competitors', 'В выборке OSM конкуренты не отмечены; '
               'это не доказывает отсутствия конкуренции')
    if freshness == 'stale':
        reason('stale_data', 'Самым ранним известным геоданным больше 7 дней')
    elif freshness == 'unknown':
        reason('unknown_freshness', 'Дата домов или конкурентов отсутствует, некорректна '
               'либо более чем на 5 минут опережает время расчёта')
    if len(valid_dates) == 2 and dates[0] != dates[1] and source != 'demo':
        reason('mixed_fetch_dates', f'Наборы обновлены в разное время: дома — {_iso(dates[0])}; '
               f'конкуренты — {_iso(dates[1])}')
    if warning:
        reason('load_warning', str(warning))
    if notice:
        reason('load_notice', str(notice))
    limited = source == 'demo' or house_count < MIN_HOUSES or residents < LOW_DATA_RESIDENTS
    needs_review = competitor_count == 0 or bool(warning) or bool(notice)
    return {
        'version': 1, 'assessed_at': _iso(now), 'source': source,
        'freshness': {'status': freshness, 'oldest_data_at': _iso(oldest) if oldest else None},
        'completeness': {'status': 'limited' if limited else 'needs_review' if needs_review else 'usable_for_model',
                         'reasons': reasons},
    }
