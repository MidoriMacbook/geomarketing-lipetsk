import time
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from uuid import UUID

from app import app
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.city_data import make_bundle
from src.domain.data_reliability import assess_data_reliability
from src.services import analysis_service, city_feed_service
from src.services.osm_service import parse_competitors
from src.utils import formatting
from src.utils.validation import area_for
from tests.unit.test_city_data import city_rows


AREA = area_for('eleytsky')
LAT, LNG = AREA['center']
INSIDE = (LAT, LNG)
HALO = (LAT + 0.01, LNG)
OUTSIDE = (LAT + 0.03, LNG)
COMPLETE = {'name:ru': 'Кофейня', 'addr:full': 'Космонавтов, 3'}


def competitors(points):
    return parse_competitors([
        {'type': 'node', 'id': index, 'lat': lat, 'lon': lng, 'tags': tags}
        for index, ((lat, lng), tags) in enumerate(points, 1)
    ])


def fixture(local_tags, *, city_count=30, groceries=1, residents=1000):
    cafe = competitors([(INSIDE, tags) for tags in local_tags]
                       + [(HALO, COMPLETE)]
                       + [(OUTSIDE, COMPLETE)] * (city_count - len(local_tags) - 1))
    grocery = competitors([(INSIDE, COMPLETE)] * groceries + [(HALO, COMPLETE)])
    return {'houses': [[*INSIDE, residents], [*HALO, 9999]],
            'competitors': {'cafe': cafe, 'grocery': grocery},
            'provenance': {'competitors': {'cafe': cafe.provenance, 'grocery': grocery.provenance}}}


class DataReliabilityTests(unittest.TestCase):
    def test_city_boundary_and_halo(self):
        at_29 = assess_data_reliability(fixture([COMPLETE] * 5, city_count=29), AREA, 'cafe')
        at_30 = assess_data_reliability(fixture([COMPLETE] * 5), AREA, 'cafe')
        self.assertEqual((at_29['level'], at_29['code']), ('low', 'few_city_objects'))
        self.assertEqual(at_29['reason'], 'В OSM отмечено мало объектов.')
        self.assertEqual((at_30['level'], at_30['code']), ('high', 'sufficient_coverage'))
        self.assertEqual(at_30['metrics']['city_objects'], 30)
        self.assertEqual(at_30['metrics']['area_objects'], 5)
        self.assertEqual(at_30['metrics']['grocery_stores'], 1)
        self.assertEqual(at_30['metrics']['estimated_residents'], 1000)
        self.assertEqual(at_30['metrics']['grocery_per_1000'], 1)

    def test_missing_fields_use_the_stage_one_tag_rules(self):
        result = assess_data_reliability(fixture([
            COMPLETE, {'name': 'Зёрна', 'addr:street': 'Космонавтов'},
            {'brand': 'Ромашка', 'addr:place': 'Липецк', 'addr:housename': 'Родник'},
            {'name': ' \ufeff  ', 'addr:housenumber': '5'},
            {'name:ru': 'Кофе', 'addr:street': 'Мира', 'addr:housenumber': '8'},
        ]), AREA, 'cafe')
        metrics = result['metrics']
        self.assertEqual(metrics['missing_names'], {'count': 2, 'share': 0.4})
        self.assertEqual(metrics['missing_addresses'], {'count': 2, 'share': 0.4})
        self.assertEqual(metrics['missing_both'], {'count': 1, 'share': 0.2})
        self.assertEqual((result['level'], result['code']), ('medium', 'missing_names'))

    def test_empty_area_distinguishes_measured_zero_from_undefined_share(self):
        result = assess_data_reliability(fixture([], groceries=0), AREA, 'cafe')
        metrics = result['metrics']
        self.assertEqual((result['level'], result['code']), ('low', 'no_area_objects'))
        self.assertEqual(metrics['area_objects'], 0)
        self.assertEqual(metrics['missing_names'], {'count': 0, 'share': None})
        self.assertEqual(metrics['missing_addresses'], {'count': 0, 'share': None})
        self.assertEqual(metrics['missing_both'], {'count': 0, 'share': None})
        self.assertEqual(metrics['grocery_per_1000'], 0)

    def test_zero_residents_means_unknown_density(self):
        result = assess_data_reliability(fixture([COMPLETE] * 5, residents=0), AREA, 'cafe')
        self.assertEqual((result['level'], result['code']), (None, 'incomplete_metrics'))
        self.assertEqual(result['metrics']['estimated_residents'], 0)
        self.assertEqual(result['metrics']['grocery_stores'], 1)
        self.assertIsNone(result['metrics']['grocery_per_1000'])
        self.assertEqual(result['metrics']['missing_names'], {'count': 0, 'share': 0})

    def test_legacy_record_without_an_identity_outside_the_area(self):
        bundle = fixture([COMPLETE] * 5)
        record = bundle['provenance']['competitors']['cafe']['records'][-1]
        record['osm_type'] = None
        del record['osm_id']
        result = assess_data_reliability(bundle, AREA, 'cafe')
        self.assertEqual(result['metrics']['city_objects'], 30)
        self.assertEqual(result['metrics']['counts_basis']['city_objects'], 'rows')
        self.assertEqual(result['metrics']['counts_basis']['area_objects'], 'osm_type_id')
        self.assertEqual(result['metrics']['missing_names'], {'count': 0, 'share': 0})

    def test_legacy_coordinates_and_identity_only_provenance_keep_available_values(self):
        bundle = fixture([COMPLETE] * 5)
        for provenance in bundle['provenance']['competitors'].values():
            for record in provenance['records']:
                record.pop('name', None)
                record.pop('address', None)
        for legacy in (bundle, {key: value for key, value in bundle.items() if key != 'provenance'}):
            with self.subTest(provenance='provenance' in legacy):
                result = assess_data_reliability(legacy, AREA, 'cafe')
                self.assertEqual((result['level'], result['code']), (None, 'incomplete_metrics'))
                self.assertEqual(result['metrics']['city_objects'], 30)
                self.assertEqual(result['metrics']['area_objects'], 5)
                self.assertEqual(result['metrics']['grocery_per_1000'], 1)
                for field in ('missing_names', 'missing_addresses', 'missing_both'):
                    self.assertEqual(result['metrics'][field], {'count': None, 'share': None})

    def test_first_matching_threshold_explains_the_result(self):
        combinations = (
            ([COMPLETE] * 2 + [{}] * 2, 0, 'low', 'missing_both'),
            ([COMPLETE] * 4, 0, 'low', 'very_low_grocery_density'),
            ([COMPLETE] * 4, 1, 'medium', 'few_area_objects'),
            ([{'name': 'Кофе'}] * 5, 1, 'medium', 'missing_addresses'),
        )
        for tags, groceries, level, code in combinations:
            with self.subTest(code=code):
                result = assess_data_reliability(fixture(tags, groceries=groceries), AREA, 'cafe')
                self.assertEqual((result['level'], result['code']), (level, code))
        result = assess_data_reliability(fixture([COMPLETE] * 5, residents=2000), AREA, 'cafe')
        self.assertEqual((result['level'], result['code']), ('medium', 'low_grocery_density'))


class DataReliabilityApiTests(unittest.TestCase):
    def test_opt_in_get_post_and_corrections_use_the_same_original_indicator(self):
        bundle = fixture([COMPLETE] * 5)
        categories = dict.fromkeys(BUSINESS_CATALOG, []) | bundle['competitors']
        bundle = make_bundle(city_rows(), categories, time.time() - 100)
        self.enterContext(patch.object(city_feed_service, '_get_bundle', return_value=(bundle, 'current', True, None)))
        self.enterContext(patch.object(analysis_service, 'CITY_DATA_URL', 'https://example.test/city.json'))
        self.enterContext(patch.object(formatting, 'uuid4', return_value=UUID(int=42)))
        self.enterContext(patch.object(analysis_service, 'datetime')).now.return_value = datetime.now(timezone.utc)
        client = app.test_client()
        url = '/api/calculate'
        params = {'district': 'eleytsky', 'type': 'cafe', 'competitor_details': '1'}
        ordinary = client.get(url, query_string=params)
        self.assertNotIn('data_reliability', ordinary.get_json())
        self.assertEqual(ordinary.data, client.get(url, query_string={**params, 'data_reliability': '0'}).data)

        request = {**params, 'data_reliability': '1'}
        get_response = client.get(url, query_string=request)
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(client.post(url, json=request).data, get_response.data)
        get_calculation = get_response.get_json()
        indicator = get_calculation.pop('data_reliability')
        self.assertEqual(get_calculation, ordinary.get_json())
        self.assertEqual(indicator, assess_data_reliability(bundle, AREA, 'cafe'))

        correction = {'removed': ['node:1'], 'added': [{'id': 'manual-1', 'lat': LAT, 'lng': LNG}]}
        legacy_correction = client.post(url, json={**params, 'corrections': correction}).get_json()
        corrected_response = client.post(url, json={**request, 'corrections': correction})
        self.assertEqual(corrected_response.status_code, 200)
        corrected = corrected_response.get_json()
        self.assertEqual(corrected.pop('data_reliability'), indicator)
        self.assertEqual(corrected, legacy_correction)
        self.assertEqual(corrected['correction_context']['counts'], {'added': 1, 'removed': 1})

    def test_missing_daily_city_source_returns_an_explicit_unavailable_indicator(self):
        self.enterContext(patch.object(analysis_service, 'CITY_DATA_URL', ''))
        self.enterContext(patch.object(analysis_service.osm, '_overpass', side_effect=OSError('offline')))
        response = app.test_client().get('/api/calculate?data_reliability=1')
        self.assertEqual(response.status_code, 200)
        indicator = response.get_json()['data_reliability']
        self.assertEqual((indicator['level'], indicator['code'], indicator['metrics']), (None, 'source_unavailable', None))
