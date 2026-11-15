import {icon} from './icons.js';
function decorate(el){
 if(el.querySelector(':scope>.ui-icon'))return;
 let name=null;
 if(el.matches('summary,.choice-arrow,.sheet-more'))name='chevron-down';
 else if(el.matches('.directional-icon'))name=el.classList.contains('icon-external')?'arrow-up-right':el.classList.contains('icon-download')?'download':'arrow-right';
 else if(el.matches('#run,#hero-map-link'))name='arrow-right';
 else if(el.matches('button')){
  const text=el.textContent.trim();
  if(text==='×'||text==='✕'){name='x';el.textContent='';}
  else if(/^Сохранить/.test(text))name='bookmark';
  else if(/^Сравнить/.test(text))name='arrows-diff';
  else if(/^Копировать/.test(text))name='copy';
  else if(/^Открыть/.test(text))name='arrow-right';
 }
 if(!name)return;
 if(el.matches('.sheet-more'))el.querySelector('[aria-hidden]')?.remove();
 el.append(icon(name));el.dataset.inlineIcon=name;
}
const selector='button,summary,.choice-arrow,.directional-icon,.sheet-more,#hero-map-link';
function scan(root){if(root.nodeType!==1)return;if(root.matches(selector))decorate(root);root.querySelectorAll(selector).forEach(decorate);}
scan(document.body);
new MutationObserver(records=>{for(const record of records){
 if(record.target.nodeType===1&&record.target.matches(selector))decorate(record.target);
 for(const added of record.addedNodes)scan(added);
}}).observe(document.body,{childList:true,subtree:true});
