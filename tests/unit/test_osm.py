import unittest
import json
import math
import tempfile
from pathlib import Path
from unittest.mock import patch

from src.services import osm_service as osm
from src.services import cache_service


class BusinessDataTests(unittest.TestCase):
    def test_old_narrow_competitor_cache_is_not_reused(self):
        area=osm.area_for('eleytsky')
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent,prefix='tmp-') as folder:
            root=Path(folder)
            legacy=root/f'comp_beauty_{osm.cache_key(area)}.json'
            legacy.write_text(json.dumps([[52.5935,39.48]]),encoding='utf-8')
            fresh=[[52.5935,39.5008]]
            with patch.object(cache_service,'CACHE_DIR',root),patch.object(cache_service,'SNAPSHOT_DIR',root/'none'), \
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



if __name__ == '__main__':
    unittest.main()
