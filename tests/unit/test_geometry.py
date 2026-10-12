"""Projection and geometric coverage checks without HTTP or network access."""
import math
import unittest

import numpy as np

from src.utils.geo import to_meters, to_latlng, _bbox, _footprint_m2


class GeometryTests(unittest.TestCase):
    def test_local_projection_round_trip_and_axis_orientation(self):
        center = (52.5935, 39.48)
        points = [[52.5940, 39.481], [52.5920, 39.479]]
        xy = to_meters(points, *center)
        self.assertGreater(xy[0, 0], 0)
        self.assertGreater(xy[0, 1], 0)
        self.assertTrue(np.allclose([to_latlng(row, *center) for row in xy], points,
                                    rtol=0, atol=1e-12))

    def test_bbox_covers_requested_radius_in_both_axes(self):
        lat, lng = 52.5935, 39.48
        south, west, north, east = map(float, _bbox((lat, lng), 1500).split(','))
        self.assertAlmostEqual((north - south) * 111000, 3000, delta=0.12)
        self.assertAlmostEqual((east - west) * 111000 * math.cos(math.radians(lat)),
                               3000, delta=0.12)

    def test_footprint_is_translation_and_winding_independent(self):
        lat, lng = 52.5935, 39.48
        width = 20 / (111000 * math.cos(math.radians(lat)))
        height = 10 / 111000
        rectangle = [{'lat': lat, 'lon': lng}, {'lat': lat, 'lon': lng + width},
                     {'lat': lat + height, 'lon': lng + width},
                     {'lat': lat + height, 'lon': lng}]
        self.assertAlmostEqual(_footprint_m2(rectangle), 200, places=6)
        self.assertAlmostEqual(_footprint_m2(list(reversed(rectangle))), 200, delta=0.001)
