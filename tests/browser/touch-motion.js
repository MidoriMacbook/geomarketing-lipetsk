async original => {
 const base=new URL(original.url()).origin, browser=original.context().browser(), metrics=[],errors=[];
 const assert=(condition,message)=>{if(!condition)throw Error(message);};
 for(const width of [390,768,1024,1440]) {
  const ctx=await browser.newContext({viewport:{width,height:1000},hasTouch:width===390});
  const page=await ctx.newPage(); page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.goto(base); await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
   await page.waitForFunction(()=>!document.querySelector('.kpis .is-counting'));
   const layout=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
    font:getComputedStyle(document.body).fontFamily,hero:document.getElementById('hero').getBoundingClientRect().height,
    background:getComputedStyle(document.getElementById('site-header')).backgroundColor}));
   assert(!layout.overflow,`${width}: horizontal overflow`); assert(layout.font.includes('Onest'),'Onest not applied');
   assert(await page.locator('#hero-motion-toggle').count()===0,'Technical pause control remains');
   if(width<=900) {
    const toggle=page.locator('#nav-toggle'),menu=page.locator('#nav-menu');
    assert(await menu.evaluate(e=>e.inert),'Closed menu is not inert');
    await toggle.click(); await page.waitForTimeout(120);
    const opening=await menu.evaluate(e=>({opacity:+getComputedStyle(e).opacity,display:getComputedStyle(e).display,inert:e.inert}));
    assert(opening.opacity>0&&opening.opacity<1&&opening.display==='grid'&&!opening.inert,`No opening transition: ${JSON.stringify(opening)}`);
    await page.waitForTimeout(450); await page.keyboard.press('Tab');
    assert(await page.evaluate(()=>document.activeElement.hash==='#workspace'),'Tab did not enter menu');
    await page.keyboard.press('Escape');
    assert(await menu.evaluate(e=>e.inert),'Escape did not inert menu immediately');
    assert(await toggle.evaluate(e=>e===document.activeElement),'Escape lost focus');
    await page.waitForTimeout(100); const closing=await menu.evaluate(e=>+getComputedStyle(e).opacity);
    assert(closing>0&&closing<1,'No closing transition');
    await page.waitForTimeout(300); await toggle.click(); await page.waitForTimeout(450);
    await page.locator('#nav-menu a[href="#workspace"]').click();
    await page.waitForFunction(()=>document.activeElement.id==='workspace');
    await page.waitForTimeout(800);
    assert(await page.evaluate(()=>document.getElementById('workspace').getBoundingClientRect().top>=document.getElementById('site-header').getBoundingClientRect().bottom-1),'Anchor covered by header');
    await toggle.click(); await page.waitForTimeout(450); await page.mouse.click(5,600);
    assert(await menu.evaluate(e=>e.inert),'Outside click failed');
   } else {
    await page.locator('#nav-menu a[href="#saved-section"]').click(); await page.waitForTimeout(1000);
    const selected=await page.locator('.nav-indicator').evaluate(e=>({transform:getComputedStyle(e).transform,width:e.getBoundingClientRect().width}));
    assert(selected.width>0&&selected.transform!=='none','Desktop indicator missing');
    assert(await page.evaluate(()=>{const a=document.querySelector('#nav-menu a.active').getBoundingClientRect(),b=document.querySelector('.nav-indicator').getBoundingClientRect();return Math.abs(a.left-b.left)<2&&Math.abs(a.width-b.width)<2;}),'Indicator not aligned with active section');
   }
   await page.evaluate(()=>scrollTo({top:900,behavior:'instant'}));await page.waitForTimeout(250);
   assert(await page.locator('#site-header').evaluate(e=>getComputedStyle(e).backgroundColor)===layout.background,'Header changes colour');
   const cards=page.locator('.kpis>div');
   const dataBefore=await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');return JSON.stringify(state.current);});
   for(let index=0;index<4;index++) {
    const card=cards.nth(index),button=card.locator('button'),number=card.locator('strong');
    await button.scrollIntoViewIfNeeded();await page.waitForTimeout(800);
    const text=await number.textContent(),label=await button.getAttribute('aria-label');
    assert(label.includes(text)&&label.includes('Повторить анимацию'),'Replay accessible name missing');
    if(width===390)await button.tap();else await button.click();
    const active=await card.evaluate(e=>({counting:e.querySelector('strong').classList.contains('is-counting'),animations:e.getAnimations({subtree:true}).filter(a=>a.id.startsWith('gm:kpi')).length}));
    assert(active.counting&&active.animations>0,'KPI replay did not start');
    assert(await number.textContent()===text,'Accessible exact value changed');
    await button.focus();await page.keyboard.press('Enter');await page.keyboard.press('Space');
    await button.evaluate(e=>{for(let i=0;i<8;i++)e.click();});
    await page.waitForTimeout(1000);
    assert(await number.textContent()===text,'Repeated presses corrupted exact value');
    assert(await card.evaluate(e=>!e.querySelector('.is-counting')&&!e.classList.contains('is-replaying')&&e.getAnimations().length===0),'Replay did not settle');
   }
   assert(dataBefore===await page.evaluate(async()=>{const {state}=await import('/static/js/state.js');return JSON.stringify(state.current);}), 'Replay changed analysis');
   await page.emulateMedia({reducedMotion:'reduce'});
   await cards.first().locator('button').click();
   assert(await cards.first().evaluate(e=>!e.querySelector('.is-counting')&&e.getAnimations({subtree:true}).length===0&&e.classList.contains('is-replaying')),'Reduced motion should give tint only');
   if(width<=900) {
    await page.locator('#nav-toggle').click();
    assert(await page.locator('#nav-menu').evaluate(e=>getComputedStyle(e).opacity==='1'),'Reduced menu does not open immediately');
    await page.keyboard.press('Escape');
   } else {
    await page.locator('#nav-menu a[href="#saved-section"]').click();
    await page.waitForTimeout(100);
    assert(await page.evaluate(()=>{const a=document.querySelector('#nav-menu a.active').getBoundingClientRect(),b=document.querySelector('.nav-indicator').getBoundingClientRect();return Math.abs(a.left-b.left)<2;}),'Reduced indicator loses final position');
   }
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   await page.screenshot({path:`tests/artifacts/editorial/touch-${width}.png`});
   await page.emulateMedia({media:'print'});
   assert(await page.locator('.header-reserve').evaluate(e=>getComputedStyle(e).display==='none'),'Print header visible');
   metrics.push(layout);
  } finally {await ctx.close();}
 }
 assert(!errors.length,errors.join(';'));
 return {ok:true,metrics,errors};
}
