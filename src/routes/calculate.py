"""Разбор параметров расчёта, ограничение параллельных запросов и обработка HTTP-ошибок."""
from threading import BoundedSemaphore
from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge

from src.domain.corrections import Corrections
from src.services.analysis_service import analyze
from src.utils.validation import UserError, resolve_area

blueprint = Blueprint('calculate', __name__)
calculation_slots = BoundedSemaphore(2)


@blueprint.route('/api/calculate', methods=['GET', 'POST'])
def calculate():
    if not calculation_slots.acquire(blocking=False):
        return jsonify({'status': 'error', 'message': 'Сервис занят расчётами. Повторите через минуту.'}), 503, {'Retry-After': '30'}
    try:
        return run_calculation()
    except UserError as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 400
    except RequestEntityTooLarge:
        return jsonify({'status': 'error', 'message': 'Размер запроса с поправками превышает допустимый.'}), 413
    except Exception:  # noqa: BLE001
        current_app.logger.exception('Calculation failed')
        return jsonify({'status': 'error', 'message': 'Не удалось выполнить расчёт. Повторите попытку позже.'}), 500
    finally:
        calculation_slots.release()


def run_calculation():
    if request.method == 'POST':
        request.max_content_length = 16 * 1024
        try:
            payload = request.get_json(silent=True)
        except RecursionError as exc:
            raise UserError('Некорректные параметры расчёта.') from exc
        if not isinstance(payload, dict):
            raise UserError('Передайте параметры расчёта в формате JSON.')
        if any(type(value) not in (str, int, float)
               for name, value in payload.items() if name != 'corrections'):
            raise UserError('Некорректные параметры расчёта.')
        params = {name: str(value) for name, value in payload.items() if name != 'corrections'}
    else:
        params = request.args
    area = resolve_area(params)
    business = params.get('type', 'cafe')
    refresh = params.get('refresh') == '1'
    include_alternatives = params.get('include_alternatives') == '1'
    if request.method == 'POST' and 'corrections' in payload:
        corrections = Corrections.parse(payload['corrections'], area['center'], area['radius'])
        return jsonify(analyze(area, business, refresh, corrections=corrections,
                               include_alternatives=include_alternatives))
    return jsonify(analyze(area, business, refresh, competitor_details=params.get('competitor_details') == '1',
                           include_alternatives=include_alternatives))
