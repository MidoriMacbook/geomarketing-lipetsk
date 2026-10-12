import unittest
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import osm


class BusinessDataTests(unittest.TestCase):
    def test_old_narrow_competitor_cache_is_not_reused(self):
        area=osm.area_for('eleytsky')
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent,prefix='tmp-') as folder:
            root=Path(folder)
            legacy=root/f'comp_beauty_{osm.cache_key(area)}.json'
            legacy.write_text(json.dumps([[52.5935,39.48]]),encoding='utf-8')
            fresh=[[52.5935,39.5008]]
            with patch.object(osm,'CACHE_DIR',root),patch.object(osm,'SNAPSHOT_DIR',root/'none'), \
                 patch.object(osm,'_load_competitors',return_value=fresh) as loader:
                rows,info=osm.get_competitors('beauty',area)
            self.assertEqual(rows.tolist(),fresh)
            loader.assert_called_once()
            self.assertFalse(info)

    def test_competitor_bbox_covers_each_business_radius_beyond_boundary(self):
        area = osm.area_for('eleytsky')
        lat, lng = area['center']
        for business, radius in [('beauty',450),('pharmacy',500),('grocery',400)]:
            with self.subTest(business=business), patch.object(osm, '_overpass', return_value=[]) as query:
                osm._load_competitors(business,area)
                # Last bbox longitude limit must cover >= analysis radius + catchment.
                bbox=query.call_args[0][0].split('(')[2].split(')')[0]
                east=float(bbox.split(',')[3])
                extent=(east-lng)*111000*math.cos(math.radians(lat))
                self.assertGreaterEqual(extent,area['radius']+radius-0.1)

    def test_new_categories_have_specific_competitor_queries(self):
        expected = {'grocery': ('supermarket', 'convenience'),
                    'bakery': ('bakery',), 'beauty': ('hairdresser', 'beauty')}
        area = osm.area_for('center')
        for key, values in expected.items():
            with self.subTest(business=key), patch.object(osm, '_overpass', return_value=[]) as query:
                self.assertEqual(osm._load_competitors(key, area), [])
                for value in values:
                    self.assertIn(f'"shop"="{value}"', query.call_args[0][0])

    def test_import_matches_business_tags_and_analysis_bbox(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix='tmp-') as folder:
            root=Path(folder)
            source=root/'source.osm'
            source.write_text('''<osm>
              <bounds minlat="52.57" minlon="39.44" maxlat="52.62" maxlon="39.52"/>
              <node id="1" lat="52.5935" lon="39.48"><tag k="shop" v="supermarket"/></node>
              <node id="2" lat="52.5940" lon="39.481"><tag k="shop" v="bakery"/></node>
              <node id="3" lat="52.5930" lon="39.479"><tag k="shop" v="hairdresser"/></node>
              <node id="4" lat="52.69" lon="39.7"><tag k="shop" v="convenience"/></node>
              <node id="5" lat="52.5935" lon="39.48"><tag k="shop" v="convenience"/></node>
            </osm>''',encoding='utf-8')
            for business in ('grocery','bakery','beauty'):
                result=subprocess.run([sys.executable,'scripts/import_osm_competitors.py',
                    '--district','eleytsky','--business',business,'--source',str(source),
                    '--output-dir',str(root)],capture_output=True,text=True)
                self.assertEqual(result.returncode,0,result.stderr)
                name = (osm.competitor_cache_name(business, osm.area_for('eleytsky'))
                        if hasattr(osm, 'competitor_cache_name') else f'comp_{business}_{osm.cache_key(osm.area_for("eleytsky"))}')
                target=root/f'{name}.json'
                payload=json.loads(target.read_text(encoding='utf-8'))
                self.assertEqual(len(payload['data']),1)
                self.assertGreater(payload['fetched_at'],0)

    def test_rejected_import_does_not_replace_previous_snapshot(self):
        area=osm.area_for('eleytsky')
        name=(osm.competitor_cache_name('beauty',area) if hasattr(osm,'competitor_cache_name')
              else f'comp_beauty_{osm.cache_key(area)}')
        invalid_sources=['<html><body>Error</body></html>',
                         '<osm><bounds minlat="0" minlon="0" maxlat="1" maxlon="1"/></osm>',
                         '<osm/>']
        for contents in invalid_sources:
            with self.subTest(source=contents), tempfile.TemporaryDirectory(dir=Path(__file__).parent,prefix='tmp-') as folder:
                root=Path(folder)
                source=root/'source.osm';source.write_text(contents,encoding='utf-8')
                target=root/f'{name}.json'
                previous='{"fetched_at":1,"data":[[52.5935,39.48]]}'
                target.write_text(previous,encoding='utf-8')
                result=subprocess.run([sys.executable,'scripts/import_osm_competitors.py',
                    '--district','eleytsky','--business','beauty','--source',str(source),
                    '--output-dir',str(root)],capture_output=True,text=True)
                self.assertNotEqual(result.returncode,0)
                self.assertEqual(target.read_text(encoding='utf-8'),previous)

    def test_import_includes_business_catchment_beyond_old_margin(self):
        area=osm.area_for('eleytsky');lat,lng=area['center']
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent,prefix='tmp-') as folder:
            root=Path(folder);source=root/'source.osm'
            east=lng+1420/(111000*math.cos(math.radians(lat)))
            source.write_text(f'''<osm><bounds minlat="52.57" minlon="39.44" maxlat="52.62" maxlon="39.52"/>
                <node id="1" lat="{lat}" lon="{east}"><tag k="shop" v="beauty"/></node></osm>''',encoding='utf-8')
            result=subprocess.run([sys.executable,'scripts/import_osm_competitors.py',
                '--district','eleytsky','--business','beauty','--source',str(source),
                '--output-dir',str(root)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            payload=json.loads(next(root.glob('comp_beauty*.json')).read_text(encoding='utf-8'))
            self.assertEqual(len(payload['data']),1)

    def test_valid_empty_extract_is_allowed_and_incomplete_geometry_is_rejected(self):
        from scripts.import_osm_competitors import extract_competitors
        area=osm.area_for('eleytsky')
        bounds='<bounds minlat="52.57" minlon="39.44" maxlat="52.62" maxlon="39.52"/>'
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent,prefix='tmp-') as folder:
            source=Path(folder)/'source.osm'
            source.write_text(f'<osm>{bounds}</osm>',encoding='utf-8')
            self.assertEqual(extract_competitors(source,'beauty',area),[])
            source.write_text(f'<osm>{bounds}<way id="1"><nd ref="999"/><tag k="shop" v="beauty"/></way></osm>',encoding='utf-8')
            with self.assertRaises(ValueError):
                extract_competitors(source,'beauty',area)

    def test_way_relation_centers_and_duplicate_representations(self):
        from scripts.import_osm_competitors import extract_competitors
        area=osm.area_for('eleytsky')
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent,prefix='tmp-') as folder:
            source=Path(folder)/'source.osm'
            source.write_text('''<osm><bounds minlat="52.57" minlon="39.44" maxlat="52.62" maxlon="39.52"/>
              <node id="1" lat="52.593" lon="39.48"/><node id="2" lat="52.594" lon="39.482"/>
              <node id="3" lat="52.5935" lon="39.481"><tag k="shop" v="beauty"/></node>
              <way id="10"><nd ref="1"/><nd ref="2"/><tag k="shop" v="hairdresser"/></way>
              <relation id="20"><member type="way" ref="10"/><tag k="shop" v="beauty"/></relation>
            </osm>''',encoding='utf-8')
            self.assertEqual(extract_competitors(source,'beauty',area),[[52.5935,39.481]])


if __name__ == '__main__':
    unittest.main()
