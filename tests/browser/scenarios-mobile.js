async original=>{
 const context=await original.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'no-preference'}),page=await context.newPage(),errors=[];
 const assert=(ok,message)=>{if(!ok)throw new Error(message);},base=new URL(original.url()).origin;
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.addInitScript(()=>{window.__scenarioMotion=[];const native=Element.prototype.animate;Element.prototype.animate=function(...args){const effect=native.apply(this,args);queueMicrotask(()=>{if(effect.id.startsWith('gm:scenario')||effect.id.startsWith('gm:dialog'))window.__scenarioMotion.push(effect.id);});return effect;};});
  await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  const save=async name=>{
   await page.locator('#scenario-save').tap();await page.locator('#scenario-name').fill(name);
   await page.locator('#scenario-note').fill('Проверить вход с улицы');await page.locator('#scenario-submit').tap();
   await page.locator('#scenario-dialog').waitFor({state:'hidden'});
  };
  await save('Кофейня — первая проверка');
  await page.locator('#business-trigger').tap();await page.getByRole('option',{name:'Аптека',exact:true}).tap();
  await page.locator('#run').tap();await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
  await save('Аптека — другой радиус');
  await page.getByTestId('scenario-compare').first().tap();await page.getByTestId('scenario-compare').nth(1).tap();
  assert((await page.locator('#scenario-comparison').innerText()).includes('Основания сравнения разные'),'Different categories/radii get no comparison caveat');
  const geometry=[];
  for(const [width,scale] of [[360,1],[390,1],[390,2],[768,1],[1440,1]]){
   await page.setViewportSize({width,height:900});await page.evaluate(scale=>{document.documentElement.style.fontSize=scale*100+'%';},scale);
   const size=await page.locator('#scenarios-section').evaluate(section=>{
    const targets=[...section.querySelectorAll('button,summary')].filter(n=>n.getClientRects().length);
    return {page:document.documentElement.scrollWidth,small:targets.filter(n=>{const r=n.getBoundingClientRect();return r.height<43.9||r.width<43.9;}).map(n=>n.textContent),clipped:targets.filter(n=>n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1).map(n=>n.textContent),table:section.querySelector('.table-scroll').getBoundingClientRect().width};
   });
   assert(size.page<=width&&!size.small.length&&!size.clipped.length,JSON.stringify({width,scale,size}));geometry.push({width,scale,...size});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  await page.locator('#scenario-comparison .table-scroll').scrollIntoViewIfNeeded();
  await page.locator('#scenario-comparison .table-scroll').focus();await page.keyboard.press('ArrowRight');
  assert(await page.locator('#scenario-comparison .table-scroll').evaluate(n=>n.scrollWidth>n.clientWidth),'Mobile comparison lacks internal scrolling');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert(await page.evaluate(()=>!document.getAnimations().some(a=>a.id.startsWith('gm:')&&a.playState==='running')),'Runtime reduced motion leaves running scenario effects');
  await page.locator('#scenarios-section').screenshot({path:'tests/artifacts/scenarios/touch-comparison-390.png'});
  await page.setViewportSize({width:1440,height:1000});await page.locator('#scenarios-section').screenshot({path:'tests/artifacts/scenarios/touch-comparison-1440.png'});
  const motion=await page.evaluate(()=>[...new Set(window.__scenarioMotion)]);
  assert(motion.includes('gm:scenario')&&motion.includes('gm:dialog-enter'),'Scenario interactions have no visible motion');
  assert(!errors.length,errors.join(';'));
  return {touch:true,categories:['cafe','pharmacy'],geometry,motion,pageErrors:errors};
 }finally{await context.close();}
}
