import hashlib
import importlib
import json
import math
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.domain.businesses import BUSINESS_CATALOG
from src.services import osm_service as osm
from src.utils.geo import _footprint_m2


NEW_BUSINESSES = {
    'fast_food': ('Быстрое питание', 400, 1.8, ['"amenity"="fast_food"']),
    'florist': ('Цветочный магазин', 500, 1.4, ['"shop"="florist"']),
    'pet': ('Зоомагазин', 600, 1.6, ['"shop"="pet"']),
    'fitness': ('Фитнес-студия', 900, 1.2, ['"leisure"="fitness_centre"']),
    'dentist': ('Стоматология', 800, 1.4,
                ['"amenity"="dentist"', '"healthcare"="dentist"']),
}
BOUNDS = '<bounds minlat="52.55" minlon="39.42" maxlat="52.64" maxlon="39.54"/>'
FETCHED_AT = 1792300000.25


class AreaImportTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-')
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.source = self.root / 'source.osm'
        self.output = self.root / 'snapshots'
        self.area = osm.area_for('eleytsky')

    def importer(self):
        return importlib.import_module('scripts.import_osm_area')

    def write(self, content='', bounds=BOUNDS):
        self.source.write_text(f'<osm>{bounds}{content}</osm>', encoding='utf-8')
        return self.source

    def house(self, ident=10, lat=52.593, lng=39.480, tags=None):
        tags = tags or {'building': 'apartments', 'building:levels': '5'}
        points = [(lat, lng), (lat, lng + .0003), (lat + .0002, lng + .0003),
                  (lat + .0002, lng)]
        nodes = ''.join(f'<node id="{ident * 10 + i}" lat="{y}" lon="{x}"/>'
                        for i, (y, x) in enumerate(points))
        refs = [ident * 10 + i for i in (0, 1, 2, 3, 0)]
        way = f'<way id="{ident}">' + ''.join(f'<nd ref="{i}"/>' for i in refs)
        way += ''.join(f'<tag k="{k}" v="{v}"/>' for k, v in tags.items()) + '</way>'
        return nodes + way, [dict(lat=y, lon=x) for y, x in points + points[:1]]

    def test_exact_ten_businesses_and_new_model_parameters(self):
        self.assertEqual(set(BUSINESS_CATALOG),
                         {'cafe', 'pharmacy', 'grocery', 'bakery', 'beauty'} | set(NEW_BUSINESSES))
        for key, (name, radius, alpha, tags) in NEW_BUSINESSES.items():
            self.assertEqual(BUSINESS_CATALOG[key],
                             dict(name=name, R=radius, alpha=alpha, tags=tags))

    def test_houses_use_existing_resident_footprint_and_circle_rules(self):
        inside, points = self.house()
        corner, _ = self.house(20, lat=52.6013, lng=39.492)
        tiny, _ = self.house(30, tags={'building': 'house'})
        self.write(inside + corner + tiny)
        rows = self.importer().extract_houses(self.source, self.area)
        expected = max(1, round(osm.estimate_residents(
            {'building': 'apartments', 'building:levels': '5'}, _footprint_m2(points))))
        self.assertEqual(rows, [[52.59308, 39.48012, expected], [52.59308, 39.48012, 3]])

    def test_none_writes_houses_all_competitors_and_verified_provenance(self):
        house, _ = self.house()
        self.write(house + '<node id="1" lat="52.5935" lon="39.48">'
                   '<tag k="healthcare" v="dentist"/></node>')
        paths = self.importer().generate_snapshots(self.source, self.area, self.output,
                                                  fetched_at=FETCHED_AT)
        self.assertEqual(len(paths), 11)
        self.assertEqual(len(list(self.output.glob('houses_*.json'))), 1)
        for path in paths:
            payload = json.loads(path.read_text(encoding='utf-8'))
            self.assertEqual(payload['fetched_at'], FETCHED_AT)
            self.assertEqual(payload['source_sha256'], hashlib.sha256(self.source.read_bytes()).hexdigest())
            self.assertEqual(payload['bounds'], dict(minlat=52.55, minlon=39.42, maxlat=52.64, maxlon=39.54))
            self.assertIn('OpenStreetMap', payload['source'])
            self.assertIn('ODbL', payload['source'])
        dentist = next(path for path in paths if path.name.startswith('comp_dentist_'))
        self.assertEqual(json.loads(dentist.read_text())['data'], [[52.5935, 39.48]])

    def test_selected_businesses_write_only_requested_competitors_and_allow_complete_empty(self):
        self.write()
        paths = self.importer().generate_snapshots(self.source, self.area, self.output,
                         ['beauty', 'fitness'], fetched_at=FETCHED_AT)
        self.assertEqual(len(paths), 2)
        self.assertFalse(list(self.output.glob('houses_*.json')))
        self.assertTrue(all(json.loads(path.read_text())['data'] == [] for path in paths))
        fitness = next(path for path in paths if path.name.startswith('comp_fitness_'))
        self.assertEqual(json.loads(fitness.read_text())['coverage_margin_m'], 900)

    def test_fitness_requires_1900_m_coverage_and_includes_outer_halo(self):
        lat, lng = self.area['center']
        east = lng + 1850 / (111000 * math.cos(math.radians(lat)))
        self.write(f'<node id="1" lat="{lat}" lon="{east}">'
                   '<tag k="leisure" v="fitness_centre"/></node>')
        paths = self.importer().generate_snapshots(self.source, self.area, self.output,
                                                  ['fitness'], fetched_at=FETCHED_AT)
        self.assertEqual(len(json.loads(paths[0].read_text())['data']), 1)
        self.write(bounds='<bounds minlat="52.58" minlon="39.46" maxlat="52.61" maxlon="39.50"/>')
        with self.assertRaises(ValueError):
            self.importer().generate_snapshots(self.source, self.area, self.output,
                                               ['fitness'], fetched_at=FETCHED_AT)

    def test_invalid_sources_never_replace_any_existing_file(self):
        house, _ = self.house()
        bad_cases = [
            '<osm>', '<html/>', '<osm/>', f'<osm>{BOUNDS}<remark>timeout</remark></osm>',
            f'<osm>{BOUNDS}<error/></osm>',
            f'<osm>{BOUNDS}<node id="1" lat="nan" lon="39"/></osm>',
            f'<osm>{BOUNDS}<node id="1" lat="91" lon="39"/></osm>',
            f'<osm>{BOUNDS}<node id="1" lat="52" lon="39"/><node id="1" lat="52" lon="39"/></osm>',
            '<osm><bounds minlat="nan" minlon="39" maxlat="53" maxlon="40"/></osm>',
            f'<osm>{BOUNDS}<way id="1"><nd ref="999"/><tag k="building" v="house"/></way></osm>',
            f'<osm>{BOUNDS}<relation id="1"><member type="way" ref="999"/><tag k="shop" v="beauty"/></relation></osm>',
            f'<osm>{BOUNDS}<relation id="1"><member type="relation" ref="2"/><tag k="shop" v="beauty"/></relation><relation id="2"><member type="relation" ref="1"/></relation></osm>',
            # Valid house + cafe must not be written before a later business fails.
            f'<osm>{BOUNDS}{house}<node id="1" lat="52.593" lon="39.48"><tag k="amenity" v="cafe"/></node><way id="999"><nd ref="404"/><tag k="amenity" v="dentist"/></way></osm>',
        ]
        self.output.mkdir()
        previous = self.output / f'houses_{osm.cache_key(self.area)}.json'
        previous.write_text('previous', encoding='utf-8')
        for content in bad_cases:
            with self.subTest(source=content[:100]):
                self.source.write_text(content, encoding='utf-8')
                with self.assertRaises(ValueError):
                    self.importer().generate_snapshots(self.source, self.area, self.output,
                                                       fetched_at=FETCHED_AT)
                self.assertEqual(previous.read_text(), 'previous')
                self.assertEqual(list(self.output.iterdir()), [previous])

    def test_unrelated_incomplete_administrative_and_route_relations_are_ignored(self):
        self.write('<relation id="1"><member type="way" ref="999"/>'
                   '<tag k="boundary" v="administrative"/></relation>'
                   '<relation id="2"><member type="relation" ref="2"/>'
                   '<tag k="type" v="route"/></relation>')
        paths = self.importer().generate_snapshots(self.source, self.area, self.output,
                                                   ['dentist'], fetched_at=FETCHED_AT)
        self.assertEqual(json.loads(paths[0].read_text())['data'], [])

    def test_nested_relation_depth_and_expansion_are_bounded(self):
        for repetitions, depth in [(1, 17), (10, 8)]:
            relations = '<node id="1" lat="52.593" lon="39.48"/>'
            for index in range(depth):
                kind, ref = ('node', 1) if index == depth - 1 else ('relation', index + 2)
                relations += f'<relation id="{index + 1}">' + (
                    f'<member type="{kind}" ref="{ref}"/>' * repetitions)
                if index == 0:
                    relations += '<tag k="shop" v="beauty"/>'
                relations += '</relation>'
            self.write(relations)
            with self.subTest(depth=depth, repetitions=repetitions), self.assertRaises(ValueError):
                self.importer().generate_snapshots(self.source, self.area, self.output,
                                                   ['beauty'], fetched_at=FETCHED_AT)
        self.assertFalse(self.output.exists())

    def test_total_geometry_budget_counts_each_selected_business(self):
        self.write('<node id="1" lat="52.593" lon="39.48">'
                   '<tag k="amenity" v="cafe"/><tag k="healthcare" v="dentist"/></node>')
        importer = self.importer()
        with patch.object(importer, 'MAX_GEOMETRY_NODE_VISITS', 1):
            with self.assertRaises(ValueError):
                importer.generate_snapshots(self.source, self.area, self.output,
                                             ['cafe', 'dentist'], fetched_at=FETCHED_AT)
        self.assertFalse(self.output.exists())

    def test_size_primitive_limits_and_explicit_timestamp(self):
        self.write('<node id="1" lat="52.593" lon="39.48"/><node id="2" lat="52.594" lon="39.48"/>')
        importer = self.importer()
        for setting, value in [('MAX_SOURCE_BYTES', 10), ('MAX_PRIMITIVES', 1)]:
            with self.subTest(setting=setting), patch.object(importer, setting, value):
                with self.assertRaises(ValueError):
                    importer.generate_snapshots(self.source, self.area, self.output,
                                                ['beauty'], fetched_at=FETCHED_AT)
        for timestamp in (None, 0, -1, float('nan'), float('inf')):
            with self.subTest(timestamp=timestamp), self.assertRaises(ValueError):
                importer.generate_snapshots(self.source, self.area, self.output,
                                            ['beauty'], fetched_at=timestamp)
        with self.assertRaises(TypeError):
            importer.generate_snapshots(self.source, self.area, self.output, ['beauty'])

    def test_cli_supports_repeated_business_and_requires_acquisition_timestamp(self):
        self.write()
        command = [sys.executable, 'scripts/import_osm_area.py', '--district', 'eleytsky',
                   '--source', str(self.source), '--output-dir', str(self.output),
                   '--business', 'florist', '--business', 'pet']
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        result = subprocess.run(command + ['--fetched-at', str(FETCHED_AT)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(list(self.output.glob('comp_*.json'))), 2)


if __name__ == '__main__':
    unittest.main()
