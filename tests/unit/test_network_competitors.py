"""Городские сетевые признаки, покрытие тегами и совместимость расчётов."""
import time
import unittest
from unittest.mock import patch

from app import app
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.city_data import digest, make_bundle, validate_bundle
from src.domain.network_competitors import city_networks
from src.services import analysis_service, city_feed_service
from src.services.osm_service import parse_competitors
from tests.unit.test_city_data import city_rows


def fixture_bundle():
    competitors = {key: [] for key in BUSINESS_CATALOG}
    point = (52.5935, 39.48)

    def element(id, tags=None, kind='node', shift=0):
        lat, lon = point[0] + shift, point[1]
        coordinates = {'lat': lat, 'lon': lon}
        return {'type': kind, 'id': id, 'tags': tags or {},
                **(coordinates if kind == 'node' else {'center': coordinates})}

    competitors['grocery'] = parse_competitors([
        element(123, {'brand': 'Пример  маркет', 'brand:wikidata': 'Q281123'}),
        element(123, {'brand': 'ПРИМЕР\u00a0МАРКЕТ'}, kind='way', shift=0.001),
        element(234, {'brand': 'Один бренд', 'brand:wikidata': 'invalid'}),
        element(345, {'operator': 'Пример маркет'}, shift=0.0015),
        element(456, {'brand:wikidata': 'Q0'}),
    ])
    competitors['bakery'] = parse_competitors([
        element(61, {'brand': 'Один бренд'}),
        element(62, {'brand': 'Только один объект'}),
        element(63, {'brand:wikidata': 'Q42'}),
    ])
    competitors['fast_food'] = parse_competitors([
        element(62, {'brand': 'Только один объект'}),
        element(71), element(72), element(73), element(74),
    ])
    return make_bundle(city_rows(), competitors, time.time())


class NetworkCompetitorTests(unittest.TestCase):
    def test_city_dedup_typed_ids_coverage_and_saved_flags(self):
        bundle = fixture_bundle()
        coverage, ids = city_networks(bundle)
        self.assertEqual(ids, {'node:123', 'way:123', 'node:234', 'node:61', 'node:63'})
        self.assertEqual(coverage['grocery'], {'total': 5, 'tagged': 4})
        self.assertEqual(coverage['fast_food'], {'total': 5, 'tagged': 1})
        records = bundle['provenance']['competitors']['grocery']['records']
        self.assertEqual([row.get('is_chain', False) for row in records], [True, True, True, False, False])
        validate_bundle(bundle)

    def test_weight_only_changes_penalty_and_composes_with_corrections(self):
        bundle = fixture_bundle()
        self.enterContext(patch.object(city_feed_service, '_get_bundle',
                                      return_value=(bundle, 'current', True, None)))
        self.enterContext(patch.object(analysis_service, 'CITY_DATA_URL', 'https://feed.test'))
        client = app.test_client()
        url = '/api/calculate'
        rows = {weight: client.get(url, query_string={'type': 'grocery', 'network_weight': weight}).get_json()
                for weight in (1, 0.5, 0)}
        plain = client.get(url, query_string={'type': 'grocery'}).get_json()
        self.assertNotIn('network_competition', plain)
        full = rows[1]
        self.assertEqual(full['grid'], plain['grid'])
        self.assertEqual(full['recommendations'], plain['recommendations'])
        self.assertEqual(full['network_competition']['marked'], 3)
        for weight, result in rows.items():
            self.assertEqual(result['network_competition']['weight'], weight)
            self.assertEqual(result['network_competition']['total'], 5)
            self.assertEqual(result['competitors'], full['competitors'])
        self.assertNotEqual(rows[0]['grid'], rows[0.5]['grid'])
        self.assertNotEqual(rows[1]['grid'], rows[0.5]['grid'])
        self.assertTrue(client.get(url, query_string={'type': 'fast_food','network_weight': '0'})
                        .get_json()['network_competition']['eligible'])
        limited = client.get(url, query_string={'type': 'cafe', 'network_weight': '0'}).get_json()
        self.assertEqual(limited['network_competition']['weight'], 1)
        self.assertFalse(limited['network_competition']['eligible'])
        self.assertEqual(client.get(url, query_string={'network_weight': '0.9'}).status_code, 400)
        changes = {'added': [{'id': 'test', 'lat': 52.5935, 'lng': 39.48}], 'removed': ['node:123']}
        result = client.post(url, json={'type': 'grocery', 'network_weight': 0, 'corrections': changes}).get_json()
        self.assertEqual(result['network_competition']['weight'], 0)
        self.assertEqual(result['network_competition']['marked'], 2)
        self.assertEqual(result['network_competition']['total'], 5)
        manual = next(r for r in result['competitors'] if r['source'] == 'manual')
        self.assertNotIn('is_chain', manual)
        self.assertNotEqual(result['grid'], rows[0]['grid'])

    def test_legacy_feed_defaults_to_full_weight(self):
        bundle = fixture_bundle()
        for group in bundle['provenance']['competitors'].values():
            for record in (group or {}).get('records', []):
                for key in ('brand', 'brand:wikidata', 'is_chain'):
                    record.pop(key, None)
        bundle['version'] = digest(bundle)
        validate_bundle(bundle)
        self.enterContext(patch.object(city_feed_service, '_get_bundle',
                                      return_value=(bundle, 'current', True, None)))
        self.enterContext(patch.object(analysis_service, 'CITY_DATA_URL', 'https://feed.test'))
        client = app.test_client()
        optional = client.get('/api/calculate?type=grocery&network_weight=0').get_json()
        plain = client.get('/api/calculate?type=grocery').get_json()
        self.assertEqual(optional['network_competition'],
                         {'coverage': None, 'eligible': False, 'weight': 1, 'total': 5, 'marked': 0})
        self.assertEqual(optional['grid'], plain['grid'])
        self.assertEqual(optional['recommendations'], plain['recommendations'])
