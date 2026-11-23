import json,re
from pathlib import Path
root=Path('static/assets/icons');paths={}
for file in root.glob('*.svg'):
 source=file.read_text(encoding='utf-8');body=re.search(r'<svg\b[^>]*>(.*?)</svg>',source,re.S).group(1).strip();paths[file.stem]=body
output='// Tabler Icons, MIT; source revision and license: static/assets/icons/.\nconst paths='+json.dumps(paths,ensure_ascii=False,separators=(',',':'))+';\n'
output+='''export function icon(name){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'20',height:'20',fill:'none',stroke:'currentColor','stroke-width':'1.75','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:'ui-icon'}))svg.setAttribute(key,value);
 svg.innerHTML=paths[name]||paths['map-pin'];return svg;
}
export const businessIcon=key=>({cafe:'coffee',pharmacy:'first-aid-kit',grocery:'basket',bakery:'bread',beauty:'scissors',fast_food:'burger',florist:'flower',pet:'paw',fitness:'barbell',dentist:'dental'})[key]||'map-pin';
'''
Path('static/js/icons.js').write_text(output,encoding='utf-8')
