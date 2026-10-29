import { replayCounter } from './counters.js';
import { state } from './state.js';
import { animateUI, cancelUI, motionReduced, node } from './ui.js';
import { nextFocus, focusDescription, analysisContext } from './analysis-focus.js';
import { setMapEmphasis } from './map.js';
import { initWorkspaceDisclosure } from './workspace-disclosure.js';

const keys=['residents','houses','competitors','places'];
const cards=new Map(),byId=id=>document.getElementById(id);
let active=null,baseStatus=null,focusedStatus=null;
function clearWaves(){document.querySelectorAll('.kpi-wave').forEach(wave=>{cancelUI(wave);wave.remove();});}
function showWave(button,event){
 clearWaves();if(motionReduced())return;
 const rect=button.parentElement.getBoundingClientRect(),size=Math.max(rect.width,rect.height)*2;
 const x=event.detail?event.clientX-rect.left:rect.width/2,y=event.detail?event.clientY-rect.top:rect.height/2;
 const wave=node('span','kpi-wave');wave.setAttribute('aria-hidden','true');
 Object.assign(wave.style,{width:size+'px',height:size+'px',left:x-size/2+'px',top:y-size/2+'px'});button.append(wave);
 animateUI(wave,[{transform:'scale(.05)',opacity:.16},{transform:'scale(1)',opacity:0}],'kpi-wave',{duration:'workspace',easing:'emphasized',cleanup:()=>wave.remove()});
}

function reserveStatusHeight() {
 const status=byId('analysis-status');if(!status)return;
 const width=status.getBoundingClientRect().width;if(!width)return;
 const styles=getComputedStyle(status),measure=status.cloneNode(false);
 measure.removeAttribute('id');measure.removeAttribute('role');measure.removeAttribute('aria-live');
 measure.setAttribute('aria-hidden','true');
 Object.assign(measure.style,{position:'absolute',visibility:'hidden',pointerEvents:'none',width:width+'px',height:'auto',minHeight:'0',margin:'0',padding:'0',border:'0',font:styles.font,letterSpacing:styles.letterSpacing,lineHeight:styles.lineHeight,overflowWrap:styles.overflowWrap,wordBreak:styles.wordBreak});
 status.parentElement.append(measure);
 let height=0;
 for(const text of [baseStatus||status.textContent,...keys.map(key=>focusDescription(key,state.current).text)]){
  measure.textContent=text;height=Math.max(height,measure.getBoundingClientRect().height);
 }
 measure.remove();status.style.setProperty('--size-analysis-status',Math.ceil(height)+'px');
}
function updateKpiStatus() {
 const status=byId('analysis-status');if(!status)return;
 focusedStatus=typeof L==='undefined'?'Карта недоступна · результаты расчёта сохранены':focusDescription(active,state.current).text;
 status.textContent=focusedStatus;
}
initWorkspaceDisclosure(byId('display-options'));
let statusMeasureKey='',statusFrame=null;
const resizeStatus=()=>{
 const status=byId('analysis-status'),width=status?.getBoundingClientRect().width;
 if(!width)return;
 const styles=getComputedStyle(status),key=[width,styles.font,styles.letterSpacing].join('|');
 if(key===statusMeasureKey)return;statusMeasureKey=key;
 cancelAnimationFrame(statusFrame);statusFrame=requestAnimationFrame(reserveStatusHeight);
};
if(typeof ResizeObserver!=='undefined'&&byId('analysis-status'))new ResizeObserver(resizeStatus).observe(byId('analysis-status'));
window.addEventListener('resize',resizeStatus);
document.fonts?.ready.then(reserveStatusHeight);
export function updateAnalysisContext(phase=document.documentElement.dataset.analysisState) {
 const target=byId('analysis-context');if(!target)return;
 const selection=state.catalog?{district_name:byId('district')?.selectedOptions[0]?.textContent,business_name:byId('business')?.selectedOptions[0]?.textContent}:{};
 target.textContent=analysisContext(state.current,state.openedScenarioId&&phase==='success'?'archive':phase,selection)+(state.current&&phase==='initial'?' · предыдущий расчёт, параметры изменены':'');
}
export function clearKpiFocus({immediate=false}={}) {
 clearWaves();
 const status=byId('analysis-status');
 if(active&&status?.textContent===focusedStatus)status.textContent=baseStatus;
 active=null;baseStatus=null;focusedStatus=null;
 cards.forEach(({card,button})=>{card.dataset.active='false';button.setAttribute('aria-pressed','false');button.querySelector('.kpi-action-label').firstChild.textContent='Показать на карте';});
 if(byId('map-card'))delete byId('map-card').dataset.kpiFocus;
 if(byId('recommendations'))delete byId('recommendations').dataset.kpiFocus;
 setMapEmphasis([],{animate:!immediate});
 syncButtons();
}
function syncButtons() {
 const available=!!state.current&&!['calculating','refreshing'].includes(document.documentElement.dataset.analysisState);
 cards.forEach(({number,button,label},key)=>{
  button.disabled=!available||!number.hasAttribute('data-counter-target');
  const action=button.getAttribute('aria-pressed')==='true'?'Снять выделение':'Показать на карте';
  button.setAttribute('aria-label',`${action}: ${label.toLocaleLowerCase('ru')}, ${number.textContent}. Повторить анимацию числа`);
  if(button.disabled&&active===key)clearKpiFocus({immediate:true});
 });
}

document.querySelectorAll('.kpis>div').forEach((card,index)=>{
 const key=keys[index],number=card.querySelector('strong');if(!key||!number)return;
 const label=card.firstElementChild.textContent.replace('≈','').trim();
 const button=node('button','kpi-replay');
 const hint=node('span','',`Показать связь показателя «${label}» с картой. Повторное нажатие снимает выделение.`);
 hint.id='kpi-action-'+key;hint.hidden=true;
 const action=node('span','kpi-action-label','Показать на карте'),icon=node('span','directional-icon icon-forward kpi-action-icon');
 action.setAttribute('aria-hidden','true');icon.setAttribute('aria-hidden','true');action.append(icon);button.append(action);
 button.type='button';button.setAttribute('aria-pressed','false');button.setAttribute('aria-controls','analysis-status');button.setAttribute('aria-describedby',hint.id);
 card.dataset.kpi=key;card.dataset.active='false';card.append(hint,button);
 cards.set(key,{card,number,button,label});
 new MutationObserver(syncButtons).observe(number,{childList:true,attributes:true,attributeFilter:['data-counter-target']});
 button.addEventListener('click',event=>{
  const wanted=nextFocus(active,key,!button.disabled);
  if(!wanted){clearKpiFocus();replayCounter(number);showWave(button,event);return;}
  if(!active)baseStatus=byId('analysis-status')?.textContent;
  active=wanted;
  cards.forEach(item=>{const selected=item.card===card;item.card.dataset.active=String(selected);item.button.setAttribute('aria-pressed',String(selected));item.button.querySelector('.kpi-action-label').firstChild.textContent=selected?'Снять выделение':'Показать на карте';});
  byId('map-card').dataset.kpiFocus=key;byId('recommendations').dataset.kpiFocus=key;
  setMapEmphasis(focusDescription(key,state.current).layers);updateKpiStatus();
  replayCounter(number);
  showWave(button,event);
  syncButtons();
 });
});
syncButtons();
document.addEventListener('gm:analysis-rendered',()=>{clearKpiFocus({immediate:true});updateAnalysisContext('success');syncButtons();reserveStatusHeight();});
document.addEventListener('gm:recommendation-selected',()=>clearKpiFocus());
new MutationObserver(()=>{
 const phase=document.documentElement.dataset.analysisState;
 if(['initial','calculating','refreshing','error'].includes(phase))clearKpiFocus({immediate:true});
 updateAnalysisContext(phase);syncButtons();reserveStatusHeight();
}).observe(document.documentElement,{attributes:true,attributeFilter:['data-analysis-state']});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||event.defaultPrevented||!active)return;
 if(document.querySelector('dialog[open],.site-header.nav-open,[role="listbox"]:not([hidden])')||event.target.closest('input,select,textarea,[role="combobox"]'))return;
 event.preventDefault();clearKpiFocus();
});
window.addEventListener('beforeprint',()=>{cards.forEach(({card})=>cancelUI(card));clearKpiFocus({immediate:true});});
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',event=>{if(event.matches)cards.forEach(({card})=>cancelUI(card));});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cards.forEach(({card})=>cancelUI(card));});
