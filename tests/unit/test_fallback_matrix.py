"""Ожидаемый отказ источника не становится внутренней ошибкой сервера."""
import unittest
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch

import app
from src.config import DISTRICTS
from src.domain.businesses import BUSINESS_CATALOG
from src.services import analysis_service as analysis
from src.utils.validation import UserError, area_for, custom_area


class FallbackMatrixTests(unittest.TestCase):
    def test_diagnostic_failure_does_not_promise_demo_for_all_presets(self):
        from scripts import check
        for daily in ('', 'https://example.test/city.json'):
            output = StringIO()
            with patch.object(check, 'CITY_DATA_URL', daily), \
                 patch.object(check.requests, 'post', side_effect=RuntimeError('источник недоступен')), \
                 patch.object(check.osm, 'get_houses', side_effect=RuntimeError('источник недоступен')), \
                 redirect_stdout(output):
                check.main()
            text = output.getvalue()
            self.assertNotIn('Проект покажет демо-данные', text)
            self.assertNotIn('Остальные покажут демо-данные', text)
            self.assertIn('демо не включается' if daily else 'только для кафе и аптек', text)

    def test_missing_pobeda_demo_is_an_expected_user_error(self):
        with patch.object(analysis, 'CITY_DATA_URL', ''), \
             patch.object(analysis.osm, 'get_houses', side_effect=RuntimeError('нет источника')):
            response = app.app.test_client().get('/api/calculate?district=pobeda&type=cafe')
        self.assertEqual(response.status_code, 400)
        self.assertIn('message', response.get_json())

    def test_all_hundred_pairs_require_both_district_and_category(self):
        successful = []
        with patch.object(analysis, 'CITY_DATA_URL', ''), \
             patch.object(analysis.osm, 'get_houses', side_effect=RuntimeError('нет источника')):
            for district in DISTRICTS:
                for business in BUSINESS_CATALOG:
                    with self.subTest(district=district, business=business):
                        available = (district in analysis.DEMO_HOUSES
                                     and district in analysis.DEMO_COMPETITORS.get(business, {}))
                        if available:
                            loaded = analysis.load_data(area_for(district), business, False)
                            self.assertEqual(loaded.source, 'demo')
                            self.assertIn('демонстрацион', loaded.warning.lower())
                            successful.append((district, business))
                        else:
                            with self.assertRaises(UserError):
                                analysis.load_data(area_for(district), business, False)
        self.assertEqual(len(successful), 6)

    def test_custom_area_never_uses_demo_even_at_preset_center(self):
        area = custom_area(*DISTRICTS['eleytsky']['center'], 1000)
        with patch.object(analysis, 'CITY_DATA_URL', ''), \
             patch.object(analysis.osm, 'get_houses', side_effect=RuntimeError('нет источника')):
            for business in BUSINESS_CATALOG:
                with self.subTest(business=business), self.assertRaises(UserError):
                    analysis.load_data(area, business, False)

    def test_demo_marker_survives_public_payload(self):
        with patch.object(analysis, 'CITY_DATA_URL', ''), \
             patch.object(analysis.osm, 'get_houses', side_effect=RuntimeError('нет источника')):
            payload = analysis.analyze(area_for('eleytsky'), 'cafe')
        self.assertEqual(payload['source'], 'demo')
        self.assertEqual(payload['data_quality']['source'], 'demo')
        self.assertIn('демонстрацион', payload['warning'].lower())


if __name__ == '__main__':
    unittest.main()
