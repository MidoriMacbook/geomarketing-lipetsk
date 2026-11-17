// Opt-in diagnostics: no requests, persistence or changes to the analysis state.
const round=n=>Math.round(n*10)/10;
const rect=selector=>{
 const el=document.querySelector(selector);if(!el)return null;
 const r=el.getBoundingClientRect(),s=getComputedStyle(el);
 return {top:round(r.top),bottom:round(r.bottom),height:round(r.height),documentTop:round(r.top+scrollY),display:s.display,marginTop:s.marginTop,marginBottom:s.marginBottom,paddingBottom:s.paddingBottom,minHeight:s.minHeight};
};
function units(){
 const probe=document.createElement('div');probe.style.cssText='position:fixed;left:-9999px;width:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';document.body.append(probe);
 const s=getComputedStyle(probe),safe=[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft];
 probe.style.padding='0';const heights={};for(const unit of ['svh','dvh','lvh']){probe.style.height=`100${unit}`;heights[unit]=round(probe.getBoundingClientRect().height);}probe.remove();return {...heights,safe};
}
const control='ГеоМаркетинг 0123456789';
function font(selector){
 const el=document.querySelector(selector);if(!el)return null;
 const s=getComputedStyle(el),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 const measure=family=>{ctx.font=`${s.fontStyle} ${s.fontWeight} 24px ${family}`;return round(ctx.measureText(control).width);};
 return {family:s.fontFamily,style:s.fontStyle,weight:s.fontWeight,size:s.fontSize,check:document.fonts.check(`${s.fontStyle} ${s.fontWeight} 24px ${s.fontFamily}`,control),width:measure(s.fontFamily),fallback:{serif:measure('serif'),sans:measure('sans-serif'),Arial:measure('Arial'),Georgia:measure('Georgia')}};
}
export function debugSnapshot(){
 const sheet=document.querySelector('#recommendations'),root=getComputedStyle(document.documentElement);
 const geometry={map:rect('#map'),card:rect('#map-card'),footer:rect('#map-card .map-footer'),panel:rect('#recommendations'),next:rect('#workspace>.analysis-context-row')||rect('.workspace-actions'),workspace:rect('#workspace'),page:rect('main.page')};
 const mapGap=geometry.next&&geometry.map?round(geometry.next.top-geometry.map.bottom):null;
 const cardGap=geometry.next&&geometry.card?round(geometry.next.top-geometry.card.bottom):null;
 return {time:new Date().toISOString(),userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visualWidth:visualViewport?.width,visualHeight:visualViewport?.height,visualTop:visualViewport?.offsetTop,...units()},support:{backdrop:CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)'),dialog:typeof HTMLDialogElement!=='undefined'&&'showModal' in HTMLDialogElement.prototype,has:CSS.supports('selector(:has(*))'),scrollTimeline:CSS.supports('animation-timeline','scroll()'),reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches},faces:[...document.fonts].map(f=>({family:f.family,style:f.style,weight:f.weight,status:f.status,range:f.unicodeRange})),control,fonts:Object.fromEntries([['brand','.brand'],['h1','#page-title .hero-title-word'],['italic','#page-title em'],['menu','#nav-menu a'],['body','body']].map(([name,selector])=>[name,font(selector)])),gap:{...geometry,mapGap,cardGap,reserve:root.getPropertyValue('--results-inset').trim()||'0px',panelVisible:sheet?.dataset.sheetActive,snap:sheet?.dataset.snap,sheetOffset:sheet?.style.getPropertyValue('--sheet-offset')}};
}
function showDebug(){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/static/css/mobile-debug.css';document.head.append(style);
 const panel=document.createElement('aside');panel.id='mobile-debug';panel.setAttribute('aria-label','Диагностика устройства');
 panel.style.cssText='position:fixed;inset:0;width:100%;overflow:auto';
 const toolbar=document.createElement('div');toolbar.className='debug-toolbar';
 const data=document.createElement('pre'),status=document.createElement('span');status.setAttribute('role','status');
 data.style.whiteSpace='pre-wrap';data.style.overflowWrap='anywhere';
 const toggle=document.createElement('button');toggle.type='button';toggle.id='debug-toggle';toggle.textContent='Диагностика';toggle.hidden=true;
 let snapshot;
 const refresh=()=>{
  snapshot=debugSnapshot();const v=snapshot.viewport,g=snapshot.gap;
  const lines=[`ГеоМаркетинг · диагностика ${snapshot.time.slice(11,19)}`,snapshot.userAgent,`Экран ${v.width}×${v.height} DPR ${v.dpr} | visual ${round(v.visualWidth||v.width)}×${round(v.visualHeight||v.height)}`,`100svh/dvh/lvh ${v.svh}/${v.dvh}/${v.lvh} | safe ↑→↓← ${v.safe.join('/')}`,Object.entries(snapshot.support).map(([k,value])=>`${k}:${value?'да':'нет'}`).join(' '),'FONT-FACE: family / style / weight / status'];
  for(const f of snapshot.faces)lines.push(`${f.family.replaceAll('"','')} ${f.style} ${f.weight} ${f.range.includes('400')?'cyr':'lat'}: ${f.status}`);
  lines.push('ШРИФТЫ: ширина строки 24px / serif / sans / Arial / Georgia');
  for(const [name,f] of Object.entries(snapshot.fonts))if(f){lines.push(`${name}: ${f.family} · ${f.style}/${f.weight}/${f.size} check:${f.check}`,`  px ${f.width} / ${Object.values(f.fallback).join(' / ')}`);}
  lines.push('КАРТА: верх / низ / высота (px)');
  for(const key of ['map','card','footer','panel','next']){const r=g[key];lines.push(`${key}: ${r?`${r.top} / ${r.bottom} / ${r.height} · mb:${r.marginBottom} pb:${r.paddingBottom}`:'нет'}`);}
  lines.push(`Панель: ${g.snap}, видима:${g.panelVisible} резерв:${g.reserve}`,`Промежуток карта→секция ${g.mapGap}; карточка→секция ${g.cardGap}`,`Порог viewport/шрифта меняется? Обновите в нужном состоянии.`,`Ширины — диагностический признак, не доказательство выбранного face.`);
  data.textContent=lines.join('\n');
  requestAnimationFrame(()=>{data.style.fontSize='10px';const available=panel.clientHeight-toolbar.offsetHeight-16;const size=Math.min(10,Math.max(7,10*available/data.scrollHeight));data.style.fontSize=`${size}px`;});
 };
 for(const [label,handler] of [['Обновить',refresh],['Копировать',async()=>{
  refresh();const text=JSON.stringify(snapshot,null,2);
  try{await navigator.clipboard.writeText(text);status.textContent='Скопировано';}
  catch{const area=document.createElement('textarea');area.value=text;panel.append(area);area.select();status.textContent=document.execCommand('copy')?'Скопировано':'Выделите текст';area.remove();}
 }],['Скрыть',()=>{panel.hidden=true;toggle.hidden=false;toggle.focus({preventScroll:true});}]]){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',handler);toolbar.append(button);
 }
 toolbar.append(status);panel.append(toolbar,data);document.body.append(panel,toggle);
 toggle.addEventListener('click',()=>{panel.hidden=false;toggle.hidden=true;refresh();});
 style.addEventListener('load',()=>requestAnimationFrame(refresh));
 refresh();document.fonts.ready.then(refresh);document.fonts.addEventListener('loadingdone',refresh);document.fonts.addEventListener('loadingerror',refresh);
 window.geoDebug={snapshot:debugSnapshot,refresh};
}
if(new URLSearchParams(location.search).get('debug')==='1'||location.hash==='#debug')showDebug();
