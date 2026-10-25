import unittest
from unittest.mock import Mock, patch
from src.services import osm_service as osm

class OverpassTransportTests(unittest.TestCase):
    def response(self, data):
        response=Mock();response.status_code=200;response.json.return_value=data;return response

    def test_competitor_query_requests_node_coordinates(self):
        def endpoint(query):
            # Overpass 'out tags' omits lat/lon for nodes; body includes them.
            node={'type':'node','id':1,'tags':{'amenity':'cafe'}}
            if 'out body center;' in query:node.update(lat=52.5935,lon=39.48)
            return [node]
        with patch.object(osm,'_overpass',side_effect=endpoint):
            self.assertEqual(osm._load_competitors('cafe',osm.area_for('eleytsky')),[[52.5935,39.48]])

    def test_get_transport_allows_queue_and_query_time(self):
        with patch.object(osm.requests,'get',return_value=self.response({'elements':[]})) as request, patch.object(osm.requests,'post',side_effect=RuntimeError('old transport')):
            self.assertEqual(osm._overpass('[out:json];node(1);out;'),[])
            self.assertGreaterEqual(request.call_args.kwargs['timeout'][1],30)
            self.assertIn('data',request.call_args.kwargs['params'])

    def test_partial_response_is_not_saved_as_empty_competitors(self):
        reply=self.response({'remark':'Query run out of memory','elements':[]})
        with patch.object(osm.requests,'get',return_value=reply),patch.object(osm.requests,'post',return_value=reply):
            with self.assertRaises(RuntimeError):osm._overpass('query')

    def test_fast_gateway_failure_retries_once_on_same_node(self):
        bad=self.response({});bad.status_code=502
        bad.raise_for_status.side_effect=osm.requests.HTTPError('gateway')
        good=self.response({'elements':[]})
        with patch.object(osm.requests,'get',side_effect=[bad,good]) as request, patch.object(osm.time,'sleep'):
            self.assertEqual(osm._overpass('query'),[])
            self.assertEqual(request.call_count,2)
            self.assertEqual(request.call_args_list[0].args,request.call_args_list[1].args)
            bad.close.assert_called_once()

    def test_rate_limit_fails_over_without_immediate_retry(self):
        bad=self.response({});bad.status_code=429
        bad.raise_for_status.side_effect=osm.requests.HTTPError('rate limit')
        with patch.object(osm.requests,'get',side_effect=[bad,self.response({'elements':[]})]) as request:
            self.assertEqual(osm._overpass('query'),[])
            self.assertNotEqual(request.call_args_list[0].args,request.call_args_list[1].args)

    def test_budget_is_shared_between_loads_and_reset_afterwards(self):
        with patch.object(osm.time,'monotonic',side_effect=[100,100,100,183,183]), patch.object(osm.requests,'get',return_value=self.response({'elements':[]})) as request:
            with osm.loading_budget():
                self.assertEqual(osm._overpass('houses'),[])
                with self.assertRaises(RuntimeError):osm._overpass('competitors')
            self.assertEqual(request.call_count,1)
        self.assertIsNone(osm._deadline.get())

if __name__=='__main__':unittest.main()
