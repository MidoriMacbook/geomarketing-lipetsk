async original=>{
 const context=await original.context().browser().newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),page=await context.newPage(),errors=[];
 const base=new URL(original.url()).origin,assert=(ok,message)=>{if(!ok)throw new Error(message);};
 let release;const held=new Promise(resolve=>{release=resolve;});
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.addInitScript(()=>{window.__choiceMotion=[];const animate=Element.prototype.animate;Element.prototype.animate=function(...args){const effect=animate.apply(this,args);queueMicrotask(()=>{if(effect.id.startsWith('gm:choice'))window.__choiceMotion.push(effect.id);});return effect;};});
  await page.route('**/api/catalog',async route=>{await held;await route.continue().catch(()=>{});});
  await page.goto(base);
  assert(await page.locator('#business-trigger').count()===1,'Styled business menu is missing');
  assert(await page.locator('#business-trigger').isDisabled(),'Loading catalog leaves menu enabled');
  release();
  await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  const business=page.locator('#business-trigger'),district=page.locator('#district-trigger');
  assert(await page.locator('#business').isHidden(),'Native browser menu remains exposed');
  assert(await business.getAttribute('role')==='combobox','Choice trigger lacks combobox semantics');
  await page.evaluate(()=>{window.__choiceChanges=0;document.getElementById('business').addEventListener('change',()=>window.__choiceChanges++);});
  await business.click();
  assert(await page.getByRole('listbox').count()===1,'Popup list is not accessible');
  assert(await page.getByRole('option').count()===5,'Business options differ from catalog');
  await business.press('ArrowDown');
  assert(await page.locator('#business').inputValue()==='cafe','Arrow navigation prematurely commits');
  await business.press('Escape');
  assert(await business.getAttribute('aria-expanded')==='false'&&await page.locator('#business').inputValue()==='cafe','Escape failed to cancel');
  await business.press('End');await business.press('Enter');
  assert(await page.locator('#business').inputValue()==='beauty','End/Enter did not choose final option');
  assert(await page.evaluate(()=>window.__choiceChanges)===1,'Selection dispatches change more than once');
  await business.dispatchEvent('keydown',{key:'п',code:'KeyG'});await business.press('Tab');
  assert(await page.locator('#business').inputValue()==='grocery','Cyrillic typeahead/Tab failed');
  assert(await page.evaluate(()=>document.activeElement.id)!=='business-trigger','Tab traps focus');
  const choices=await page.locator('#business').evaluate(n=>[...n.options].map(o=>({value:o.value,label:o.textContent})));
  for(const option of choices){
   await business.click();await page.getByRole('option',{name:option.label,exact:true}).click();
   assert(await page.locator('#business').inputValue()===option.value,'Pointer selection disagrees with native value');
  }
  await business.click();await district.click();
  assert(await page.getByRole('listbox').count()===1&&await business.getAttribute('aria-expanded')==='false','Two menus remain open');
  await page.getByRole('option',{name:'Своя область на карте',exact:true}).click();
  assert(await page.locator('#custom-box').isVisible(),'Custom area no longer expands');
  const radius=page.locator('#radius-trigger');await radius.click();await radius.press('End');await radius.press('Enter');
  assert(await page.locator('#radius').inputValue()==='1500','Radius menu does not update model input');
  await radius.click();
  await page.evaluate(()=>{const n=document.getElementById('district');n.value='center';n.dispatchEvent(new Event('change',{bubbles:true}));});
  assert(await page.getByRole('listbox').count()===0,'Hidden custom area leaves orphan radius popup');
  await business.click();await page.locator('#settings-title').click();
  assert(await business.getAttribute('aria-expanded')==='false','Outside click does not close');
  await business.click();
  await page.evaluate(()=>{document.getElementById('business').disabled=true;});
  await page.waitForFunction(()=>document.getElementById('business-trigger').disabled);
  assert(await page.getByRole('listbox').count()===0,'Disabling native select leaves popup open');
  await page.evaluate(()=>{document.getElementById('business').disabled=false;});
  await page.waitForFunction(()=>!document.getElementById('business-trigger').disabled);
  const geometry=[];
  for(const [width,scale] of [[360,1],[390,1],[390,2]]){
   await page.setViewportSize({width,height:640});await page.evaluate(scale=>{document.documentElement.style.fontSize=scale*100+'%';},scale);
   await business.scrollIntoViewIfNeeded();await business.click();
   const menu=await page.getByRole('listbox').boundingBox();
   assert(menu.x>=12&&menu.x+menu.width<=width-12&&menu.y>=8&&menu.y+menu.height<=640-8,'Popup escapes mobile viewport');
   await business.press('End');
   await page.waitForFunction(()=>!document.getAnimations().some(a=>a.id.startsWith('gm:choice')&&a.playState==='running'));
   const active=await business.getAttribute('aria-activedescendant');
   assert(await page.locator('#'+active).evaluate(row=>{const r=row.getBoundingClientRect(),m=row.parentElement.getBoundingClientRect();return r.top>=m.top&&r.bottom<=m.bottom;}),'Active option not scrolled into popup');
   await business.press('Escape');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Menu creates horizontal overflow');
   geometry.push({width,scale,menu});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await business.click();
  assert(await page.getByRole('listbox').evaluate(n=>!n.getAnimations({subtree:true}).some(a=>a.playState==='running')),'Reduced motion still animates menu');
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  assert(await page.getByRole('listbox').count()===0,'Resize leaves stale popup');
  const fallback=await context.newPage();fallback.on('pageerror',error=>errors.push(error.message));
  try{
   await fallback.route('**/static/js/choices.js',route=>route.abort());await fallback.goto(base);
   await fallback.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
   assert(await fallback.locator('#business').isVisible()&&await fallback.locator('#business').isEnabled(),'Optional menu failure breaks native fallback');
  }finally{await fallback.close();}
  const touchContext=await context.browser().newContext({viewport:{width:390,height:640},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  let touch;
  try{
   const phone=await touchContext.newPage();phone.on('pageerror',error=>errors.push(error.message));
   await phone.goto(base);await phone.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
   const trigger=phone.locator('#business-trigger');await trigger.tap();
   await phone.getByRole('option',{name:'Аптека',exact:true}).tap();
   assert(await phone.locator('#business').inputValue()==='pharmacy','Touch selection did not commit');
   assert(await trigger.getAttribute('aria-expanded')==='false','Touch selection leaves popup open');
   await phone.evaluate(()=>{document.documentElement.style.fontSize='200%';});
   await trigger.tap();
   assert(await phone.evaluate(()=>document.activeElement.id)==='business-trigger','Touch opening loses combobox focus');
   const box=await phone.getByRole('listbox').boundingBox(),cdp=await touchContext.newCDPSession(phone);
   const x=box.x+box.width/2,y=box.y+box.height-25,before=await phone.getByRole('listbox').evaluate(n=>n.scrollTop);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let step=1;step<=8;step++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*15}]});
    await phone.waitForTimeout(30);
   }
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await phone.waitForFunction(before=>document.getElementById('business-listbox').scrollTop>before+20,before);
   const after=await phone.getByRole('listbox').evaluate(n=>n.scrollTop);
   assert(await phone.locator('#business').inputValue()==='pharmacy','Swipe accidentally selects business');
   assert(await trigger.getAttribute('aria-expanded')==='true','Swipe closes popup');
   await phone.getByRole('option',{name:'Салон красоты',exact:true}).tap();
   assert(await phone.locator('#business').inputValue()==='beauty','Tap after swipe fails');
   touch={hasTouch:true,textScale:2,scrollBefore:before,scrollAfter:after,selected:'beauty'};
  }finally{await touchContext.close();}
  const motion=await page.evaluate(()=>window.__choiceMotion);
  assert(motion.includes('gm:choice-open')&&motion.includes('gm:choice-row')&&motion.includes('gm:choice-value'),'Menus lack opening/option/value feedback');
  assert(!errors.length,errors.join(';'));
  return {choices:choices.length,geometry,touch,motion:[...new Set(motion)],pageErrors:errors};
 }finally{release();await context.close();}
}
