"""Восстанавливает тестовую копию на неизменных числовых данных."""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from src.domain.city_data import digest, validate_bundle


def main(source, target):
    receipt = json.loads(Path(__file__).with_name('preview-osm-metadata-receipt.json').read_bytes())
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != receipt['data']['published_sha256']:
        raise ValueError('Нужна исходная выгрузка с контрольной суммой из протокола проверки')
    bundle = validate_bundle(json.loads(raw))
    records = bundle['provenance']['competitors'][receipt['business']]['records']
    for record in records:
        identity = f"{record['osm_type']}:{record['osm_id']}"
        record.update(receipt['metadata'].get(identity, {}))
    bundle['version'] = digest(bundle)
    validate_bundle(bundle)
    payload = (json.dumps(bundle, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
               + '\r\n').encode('utf-8')
    if hashlib.sha256(payload).hexdigest() != receipt['data']['enriched_sha256']:
        raise ValueError('Контрольная сумма восстановленной копии не совпала')
    target.write_bytes(payload)
    print(bundle['version'])


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('python restore-preview-data.py city.json preview-city.json')
    main(Path(sys.argv[1]), Path(sys.argv[2]))
