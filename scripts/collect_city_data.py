"""Collect one complete daily city extract; never publish partial OSM results."""
import argparse
import json
import logging
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import requests
from src.config import OVERPASS_URLS, HEADERS, APARTMENT_TYPES, PRIVATE_TYPES
from src.domain.businesses import BUSINESS_CATALOG
from src.domain.city_data import COVERAGE, make_bundle, validate_bundle
from src.services.osm_service import parse_houses, parse_competitors

FEED_URL = 'https://raw.githubusercontent.com/MidoriMacbook/geomarketing-lipetsk/osm-data/city.json'
logger = logging.getLogger(__name__)


def fetch_elements(query):
    for url in OVERPASS_URLS:
        for attempt in range(2):
            try:
                with requests.get(url, params={'data': query}, headers=HEADERS,
                                  timeout=(10, 210)) as response:
                    response.raise_for_status()
                    payload = response.json()
                    if not isinstance(payload, dict) or payload.get('remark') or not isinstance(payload.get('elements'), list):
                        raise ValueError('Incomplete Overpass response')
                    return payload['elements']
            except (requests.RequestException, ValueError) as exc:
                logger.warning('Collection %s attempt %s failed: %s',
                               urlparse(url).hostname, attempt + 1, type(exc).__name__)
                if attempt == 0:
                    time.sleep(5)
    raise RuntimeError('No complete city response; previous publication remains unchanged')


def in_coverage(row):
    return (COVERAGE['south'] <= row[0] <= COVERAGE['north']
            and COVERAGE['west'] <= row[1] <= COVERAGE['east'])


def collect():
    box = ','.join(str(COVERAGE[k]) for k in ('south', 'west', 'north', 'east'))
    types = '|'.join(sorted(APARTMENT_TYPES | PRIVATE_TYPES))
    houses_query = (f'[out:json][timeout:180];('
                    f'way["building"~"^({types})$"]({box});'
                    f'way["building"="yes"]["building:levels"]({box});'
                    f'way["building"="yes"]["addr:housenumber"]({box}););out body geom;')
    houses = [row for row in parse_houses(fetch_elements(houses_query)) if in_coverage(row)]
    tags = sorted({tag for business in BUSINESS_CATALOG.values() for tag in business['tags']})
    query = '[out:json][timeout:180];(' + ''.join(f'nwr[{tag}]({box});' for tag in tags) + ');out body center;'
    elements = fetch_elements(query)
    competitors = {}
    for key, business in BUSINESS_CATALOG.items():
        pairs = [re.fullmatch(r'"([^"]+)"="([^"]+)"', tag).groups() for tag in business['tags']]
        matching = [el for el in elements if any(el.get('tags', {}).get(k) == v for k, v in pairs)]
        competitors[key] = [row for row in parse_competitors(matching, deduplicate=False) if in_coverage(row)]
    bundle = make_bundle(houses, competitors, time.time())
    with requests.get(FEED_URL, headers=HEADERS, timeout=(5, 20)) as previous:
        if previous.status_code != 404:
            previous.raise_for_status()
            old = validate_bundle(previous.json())
            if (len(houses) < len(old['houses']) * .7
                    or sum(map(len, competitors.values())) < sum(map(len, old['competitors'].values())) * .5):
                raise ValueError('Unexpected data loss; previous publication remains unchanged')
    return bundle


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=Path)
    target = parser.parse_args().output
    bundle = collect()
    target.write_text(json.dumps(bundle, sort_keys=True, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    print(f"Complete extract: {len(bundle['houses'])} houses; "
          f"{sum(map(len, bundle['competitors'].values()))} category entries; {bundle['version']}")
