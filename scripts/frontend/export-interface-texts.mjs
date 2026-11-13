import {readFile,readdir,writeFile} from 'node:fs/promises';
import {parseAst} from 'rollup/parseAst';
import {spawnSync} from 'node:child_process';
const russian=/[А-Яа-яЁё]/u;
const clean=text=>text.replace(/\s+/gu,' ').trim().replaceAll('&nbsp;',' ').replaceAll('&amp;','&');
const sections=[];
const html=await readFile('static/index.html','utf8');
const texts=[...html.replace(/<script\b[\s\S]*?<\/script>/g,'').matchAll(/>([^<>]+)</g)].map(m=>clean(m[1])).filter(t=>russian.test(t));
texts.push(...[...html.matchAll(/(?:aria-label|title|placeholder)="([^"]+)"/g)].map(m=>clean(m[1])).filter(t=>russian.test(t)));
sections.push(['static/index.html',texts]);
for(const name of (await readdir('static/js')).filter(n=>n.endsWith('.js')).sort()){
 const source=await readFile(`static/js/${name}`,'utf8'),strings=[];
 const walk=node=>{
  if(!node||typeof node!=='object')return;
  if(node.type==='Literal'&&typeof node.value==='string'&&russian.test(node.value))strings.push(clean(node.value));
  if(node.type==='TemplateLiteral'){
   const literal=source.slice(node.start+1,node.end-1);if(russian.test(literal))strings.push(clean(literal));return;
  }
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
 };
 walk(parseAst(source));if(strings.length)sections.push([`static/js/${name}`,strings]);
}
const api=spawnSync(process.platform==='win32'?'.venv/Scripts/python.exe':'python',['-c',
 `import ast,json,re\nfrom pathlib import Path\nresult=[]\nfiles=[Path('src/config.py'),Path('src/domain/businesses.py'),Path('src/domain/scoring.py'),Path('src/utils/validation.py'),Path('src/services/analysis_service.py'),*Path('src/routes').glob('*.py')]\nfor p in files:\n tree=ast.parse(p.read_text(encoding='utf-8')); strings=[n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str) and re.search('[А-Яа-яЁё]',n.value)]\n if strings:result.append([p.as_posix(),strings])\nprint(json.dumps(result,ensure_ascii=True))`],{encoding:'utf8'});
if(api.status!==0)throw Error(api.stderr);sections.push(...JSON.parse(api.stdout));
const lines=['# Тексты интерфейса ГеоМаркетинг Липецк','',
 'Подписи, сообщения, доступные имена и динамические шаблоны из HTML и собственных JavaScript-модулей; ниже также названия и сообщения API. `${…}` обозначает подстановку данных. Сторонние библиотеки не включены. В перечне Python-строк также присутствуют описания модулей — они не выводятся пользователю.',''];
for(const [file,values] of sections){lines.push(`## ${file}`,'',...[...new Set(values)].map(s=>`- ${s.replaceAll('<','&lt;').replaceAll('>','&gt;')}`),'');}
await writeFile('docs/interface-texts.md',lines.join('\n'));
