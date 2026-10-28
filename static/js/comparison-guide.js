import { state } from './state.js';
import { animateUI, motionReduced } from './ui.js';

let initialized=false;
const mobile=matchMedia('(max-width:600px), (max-width:950px) and (max-height:500px) and (pointer:coarse)');
const selected=()=>state.saved.filter(item=>state.comparison.has(item.id)).length;
const nextStep=count=>count===3?'Готово к сравнению: 3 места':count===2?'Можно сравнить 2 места':count===1?'Сохранено · добавьте ещё одно для сравнения':'Выберите места для сравнения';

export function openSavedComparison(){
 if(!state.saved.length)return;
 const target=selected()?document.getElementById('comparison-title'):document.querySelector('#saved-list [data-testid="compare-place"]');
 if(!target)return;
 for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
 if(!target.hasAttribute('tabindex')&&target.tagName!=='INPUT')target.tabIndex=-1;
 target.focus({preventScroll:true});target.scrollIntoView({behavior:motionReduced()?'instant':'smooth',block:target.tagName==='INPUT'?'center':'start'});
}

export function syncComparisonGuide(){
 const panel=document.getElementById('comparison-guide');if(!panel)return;
 const count=selected(),number=document.getElementById('comparison-guide-count'),text=`В сравнении: ${count} из 3`;
 const hidingFocused=!state.saved.length&&panel.contains(document.activeElement);
 panel.hidden=!state.saved.length;panel.dataset.ready=String(count>=2);
 if(hidingFocused){const heading=document.getElementById('recommendations-title');heading.tabIndex=-1;heading.focus({preventScroll:true});}
 if(number.textContent!==text){number.textContent=text;if(panel.getClientRects().length)animateUI(number,[{opacity:.45,transform:'scale(.98)'},{opacity:1,transform:'scale(1)'}],'comparison-count',{duration:'fast'});}
 document.querySelector('#comparison-guide-caption .comparison-caption-label').textContent=nextStep(count);
 document.querySelectorAll('[data-saved-feedback-id]').forEach(card=>{
  const id=card.dataset.savedFeedbackId,exists=state.saved.some(item=>item.id===id),message=card.querySelector('.save-confirmation'),link=card.querySelector('.compare-saved-link');
  if(!message||!link)return;
  link.hidden=!exists||!mobile.matches;
  message.querySelector('.confirmation-label').textContent=exists?(state.comparison.has(id)?nextStep(count):count>=3?'Сохранено · выбор сравнения заполнен':'Сохранено · выберите место для сравнения'):'';
  message.setAttribute('aria-label',exists?'Место сохранено в этом браузере.':'');
  if(!exists)delete card.dataset.savedFeedbackId;
 });
}

export function offerSavedComparison(card,id){
 if(!state.saved.some(item=>item.id===id))return;
 card.dataset.savedFeedbackId=id;
 // Используем прежний флажок и его проверку лимита; текущий набор не заменяется.
 const checkbox=[...document.querySelectorAll('#saved-list [data-testid="compare-place"]')].find(input=>input.closest('[data-saved-id]')?.dataset.savedId===id);
 if(checkbox&&!state.comparison.has(id))checkbox.click();
 syncComparisonGuide();
}

export function initComparisonGuide(){
 if(initialized)return;initialized=true;
 const number=document.getElementById('comparison-guide-count');number.setAttribute('role','status');number.setAttribute('aria-atomic','true');
 const caption=document.getElementById('comparison-guide-caption'),space=document.createElement('span'),label=document.createElement('span');
 space.className='comparison-caption-space';space.dataset.text=nextStep(1);space.setAttribute('aria-hidden','true');label.className='comparison-caption-label';caption.replaceChildren(space,label);
 document.getElementById('comparison-guide-open')?.addEventListener('click',openSavedComparison);
 document.addEventListener('gm:comparison-changed',syncComparisonGuide);
 document.addEventListener('gm:analysis-rendered',syncComparisonGuide);
 mobile.addEventListener('change',syncComparisonGuide);
 syncComparisonGuide();
}
