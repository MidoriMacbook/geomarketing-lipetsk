"""Liveness endpoint."""
from flask import Blueprint, jsonify

blueprint = Blueprint('health', __name__)


@blueprint.get('/healthz')
def health():
    return jsonify({'status': 'ok'})
