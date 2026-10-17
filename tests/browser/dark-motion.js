async originalPage => {
  const page = await originalPage.context().newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (value, message) => {if(!value)throw new Error(message);};
  try {
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.addInitScript(() => {
      window.__darkEffects=[];
      const animate=Element.prototype.animate;
      Element.prototype.animate=function(...args){
        const effect=animate.apply(this,args);
        queueMicrotask(()=>{if(effect.id.startsWith('gm:'))window.__darkEffects.push({id:effect.id,rank:this.dataset.rank,stale:window.__darkOldCards?.includes(this)||false,duration:effect.effect.getTiming().duration,delay:effect.effect.getTiming().delay,top:this.getBoundingClientRect().top});});
        return effect;
      };
    });
    const base=new URL(originalPage.url()).origin;
    await page.goto(base);
    await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
    const cards=page.locator('[data-testid="recommendation-card"]');
    assert(await cards.count()===3,'Expected three real recommendations');
    assert((await cards.first().boundingBox()).y>844,'Mobile fixture must begin below viewport');
    const before=await page.evaluate(()=>window.__darkEffects.filter(e=>e.id==='gm:recommendation'));
    assert(before.length===0,`Recommendation effects were consumed offscreen: ${JSON.stringify(before)}`);
    await cards.first().scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>window.__darkEffects.some(e=>e.id==='gm:recommendation'&&e.rank==='1'));
    const entered=await page.evaluate(()=>window.__darkEffects.filter(e=>e.id==='gm:recommendation'));
    assert(entered.every(e=>e.duration>=650),'Result reveal is still too brief');
    const dark=await page.evaluate(()=>({scheme:getComputedStyle(document.documentElement).colorScheme,bg:getComputedStyle(document.body).backgroundColor,tileFilter:getComputedStyle(document.querySelector('.leaflet-tile-pane')).filter,canvasFilter:getComputedStyle(document.querySelector('.leaflet-points-pane')).filter}));
    assert(dark.scheme==='dark' && dark.bg!=='rgb(241, 238, 230)','Dark theme was not applied');
    assert(dark.tileFilter!=='none'&&dark.canvasFilter==='none','Map processing must affect only tiles');
    const selectionContrast=await page.evaluate(()=>{
      const style=getComputedStyle(document.body,'::selection');
      const luminance=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
      const values=[luminance(style.color),luminance(style.backgroundColor)].sort((a,b)=>b-a);
      return (values[0]+.05)/(values[1]+.05);
    });
    assert(selectionContrast>=4.5,`Selected text contrast is too low: ${selectionContrast}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Decorative background causes mobile horizontal overflow');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>!document.getAnimations().some(a=>a.id.startsWith('gm:')&&a.playState==='running'));
    const cancelledCount=await page.evaluate(()=>window.__darkEffects.length);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await cards.nth(2).scrollIntoViewIfNeeded();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert(await cards.nth(2).isVisible(),'Reduced motion hid final content');
    assert(await page.evaluate(()=>window.__darkEffects.length)===cancelledCount,'Reduced motion did not clear deferred entrances');
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
    await page.evaluate(()=>{window.__darkOldCards=[...document.querySelectorAll('[data-testid="recommendation-card"]')];});
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
    await cards.first().scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.getAnimations().some(a=>a.id==='gm:recommendation'&&a.playState==='running'));
    assert(await page.evaluate(()=>window.__darkEffects.every(effect=>!effect.stale)),'A replaced recommendation received a stale entrance');
    await page.emulateMedia({media:'print'});
    const print=await page.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor,ink:getComputedStyle(document.getElementById('print-report-content')).color}));
    assert(print.bg==='rgb(255, 255, 255)'&&print.ink==='rgb(21, 25, 28)','Dark theme must not create a dark printed report');
    await page.emulateMedia({media:'screen',reducedMotion:'no-preference'});
    const fallback=await originalPage.context().newPage();
    try {
      await fallback.addInitScript(()=>{window.IntersectionObserver=undefined;});
      await fallback.goto(base);
      await fallback.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
      assert(await fallback.locator('[data-testid="recommendation-card"]').count()===3,'No IntersectionObserver blocked results');
      assert(await fallback.locator('#run').isEnabled(),'No IntersectionObserver blocked native controls');
    }finally{await fallback.close();}
    assert(errors.length===0,errors.join(';'));
    return {before,entered,dark,selectionContrast,print,pageErrors:errors};
  }finally{await page.close();}
}
