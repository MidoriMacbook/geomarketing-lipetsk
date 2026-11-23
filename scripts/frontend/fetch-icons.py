"""Vendor a small, pinned Tabler subset; no runtime CDN."""
import concurrent.futures
import json
from pathlib import Path
import requests

root=Path('static/assets/icons');root.mkdir(parents=True,exist_ok=True)
response=requests.get('https://api.github.com/repos/tabler/tabler-icons/commits/main',timeout=30);response.raise_for_status();revision=response.json()['sha']
names=['coffee','first-aid-kit','basket','bread','scissors','burger','flower','paw','barbell','dental','chevron-down','x','arrow-right','arrow-up-right','bookmark','arrows-diff','copy','download','check','map-pin']
base=f'https://raw.githubusercontent.com/tabler/tabler-icons/{revision}'
def fetch(name):
 r=requests.get(f'{base}/icons/outline/{name}.svg',timeout=30);r.raise_for_status();(root/f'{name}.svg').write_text(r.text,encoding='utf-8')
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(fetch,names))
r=requests.get(f'{base}/LICENSE',timeout=30);r.raise_for_status();(root/'LICENSE').write_text(r.text,encoding='utf-8')
(root/'provenance.json').write_text(json.dumps({'repository':'https://github.com/tabler/tabler-icons','revision':revision,'icons':names,'adaptation':'stroke-width 1.75; inline SVG, currentColor'},indent=2),encoding='utf-8')
print(revision,len(names))
