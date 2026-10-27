import { $, node, animateUI, cancelUI, cancelRevealsWithin, clearSnapshot, exitSnapshot, motionStagger } from './ui.js';

let initialized=false,current=null;

function enhance(select) {
  const label=select.labels[0],id=select.id;
  if(!label)return;
  label.id ||= `${id}-label`;
  const wrapper=node('div','choice'),trigger=node('button','choice-trigger');
  trigger.type='button';trigger.id=`${id}-trigger`;
  trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-controls',`${id}-listbox`);trigger.setAttribute('aria-expanded','false');
  const value=node('span','choice-value'),mark=node('span','choice-mark',id==='business'?'▦':'⌖'),arrow=node('span','choice-arrow','⌄');
  mark.setAttribute('aria-hidden','true');arrow.setAttribute('aria-hidden','true');
  value.id=`${id}-value`;
  trigger.setAttribute('aria-labelledby',`${label.id} ${value.id}`);
  trigger.append(mark,value,arrow);
  const menu=node('div','choice-menu');menu.id=`${id}-listbox`;menu.hidden=true;
  menu.setAttribute('role','listbox');menu.setAttribute('aria-labelledby',label.id);
  select.before(wrapper);wrapper.append(select,trigger);document.body.append(menu);
  label.htmlFor=trigger.id;
  if(select.dataset.testid){trigger.dataset.testid=select.dataset.testid;delete select.dataset.testid;}
  let opened=false,options=[],rows=[],active=-1,query='',typedAt=0,anchorTop=0;

  function close(focus=false,animate=true) {
    if(!opened)return;
    opened=false;
    cancelRevealsWithin(menu);
    if(animate&&!select.closest('dialog[open]'))exitSnapshot(menu,'choice-close');
    menu.hidden=true;
    if(menu.parentElement!==document.body)document.body.append(menu);
    trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');
    if(current===controller)current=null;
    if(focus&&!trigger.disabled)trigger.focus({preventScroll:true});
  }
  function setActive(index) {
    if(index<0)return;
    active=index;
    rows.forEach((row,i)=>row.classList.toggle('is-active',i===active));
    trigger.setAttribute('aria-activedescendant',rows[active].id);
    // Rounded layout metrics need a pixel of margin at enlarged text sizes.
    const row=rows[active],top=row.offsetTop-1,bottom=row.offsetTop+row.offsetHeight+1;
    if(top<menu.scrollTop)menu.scrollTop=top;
    else if(bottom>menu.scrollTop+menu.clientHeight)menu.scrollTop=bottom-menu.clientHeight;
  }
  function sync() {
    close(false,false);
    trigger.disabled=select.disabled;
    const description=select.getAttribute('aria-describedby');
    if(description)trigger.setAttribute('aria-describedby',description);
    else trigger.removeAttribute('aria-describedby');
    value.textContent=select.selectedOptions[0]?.textContent||'Выберите вариант';
    options=[...select.options].filter(option=>!option.hidden);
    rows=options.map((option,index)=>{
      const row=node('div','choice-option'),symbol=node('span','choice-option-mark',id==='business'?option.textContent.trim()[0]:'⌖'),check=node('span','choice-check','✓');
      row.id=`${id}-option-${index}`;row.dataset.index=index;row.setAttribute('role','option');
      row.setAttribute('aria-selected',String(option.value===select.value));
      if(option.disabled)row.setAttribute('aria-disabled','true');
      symbol.setAttribute('aria-hidden','true');check.setAttribute('aria-hidden','true');
      row.append(symbol,node('span','',option.textContent),check);
      return row;
    });
    menu.replaceChildren(...rows);
  }
  function open() {
    if(opened||trigger.disabled||trigger.closest('[hidden]'))return;
    current?.close(false);
    clearSnapshot(menu);
    const host=select.closest('dialog[open]')||document.body;host.append(menu);
    if(host!==document.body)cancelUI(host);
    cancelUI(trigger.closest('.settings'));
    trigger.focus({preventScroll:true});
    window.scrollTo({left:scrollX,top:scrollY,behavior:'instant'});
    const rect=trigger.getBoundingClientRect(),preferred=parseFloat(getComputedStyle(menu).getPropertyValue('--size-choice-menu'))||256;
    const width=Math.min(Math.max(rect.width,preferred),innerWidth-32);
    anchorTop=rect.top;
    const below=innerHeight-rect.bottom-16,above=rect.top-16,down=below>=240||below>=above;
    const available=Math.max(0,Math.min(320,down?below:above));
    if(available<44)return;
    Object.assign(menu.style,{width:`${width}px`,left:`${Math.max(16,Math.min(rect.left,innerWidth-width-16))}px`,maxHeight:`${available}px`,top:down?`${rect.bottom+8}px`:'auto',bottom:down?'auto':`${innerHeight-rect.top+8}px`});
    menu.hidden=false;opened=true;current=controller;query='';
    trigger.setAttribute('aria-expanded','true');
    setActive(Math.max(0,options.findIndex(option=>option.value===select.value&&!option.disabled)));
    animateUI(menu,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],'choice-open',{duration:'base',easing:'emphasized'});
    rows.forEach((row,index)=>animateUI(row,[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],'choice-row',{duration:'fast',delay:index*motionStagger()/2}));
  }
  function choose(index,focus=true) {
    const option=options[index];
    if(!option||option.disabled||select.disabled)return;
    const changed=select.value!==option.value;
    select.value=option.value;
    close(focus);
    sync();
    if(changed){
      select.dispatchEvent(new Event('input',{bubbles:true}));
      select.dispatchEvent(new Event('change',{bubbles:true}));
      animateUI(value,[{opacity:.35,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],'choice-value',{duration:'fast'});
    }
  }
  trigger.addEventListener('click',()=>opened?close():open());
  trigger.addEventListener('keydown',event=>{
    const key=event.key,enabled=options.map((option,index)=>option.disabled?-1:index).filter(index=>index>=0);
    if(key==='Tab'){if(opened)choose(active,false);return;}
    if(key==='Escape'){if(opened){event.preventDefault();close(true);}return;}
    if(['ArrowDown','ArrowUp','Home','End','PageDown','PageUp','Enter',' '].includes(key)){
      event.preventDefault();const wasOpen=opened;open();if(!opened||!enabled.length)return;
      if((key==='Enter'||key===' ')&&wasOpen){choose(active);return;}
      if(key==='Home'||key==='PageUp')setActive(enabled[0]);
      else if(key==='End'||key==='PageDown')setActive(enabled.at(-1));
      else if(wasOpen&&(key==='ArrowDown'||key==='ArrowUp')){
        const at=enabled.indexOf(active),next=Math.max(0,Math.min(enabled.length-1,at+(key==='ArrowDown'?1:-1)));
        setActive(enabled[next]);
      }
      return;
    }
    if(key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
      event.preventDefault();open();if(!opened)return;
      const now=performance.now(),letter=key.toLocaleLowerCase('ru-RU');
      query=now-typedAt>700?letter:query+letter;typedAt=now;
      if([...query].every(char=>char===letter))query=letter;
      const start=query.length===1?active+1:active;
      for(let step=0;step<options.length;step++){
        const index=(start+step+options.length)%options.length;
        if(!options[index].disabled&&options[index].textContent.trim().toLocaleLowerCase('ru-RU').startsWith(query)){setActive(index);break;}
      }
    }
  });
  menu.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse')event.preventDefault();});
  menu.addEventListener('pointermove',event=>{const row=event.target.closest('.choice-option');if(row&&options[+row.dataset.index]&&!options[+row.dataset.index].disabled)setActive(+row.dataset.index);});
  menu.addEventListener('click',event=>{const row=event.target.closest('.choice-option');if(row)choose(+row.dataset.index);});
  document.addEventListener('pointerdown',event=>{if(opened&&!trigger.contains(event.target)&&!menu.contains(event.target))close();});
  document.addEventListener('focusin',event=>{if(opened&&!trigger.contains(event.target)&&!menu.contains(event.target))close();});
  document.addEventListener('change',event=>{if(opened&&event.target!==select)close();});
  window.addEventListener('scroll',event=>{if(opened&&!menu.contains(event.target)&&Math.abs(trigger.getBoundingClientRect().top-anchorTop)>1)close(false,false);},true);
  window.addEventListener('resize',()=>close(false,false));
  window.addEventListener('beforeprint',()=>close(false,false));
  matchMedia('print').addEventListener('change',event=>{if(event.matches)close(false,false);});
  select.addEventListener('input',sync);select.addEventListener('change',sync);
  const controller={close};
  new MutationObserver(sync).observe(select,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','aria-describedby']});
  sync();
  select.hidden=true;
}

export function initChoiceMenus() {
  if(initialized)return;
  initialized=true;
  for(const id of ['district','business','radius']){
    const select=$(id);
    if(select)enhance(select);
  }
}

export function closeChoiceMenus(){current?.close(false,false);}
