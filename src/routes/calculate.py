"""Calculation request parsing, bounded concurrency, and HTTP error handling."""
from threading import BoundedSemaphore
from flask import Blueprint, current_app, jsonify, request

from src.services.analysis_service import analyze
from src.utils.validation import UserError, resolve_area

blueprint = Blueprint('calculate', __name__)
calculation_slots = BoundedSemaphore(2)


@blueprint.route('/api/calculate')
def calculate():
    if not calculation_slots.acquire(blocking=False):
        return jsonify({'status': 'error', 'message': 'Сервис занят расчётами. Повторите через минуту.'}), 503, {'Retry-After': '30'}
    try:
        return run_calculation()
    except UserError as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 400
    except Exception:  # noqa: BLE001
        current_app.logger.exception('Calculation failed')
        return jsonify({'status': 'error', 'message': 'Не удалось выполнить расчёт. Повторите попытку позже.'}), 500
    finally:
        calculation_slots.release()


def run_calculation():
    area = resolve_area(request.args)
    business = request.args.get('type', 'cafe')
    refresh = request.args.get('refresh') == '1'
    return jsonify(analyze(area, business, refresh))
