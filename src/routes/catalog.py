"""HTTP adapter for the public catalog."""
from flask import Blueprint, jsonify
from src.services.catalog_service import get_catalog

blueprint = Blueprint('catalog', __name__)


@blueprint.get('/api/catalog')
def catalog():
    return jsonify(get_catalog())
