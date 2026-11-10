import { state } from './state.js';
import { animateUI, cancelUI, motionReduced } from './ui.js';
import { closeChoiceMenus } from './choices.js';

let initialized=false;
export function initMobileWorkspace() {
 if(initialized)return;initialized=true;
 const byId=id=>document.getElementById(id),mobile=matchMedia('(max-width:600px), (max-width:950px) and (max-height:500px) and (pointer:coarse)');
 const settings=byId('settings'),map=byId('map-card'),workspace=byId('workspace'),dialog=byId('mobile-settings-dialog'),opener=byId('mobile-settings-open');
 const bar=byId('mobile-settings-bar');
 const trust=byId('trust-status'),trustHome=document.createComment('trust-home');trust.before(trustHome);
 const footer=document.createElement('div');footer.className='mobile-sheet-actions';dialog.append(footer);
 const home=document.createComment('settings-home'),runHome=document.createComment('run-home'),barHome=document.createComment('mobile-settings-bar-home');
 settings.before(home);byId('run').before(runHome);bar.before(barHome);
 const kpis=document.querySelector('.kpis'),area=byId('area-details'),secondary=area.querySelector('.area-details-grid');
 const context=document.querySelector('.analysis-context-row'),summaryHome=document.createComment('area-summary-home');
 context.before(summaryHome);
 const cards=Object.fromEntries(['residents','houses','competitors','places'].map(key=>[key,byId('kpi-'+key).parentElement]));
 const sections=[['saved-section','Сохранённые места'],['scenarios-section','Архив исследований']].map(([id,title])=>{
  const section=byId(id),marker=document.createComment(id+'-home'),details=document.createElement('details'),summary=document.createElement('summary');
  details.className='mobile-secondary-details';summary.textContent=title;details.append(summary);section.before(marker);
  return {section,marker,details,summary,title};
 });
 let revision=0,closing=false,collapseAfterRun=false,returnTo=null;
 function selectionMatchesResult() {
  const data=state.current;
  if(!data)return false;
  const custom=data.analysis_context?.custom===true||data.district==='custom'||data.district.startsWith('custom_');
  if(byId('district').value!==(custom?'custom':data.district)||byId('business').value!==data.business)return false;
  if(!custom)return true;
  // Сервер округляет центр до четырёх знаков; сравниваем с отправленными параметрами,
  // чтобы собственная область после успешного расчёта не выглядела изменённой.
  const request=new URLSearchParams(state.currentRequestKey||'');
  const center=request.get('district')==='custom'&&request.has('lat')&&request.has('lng')
   ?[Number(request.get('lat')),Number(request.get('lng'))]:data.analysis_context?.center||data.center;
  return Number(byId('radius').value)===(data.analysis_context?.requested_radius_m||data.half_m)
   && state.customPoint?.length===2 && center?.length===2
   && state.customPoint.every((value,index)=>value.toFixed(5)===center[index].toFixed(5));
 }
 function syncSummary() {
  const district=byId('district'),business=byId('business');
  byId('mobile-settings-selection').textContent=[district.selectedOptions[0]?.textContent,business.selectedOptions[0]?.textContent].filter(Boolean).join(' · ');
  const phase=document.documentElement.dataset.analysisState;
  opener.querySelector('.mobile-settings-label').textContent=phase==='error'?'Проверить':state.current?'Изменить':'Настроить';
  byId('mobile-settings-state').textContent=!state.catalog?'Настройте параметры':phase==='calculating'||phase==='refreshing'?'Выполняется расчёт…':district.value==='custom'&&!state.customPoint?'Выберите центр на карте':phase==='error'?'Проверьте параметры и повторите расчёт':state.current&&!selectionMatchesResult()?'Выполните расчёт — параметры изменены':state.openedScenarioId?'Сохранённый расчёт':state.current?'Расчёт готов':'Готово к расчёту';
  document.documentElement.dataset.mobileHasResult=String(!!state.current);
  for(const item of sections){
   const count=item.section.id==='saved-section'?state.saved.length:byId('scenario-count')?.textContent?.split('/')[0]?.trim();
   item.summary.textContent=item.title+(count?' · '+count:'');
   item.details.hidden=item.section.hidden;
  }
 }
 function finishClose(token,restoreFocus=true) {
  if(token!==revision)return;
  cancelUI(dialog);closing=false;
  delete dialog.dataset.closing;dialog.style.removeProperty('transform');gesture=null;
  if(dialog.open)dialog.close();
  if(mobile.matches)byId('mobile-settings-content').append(settings);
  delete document.documentElement.dataset.mobileSheetOpen;
  opener.setAttribute('aria-expanded','false');
  if(restoreFocus&&mobile.matches&&returnTo?.isConnected)returnTo.focus({preventScroll:true});
 }
 function closeSettings({immediate=false,restoreFocus=true}={}) {
  if(!dialog.open)return;
  closeChoiceMenus();collapseAfterRun=false;closing=true;
  dialog.dataset.closing='true';
  const token=++revision;cancelUI(dialog);
  if(immediate||motionReduced()){finishClose(token,restoreFocus);return;}
  const animation=animateUI(dialog,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(24px)'}],'mobile-settings-close',{duration:'fast',easing:'emphasized'});
  if(animation)animation.finished.then(()=>finishClose(token,restoreFocus),()=>{});else finishClose(token,restoreFocus);
 }
 function openSettings(trigger=opener) {
  if(!mobile.matches)return;
  settings.classList.remove('inline-settings');byId('mobile-settings-content').append(settings);
  ++revision;closing=false;collapseAfterRun=false;cancelUI(dialog);returnTo=trigger;
  delete dialog.dataset.closing;
  document.documentElement.dataset.mobileSheetOpen='true';opener.setAttribute('aria-expanded','true');
  if(!dialog.open)dialog.showModal();
  // Поля остаются теми же элементами; фокус не меняет положение страницы.
  (byId('district-trigger')||byId('district')).focus({preventScroll:true});
  animateUI(dialog,[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'translateY(0)'}],'mobile-settings-open',{duration:'workspace',easing:'spring'});
 }
 function syncLayout() {
  const focused=document.activeElement,focusedSection=sections.find(item=>item.section.contains(focused));
  closeSettings({immediate:true,restoreFocus:false});
  if(mobile.matches){
   map.querySelector('.map-footer').append(trust);
   workspace.prepend(bar,map);byId('mobile-settings-content').append(settings);settings.classList.remove('inline-settings');
   map.after(context,kpis,area);
   secondary.append(cards.houses,cards.competitors);
   byId('display-options').after(byId('loading-hint'),byId('error'));footer.append(byId('run'));
   for(const item of sections){item.marker.after(item.details);item.details.append(item.section);}
  } else {
   trustHome.after(trust);
   settings.classList.remove('inline-settings');
   summaryHome.after(context,kpis,area);
   barHome.after(bar);home.after(settings);settings.after(map);
   kpis.append(cards.residents,cards.houses,cards.competitors,cards.places);
   runHome.after(byId('run'),byId('loading-hint'),byId('error'));
   for(const item of sections){item.marker.after(item.section);item.details.remove();}
   if(dialog.contains(document.activeElement))byId('settings-title').focus({preventScroll:true});
  }
  document.documentElement.dataset.mobileLayout=mobile.matches?'phone':'wide';syncSummary();
  if(focusedSection&&!focusedSection.section.hidden){
   if(mobile.matches)focusedSection.details.open=true;
   if(focused.isConnected)focused.focus({preventScroll:true});
  }
 }
 opener.addEventListener('click',()=>openSettings(opener));
 byId('mobile-settings-close').addEventListener('click',()=>closeSettings());
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  delete dialog.dataset.closing;
  cancelUI(dialog);
  closeChoiceMenus();closing=false;delete document.documentElement.dataset.mobileSheetOpen;opener.setAttribute('aria-expanded','false');
  if(mobile.matches)byId('mobile-settings-content').append(settings);
 });
 // Жест только на заголовке: прокрутка полей не закрывает лист.
 const grip=dialog.querySelector('.mobile-sheet-heading');
 let gesture=null;
 grip.addEventListener('pointerdown',event=>{
  if(event.target.closest('button')||event.button!==0)return;
  cancelUI(dialog);gesture={id:event.pointerId,y:event.clientY,delta:0};grip.setPointerCapture(event.pointerId);
 });
 grip.addEventListener('pointermove',event=>{
  if(gesture?.id!==event.pointerId)return;
  gesture.delta=Math.max(0,event.clientY-gesture.y);dialog.style.transform=`translateY(${gesture.delta}px)`;
 });
 const finishGesture=event=>{
  if(gesture?.id!==event.pointerId)return;
  const delta=gesture.delta;gesture=null;dialog.style.removeProperty('transform');
  if(event.type==='pointerup'&&delta>70)closeSettings();
  else animateUI(dialog,[{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],'settings-return',{duration:'fast',easing:'spring'});
 };
 grip.addEventListener('pointerup',finishGesture);grip.addEventListener('pointercancel',finishGesture);
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const box=dialog.getBoundingClientRect();
  if(event.clientY<box.top||event.clientX<box.left||event.clientX>box.right)closeSettings();
 });
 byId('run').addEventListener('click',()=>{collapseAfterRun=mobile.matches&&dialog.open;},{capture:true});
 byId('mobile-custom-map').addEventListener('click',()=>{
  closeSettings({immediate:true});document.dispatchEvent(new Event('gm:map-focus'));const target=byId('map');if(!target.hasAttribute('tabindex'))target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({behavior:motionReduced()?'instant':'smooth',block:'center'});
 });
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');if(!mobile.matches||!link)return;
  if(link.hash==='#settings'){
   event.preventDefault();event.stopImmediatePropagation();openSettings(link);return;
  }
  const item=sections.find(item=>link.hash==='#'+item.section.id);
  if(item)item.details.open=true;
 },{capture:true});
 for(const id of ['district','business','radius'])byId(id).addEventListener('change',syncSummary);
 document.addEventListener('gm:analysis-rendered',syncSummary);
 new MutationObserver(()=>{
  const phase=document.documentElement.dataset.analysisState;syncSummary();
  if(collapseAfterRun&&phase==='success')closeSettings();
  else if(phase==='error')collapseAfterRun=false;
 }).observe(document.documentElement,{attributes:true,attributeFilter:['data-analysis-state']});
 new MutationObserver(syncSummary).observe(byId('scenario-count'),{childList:true});
 new MutationObserver(syncSummary).observe(byId('saved-count'),{childList:true});
 new MutationObserver(syncSummary).observe(byId('scenarios-section'),{attributes:true,attributeFilter:['hidden']});
 mobile.addEventListener('change',syncLayout);
 matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',event=>{
  if(!event.matches)return;
  if(closing)finishClose(revision);else cancelUI(dialog);
 });
 window.addEventListener('beforeprint',()=>closeSettings({immediate:true,restoreFocus:false}));
 syncLayout();
}
