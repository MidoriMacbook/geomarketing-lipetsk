"""Гипотетическое влияние геометрических совпадений без изменения исходных данных."""
import copy
import unittest

from scripts.audit_house_geometry import find_candidates, impact_for_area


class HouseGeometryAuditTests(unittest.TestCase):
    def setUp(self):
        self.bundle = {
            'houses': [[52.6, 39.4, 100], [52.6, 39.4, 100],
                       [52.601, 39.401, 200], [52.599, 39.399, 300],
                       [52.602, 39.4, 250], [52.598, 39.4, 150]],
            'competitors': {'cafe': []},
            'provenance': {'houses': {'duplicates_removed': 0, 'records': [
                {'osm_type': 'way', 'osm_id': i + 1,
                 'geometry_sha256': ('a' if i < 2 else str(i)) * 64,
                 'population': {'tags': {'building': 'residential'}}}
                for i in range(6)]}},
        }
        self.evidence = {
            ('way', 1): {'tags': {'building': 'residential', 'addr:housenumber': '1'},
                        'node_refs': ['1', '2', '3', '1'], 'local_relation_memberships': []},
            ('way', 2): {'tags': {'building': 'residential'},
                        'node_refs': ['1', '2', '3', '1'], 'local_relation_memberships': []},
        }
        self.area = {'key': 'test', 'custom': True, 'center': (52.6, 39.4), 'radius': 500}

    def test_distinct_ids_are_only_candidates_and_keep_richer_address_in_hypothesis(self):
        original = copy.deepcopy(self.bundle)
        found = find_candidates(self.bundle, self.evidence)
        self.assertEqual(found['status'], 'available')
        group = found['groups'][0]
        self.assertTrue(group['candidate'])
        self.assertFalse(group['automatic_merge'])
        self.assertEqual(group['keep_index'], 0)
        self.assertEqual(group['hypothetical_remove_indices'], [1])
        self.assertEqual(self.bundle, original)

    def test_parts_conflicting_tags_relations_or_node_order_block_candidate(self):
        for patch in [
            {'tags': {'building': 'residential', 'building:part': 'yes'}},
            {'tags': {'building': 'apartments'}},
            {'tags': {'building': 'residential', 'addr:housenumber': '2'}},
            {'tags': {'building': 'residential', 'building:levels': '9'}},
            {'local_relation_memberships': [{'id': '42', 'role': 'part'}]},
            {'node_refs': ['3', '2', '1', '3']},
        ]:
            with self.subTest(patch=patch):
                evidence = copy.deepcopy(self.evidence)
                evidence[('way', 2)].update(patch)
                group = find_candidates(self.bundle, evidence)['groups'][0]
                self.assertFalse(group['candidate'])
                self.assertEqual(group['hypothetical_remove_indices'], [])

    def test_missing_provenance_or_full_tags_is_not_proof_of_absent_parts(self):
        bare = copy.deepcopy(self.bundle)
        bare.pop('provenance')
        self.assertEqual(find_candidates(bare, self.evidence)['status'], 'unavailable')
        group = find_candidates(self.bundle, {})['groups'][0]
        self.assertFalse(group['candidate'])
        self.assertIn('full_source_evidence_missing', group['blockers'])

    def test_inconsistent_center_population_or_repeated_identity_is_rejected(self):
        for column in (0, 2):
            with self.subTest(column=column):
                bundle = copy.deepcopy(self.bundle)
                bundle['houses'][1][column] += 0.01
                self.assertFalse(find_candidates(bundle, self.evidence)['groups'][0]['candidate'])
        bundle = copy.deepcopy(self.bundle)
        bundle['provenance']['houses']['records'][1]['osm_id'] = 1
        with self.assertRaises(ValueError):
            find_candidates(bundle, self.evidence)

    def test_hypothetical_loss_uses_same_points_and_preserves_input(self):
        original = copy.deepcopy(self.bundle)
        groups = find_candidates(self.bundle, self.evidence)['groups']
        result = impact_for_area(self.bundle, self.area, 'cafe', groups)
        self.assertEqual(result['baseline']['houses'], 6)
        self.assertEqual(result['counterfactual']['houses'], 5)
        self.assertEqual(result['possible_excess_residents'], 100)
        self.assertEqual(result['baseline']['residents'] - result['counterfactual']['residents'], 100)
        self.assertEqual(result['baseline']['status'], 'calculated')
        self.assertEqual(result['counterfactual']['status'], 'calculated')
        for check in result['baseline_points_after_hypothesis']:
            self.assertLess(check['counterfactual_demand'], check['baseline_demand'])
            self.assertLessEqual(check['counterfactual_raw_score'], check['baseline_raw_score'])
        self.assertEqual(self.bundle, original)
        self.assertEqual(result, impact_for_area(self.bundle, self.area, 'cafe', groups))

    def test_overlapping_areas_count_each_pair_once_and_minimum_is_explicit(self):
        groups = find_candidates(self.bundle, self.evidence)['groups']
        left = impact_for_area(self.bundle, self.area, 'cafe', groups)
        area = dict(self.area, key='overlap', center=(52.6001, 39.4))
        right = impact_for_area(self.bundle, area, 'cafe', groups)
        self.assertEqual(left['hypothetical_removed_indices'], [1])
        self.assertEqual(right['hypothetical_removed_indices'], [1])
        small = copy.deepcopy(self.bundle)
        small['houses'].pop()
        small['provenance']['houses']['records'].pop()
        result = impact_for_area(small, self.area, 'cafe', find_candidates(small, self.evidence)['groups'])
        self.assertEqual(result['baseline']['status'], 'calculated')
        self.assertEqual(result['counterfactual']['status'], 'insufficient_houses')
        self.assertEqual(result['possible_excess_residents'], 100)


if __name__ == '__main__':
    unittest.main()
