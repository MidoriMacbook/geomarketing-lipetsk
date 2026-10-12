"""Diagnostics: python scripts/check.py."""
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.services import osm_service as osm


def main():
    print('1. Проверка серверов Overpass (OpenStreetMap). Один из серверов может отвечать ошибкой, это нормально.')
    ok_servers = 0
    for url in osm.OVERPASS_URLS:
        t = time.time()
        try:
            r = requests.post(url, data={'data': '[out:json][timeout:10];node(around:50,52.6122,39.5843);out count;'},
                              headers=osm.HEADERS, timeout=(10, 30))
            print(f'   {url}: код {r.status_code}, {time.time() - t:.1f} с')
            ok_servers += r.status_code == 200
        except Exception as exc:  # noqa: BLE001
            print(f'   {url}: ОШИБКА {type(exc).__name__}: {exc}')

    loaded = 0
    print('\n2. Загрузка данных по районам (первый раз может занять несколько минут)')
    for key, info in osm.DISTRICTS.items():
        area = osm.area_for(key)
        try:
            houses, _ = osm.get_houses(area, refresh=True)
            comps = {b: len(osm.get_competitors(b, area, refresh=True)[0]) for b in osm.BUSINESS_TAGS}
            loaded += 1
            avg = houses[:, 2].mean() if len(houses) else 0
            print(f'   {info["name"]}: домов {len(houses)}, жителей ≈ {int(houses[:, 2].sum()) if len(houses) else 0}, '
                  f'кофеен {comps["cafe"]}, аптек {comps["pharmacy"]}')
            if len(houses) and avg < 30:
                print('      Внимание: в среднем меньше 30 жителей на дом. Скорее всего, многоквартирные дома'
                      ' в OSM для этого района размечены неполно, оценка спроса будет заниженной.')
        except Exception as exc:  # noqa: BLE001
            print(f'   {info["name"]}: ОШИБКА {exc}')

    print('\n3. Итог')
    total = len(osm.DISTRICTS)
    if loaded == total:
        print(f'   Данные загружены для всех районов ({loaded} из {total}). Можно запускать app.py.')
    elif loaded > 0:
        print(f'   Данные загружены только для {loaded} из {total} районов. Остальные покажут демо-данные.')
    elif ok_servers == 0:
        print('   Overpass недоступен из вашей сети. Проект покажет демо-данные. Попробуйте другую сеть или VPN.')
    else:
        print('   Серверы отвечают на простые запросы, но загрузка данных не удалась. Пришлите ошибки из шага 2.')


if __name__ == '__main__':
    main()
