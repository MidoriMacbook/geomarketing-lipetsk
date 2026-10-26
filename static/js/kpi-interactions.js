import { replayCounter } from './counters.js';
import { state } from './state.js';
import { animateUI, cancelUI, motionReduced, node } from './ui.js';
import { nextFocus, focusDescription, analysisContext } from './analysis-focus.js';
import { setMapEmphasis } from './map.js';
import { initWorkspaceDisclosure } from './workspace-disclosure.js';

const keys=['residents','houses','competitors','places'];
const cards=new Map(),byId=id=>document.getElementById(id);
let active=null,guide=null;

function updateGuide() {
 const info=focusDescription(active,state.current||{});
 const names={houses:'Дома',zones:'Спрос',competitors:'Конкуренты'};
 const temporary=info.layers.filter(key=>byId('layer-'+key)?.checked===false).map(key=>names[key]);
 const message=byId('map-guide-message');
 if(message){message.textContent=info.text+(temporary.length?` Временно показаны отключённые слои: ${temporary.join(', ')}. Настройки слоёв сохранены.`:'');message.scrollTop=0;}
 if(byId('map-guide-first'))byId('map-guide-first').hidden=active!=='places'||!state.current?.recommendations.length;
 if(byId('map-guide-clear'))byId('map-guide-clear').textContent=active?'Снять выделение':'Закрыть пояснение';
}
export function updateAnalysisContext(phase=document.documentElement.dataset.analysisState) {
 const target=byId('analysis-context');if(!target)return;
 const selection=state.catalog?{district_name:byId('district')?.selectedOptions[0]?.textContent,business_name:byId('business')?.selectedOptions[0]?.textContent}:{};
 target.textContent=analysisContext(state.current,state.openedScenarioId&&phase==='success'?'archive':phase,selection);
}
export function clearKpiFocus({closeGuide=true,restoreFocus=false,immediate=false}={}) {
 const previous=cards.get(active);active=null;
 cards.forEach(({card,button})=>{card.dataset.active='false';button.setAttribute('aria-pressed','false');});
 if(byId('map-card'))delete byId('map-card').dataset.kpiFocus;
 if(byId('recommendations'))delete byId('recommendations').dataset.kpiFocus;
 setMapEmphasis([],{animate:!immediate});updateGuide();
 if(restoreFocus&&previous&&!previous.button.disabled)previous.button.focus({preventScroll:true});
 if(closeGuide)guide?.setOpen(false,{immediate});
}
function syncButtons() {
 const available=!!state.current&&!['calculating','refreshing'].includes(document.documentElement.dataset.analysisState);
 cards.forEach(({number,button,label},key)=>{
  button.disabled=!available||!number.hasAttribute('data-counter-target');
  button.setAttribute('aria-label',`Повторить анимацию: ${label.toLocaleLowerCase('ru')}, ${number.textContent}`);
  if(button.disabled&&active===key)clearKpiFocus({immediate:true});
 });
}

if(byId('map-guide')) {
 guide=initWorkspaceDisclosure(byId('map-guide'),open=>{
  if(!open&&active)clearKpiFocus({closeGuide:false});
  else if(open)updateGuide();
 });
 initWorkspaceDisclosure(byId('display-options'));
 byId('map-guide-clear').addEventListener('click',()=>clearKpiFocus({restoreFocus:true}));
 byId('map-guide-first').addEventListener('click',()=>{
  const first=document.querySelector('[data-testid="recommendation-card"] .place-select');
  if(!first)return;
  first.click();first.focus({preventScroll:true});
  first.closest('[data-testid="recommendation-card"]').scrollIntoView({behavior:motionReduced()?'instant':'smooth',block:'start'});
 });
}

document.querySelectorAll('.kpis>div').forEach((card,index)=>{
 const key=keys[index],number=card.querySelector('strong');if(!key||!number)return;
 const label=card.firstElementChild.textContent.replace('≈','').trim();
 const button=node('button','kpi-replay'),indicator=node('span','kpi-indicator'),progress=node('span','kpi-progress');
 const hint=node('span','',`Показать связь показателя «${label}» с картой. Повторное нажатие снимает выделение.`);
 hint.id='kpi-action-'+key;hint.hidden=true;
 indicator.setAttribute('aria-hidden','true');progress.setAttribute('aria-hidden','true');
 button.type='button';button.setAttribute('aria-pressed','false');button.setAttribute('aria-controls','map-guide');button.setAttribute('aria-describedby',hint.id);
 card.dataset.kpi=key;card.dataset.active='false';card.append(indicator,progress,hint,button);
 cards.set(key,{card,number,button,label});
 new MutationObserver(syncButtons).observe(number,{childList:true,attributes:true,attributeFilter:['data-counter-target']});
 button.addEventListener('click',()=>{
  const wanted=nextFocus(active,key,!button.disabled);
  if(!wanted){clearKpiFocus();replayCounter(number);return;}
  active=wanted;
  cards.forEach(item=>{const selected=item.card===card;item.card.dataset.active=String(selected);item.button.setAttribute('aria-pressed',String(selected));});
  byId('map-card').dataset.kpiFocus=key;byId('recommendations').dataset.kpiFocus=key;
  setMapEmphasis(focusDescription(key,state.current).layers);updateGuide();guide?.setOpen(true);
  replayCounter(number);
  if(!motionReduced())animateUI(card,[{transform:'scale(1)'},{transform:'scale(.985)',offset:.45},{transform:'scale(1)'}],'kpi-press',{duration:220});
 });
});
syncButtons();
document.addEventListener('gm:analysis-rendered',()=>{clearKpiFocus({immediate:true});updateAnalysisContext('success');syncButtons();});
document.addEventListener('gm:recommendation-selected',()=>clearKpiFocus());
new MutationObserver(()=>{
 const phase=document.documentElement.dataset.analysisState;
 if(['initial','calculating','refreshing'].includes(phase))clearKpiFocus({immediate:true});
 updateAnalysisContext(phase);syncButtons();
}).observe(document.documentElement,{attributes:true,attributeFilter:['data-analysis-state']});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||event.defaultPrevented||(!active&&!guide?.open))return;
 if(document.querySelector('dialog[open],.site-header.nav-open,[role="listbox"]:not([hidden])')||event.target.closest('input,select,textarea,[role="combobox"]'))return;
 event.preventDefault();clearKpiFocus({restoreFocus:byId('map-guide')?.contains(document.activeElement)});
});
window.addEventListener('beforeprint',()=>{cards.forEach(({card})=>cancelUI(card));clearKpiFocus({immediate:true});});
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',event=>{if(event.matches)cards.forEach(({card})=>cancelUI(card));});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cards.forEach(({card})=>cancelUI(card));});
