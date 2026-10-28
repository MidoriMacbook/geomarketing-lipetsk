import { state } from './state.js';
import { animateUI } from './ui.js';

let initialized=false;
export function initWorkspaceReturn(){
 if(initialized)return;initialized=true;
 const context=document.getElementById('hero-return-context'),link=document.getElementById('hero-map-link');
 let requested=false,explicitAnalysis=null;
 function sync(){
  const current=state.current;
  const candidates=[...state.saved.map(item=>({date:item.saved_at,data:item,label:'Сохранённое место'})),...state.scenarios.map(item=>({date:item.updated_at||item.saved_at,data:item.analysis,label:'Сохранённое исследование'}))];
  candidates.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  const recent=current&&(current===explicitAnalysis||state.openedScenarioId)?{data:current,label:state.openedScenarioId?'Открытое исследование':'Продолжить анализ'}:candidates[0];
  const text=recent?`${recent.label} · ${recent.data.district_name} · ${recent.data.business_name}`:'';
  const appeared=context.hidden&&!!text;
  context.textContent=text;context.title=text;context.hidden=!text;
  link.querySelector('span').textContent=text?'Вернуться к карте':'Открыть карту';
  if(text)link.setAttribute('aria-describedby',context.id);else link.removeAttribute('aria-describedby');
  if(appeared)animateUI(context,[{opacity:0},{opacity:1}],'workspace-return',{duration:'fast'});
 }
 for(const id of ['run','refresh-data'])document.getElementById(id).addEventListener('click',()=>{requested=true;},{capture:true});
 document.getElementById('district').addEventListener('change',()=>{requested=true;},{capture:true});
 document.addEventListener('gm:analysis-rendered',()=>{if(requested&&state.current){explicitAnalysis=state.current;requested=false;}sync();});
 document.addEventListener('gm:comparison-changed',sync);
 document.addEventListener('gm:scenarios-changed',sync);
 document.getElementById('comparison-research-button').addEventListener('click',()=>document.getElementById('scenario-save').click());
 new MutationObserver(()=>{document.getElementById('comparison-research-button').disabled=document.getElementById('scenario-save').disabled;}).observe(document.getElementById('scenario-save'),{attributes:true,attributeFilter:['disabled']});
 sync();
}
