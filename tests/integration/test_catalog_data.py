"""Shipped real OSM catalog geography, integrity, coverage and offline behavior."""
import hashlib
import json
import math
import unittest

from src.config import DISTRICTS, SNAPSHOT_DIR
from src.domain.businesses import BUSINESS_CATALOG
from src.services.osm_service import cache_key, competitor_cache_name
from src.utils.validation import area_for

ORIGINAL_HASHES = {'comp_bakery_center_52.612200_39.584300_1000.json': 'd63a145e97125f230f1cf544fd9a508c86cec94aad96f61fb3e173675e780d69',
 'comp_bakery_eleytsky_52.593500_39.480000_1000.json': 'f50482ab91a20558ad06983f8b73a5c6ca3cd1293f6e376297d76fe295135d82',
 'comp_bakery_universitetsky_52.605945_39.505230_1000.json': '138811986aeb9eec0cec0d1f65c7ed38c7feb98d722b45c9289691162a4e3488',
 'comp_beauty_center_52.612200_39.584300_1000_halo450.json': '973465d88aad3549a09741a2e8672fe9965cf3ec7d64f2a496dce5e71d6d5289',
 'comp_beauty_eleytsky_52.593500_39.480000_1000_halo450.json': '54071118a601c3beb39dc7303e3e43097e405925123c5143dd6f63e2ee709f92',
 'comp_beauty_universitetsky_52.605945_39.505230_1000_halo450.json': 'e4bde94ee7486723088e5df6cc3c5a0192059ef5a4f3081a70466471526b7904',
 'comp_cafe_center_52.612200_39.584300_1000.json': '9a5b47ed7d8779395177cca5c8aabdae5cce8745e35e196303984c55be8c34ea',
 'comp_cafe_eleytsky_52.593500_39.480000_1000.json': '2ed4ef9429f918d6400d3b645b65344ccd446d5fdc8fa68ad8ae548f8a3d8cf5',
 'comp_cafe_universitetsky_52.605945_39.505230_1000.json': '41d0c0d7df2f307b53c5a0b191a201967dc9a09a511ec897761d59cf49fb8ac1',
 'comp_grocery_center_52.612200_39.584300_1000.json': 'b5af61e2bd5d7d1f6a48b4490a7ee3feedd6b647240eb92c5efb4e8d41d7b61e',
 'comp_grocery_eleytsky_52.593500_39.480000_1000.json': '254778f33b4270f0e43b1ad79f8ea6fd8090eb87227d5ec124771d844f5128ed',
 'comp_grocery_universitetsky_52.605945_39.505230_1000.json': 'a1c6e2239504bbd220861e7cdcb858b7cd12b77f1177094bd140680c4659040b',
 'comp_pharmacy_center_52.612200_39.584300_1000_halo500.json': 'd637951b2e7c6342c25418203ed7bf752bffc54fa83e2cb6e8363cceb23b7cdb',
 'comp_pharmacy_eleytsky_52.593500_39.480000_1000_halo500.json': '480175f0fa1f72d67eaae82a96373f2b690e78424a07b81539942f7b9bba7c13',
 'comp_pharmacy_universitetsky_52.605945_39.505230_1000_halo500.json': 'd1f9396815ee2407628df9516c603e849fa2999d5ee2c323eb80d46268bda0cc',
 'houses_center_52.612200_39.584300_1000.json': 'bb99602b2a2383f2110d8f2227ff3dff52f586a1c885e2b0168ae3692657d40e',
 'houses_eleytsky_52.593500_39.480000_1000.json': '5780e4505b9007c50d847ad64c89484778c64e01babe6e19f40f251f1c297d85',
 'houses_universitetsky_52.605945_39.505230_1000.json': '5775d274716fc43f9c4f64f076f83a89262f51451fe64fed10b5ec0d77f75e4d'}
EXPECTED = {'eleytsky', 'universitetsky', 'center', 'pobeda', 'evropeysky',
            'sokol', 'nlmk', 'traktorny', 'matyrsky', 'syrsky_rudnik'}

class CatalogDataTests(unittest.TestCase):
    def test_exact_ten_presets_and_preserved_original_centers(self):
        self.assertEqual(set(DISTRICTS), EXPECTED)
        for key, center in {'eleytsky':(52.5935,39.48), 'universitetsky':(52.605945,39.505230), 'center':(52.6122,39.5843)}.items():
            self.assertEqual(DISTRICTS[key]['center'], center)
        self.assertTrue(all(d['radius'] == 1000 for d in DISTRICTS.values()))

    def test_original_eighteen_snapshots_are_byte_identical(self):
        self.assertEqual(len(ORIGINAL_HASHES), 18)
        for name, expected in ORIGINAL_HASHES.items():
            self.assertEqual(hashlib.sha256((SNAPSHOT_DIR / name).read_bytes()).hexdigest(), expected, name)

    def test_exact_110_snapshot_bindings_and_provenance(self):
        self.assertEqual(len(BUSINESS_CATALOG), 10)
        expected = set()
        for key in DISTRICTS:
            area = area_for(key)
            expected.add(f'houses_{cache_key(area)}.json')
            expected.update(f'{competitor_cache_name(b, area)}.json' for b in BUSINESS_CATALOG)
        self.assertEqual(len(expected), 110)
        self.assertEqual({p.name for p in SNAPSHOT_DIR.glob('*.json')}, expected)
        provenance = json.loads((SNAPSHOT_DIR.parent / 'catalog-provenance.json').read_text(encoding='utf-8'))
        self.assertEqual(set(provenance['outputs']), expected)
        self.assertEqual(provenance['license']['identifier'], 'ODbL-1.0')
        self.assertEqual(set(provenance['areas']), EXPECTED)
        for key in EXPECTED:
            area = area_for(key)
            record = provenance['areas'][key]
            self.assertEqual(record['center'], list(area['center']))
            self.assertEqual(record['radius_m'], 1000)
            self.assertTrue(record['center_source']['url'].startswith('https://www.openstreetmap.org/'))
            self.assertTrue(record['center_source']['verified_at'])
            if key not in {'eleytsky', 'universitetsky', 'center'}:
                self.assertIn(record['center_source']['basis'], ('place', 'residential_address'))
                proof = record['center_source']['coordinate_source']
                self.assertEqual([proof['latitude'], proof['longitude']], list(area['center']))
                self.assertTrue(proof['url'].startswith('https://nominatim.openstreetmap.org/'))
                tags = record['center_source']['osm_tags']
                if record['center_source']['basis'] == 'place':
                    self.assertIn(tags['place'], ('suburb', 'quarter', 'neighbourhood'))
                else:
                    self.assertIn('addr:housenumber', tags)
                    self.assertIn('building', tags)
                    self.assertNotIn('man_made', tags)
                    self.assertNotIn('shop', tags)
        for name, binding in provenance['outputs'].items():
            payload = json.loads((SNAPSHOT_DIR / name).read_text(encoding='utf-8'))
            rows = payload['data']
            area = area_for(binding['area'])
            self.assertEqual(binding['cache_key'], name[:-5])
            self.assertEqual(binding['sha256'], hashlib.sha256((SNAPSHOT_DIR / name).read_bytes()).hexdigest())
            self.assertEqual(binding['fetched_at'], payload['fetched_at'])
            if name in ORIGINAL_HASHES:
                self.assertEqual(binding['status'], 'preserved_original')
                continue
            self.assertEqual(binding['status'], 'imported_osm')
            self.assertGreater(payload['fetched_at'], 0)
            source = provenance['sources'][binding['source_id']]
            self.assertEqual(source['fetched_at'], payload['fetched_at'])
            self.assertEqual(len(source['sha256']), 64)
            self.assertEqual(payload['source_sha256'], source['sha256'])
            self.assertEqual(source['fetched_at'], max(part['fetched_at'] for part in source['parts']))
            for part in source['parts']:
                self.assertEqual(len(part['sha256']), 64)
                self.assertGreater(part['fetched_at'], 0)
                self.assertTrue(part['url'].startswith('https://api.openstreetmap.org/api/0.6/map?bbox='))
            self.assertEqual(source['geometry_validation']['missing_relevant_references'], 0)
            bounds = payload['bounds']
            self.assertEqual([bounds['minlon'], bounds['minlat'], bounds['maxlon'], bounds['maxlat']], source['bbox'])
            self.assertTrue(source['url'].startswith('https://api.openstreetmap.org/api/0.6/map?bbox='))
            lat,lng = area['center']
            halo = 0 if name.startswith('houses_') else max(400, BUSINESS_CATALOG[binding['business']]['R'])
            coverage = 1000 + halo
            west,south,east,north = source['bbox']
            self.assertLessEqual(south, lat - coverage / 111000)
            self.assertGreaterEqual(north, lat + coverage / 111000)
            self.assertLessEqual(west, lng - coverage / (111000 * math.cos(math.radians(lat))))
            self.assertGreaterEqual(east, lng + coverage / (111000 * math.cos(math.radians(lat))))
            if name.startswith('houses_'):
                self.assertGreaterEqual(len(rows), 5)
                for row in rows:
                    distance=math.hypot((row[0]-lat)*111000, (row[1]-lng)*111000*math.cos(math.radians(lat)))
                    self.assertLessEqual(distance, 1000.1)
                    self.assertGreater(row[2], 0)

if __name__ == '__main__':
    unittest.main()
