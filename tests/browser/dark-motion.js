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
        queueMicrotask(()=>{if(effect.id.startsWith('gm:'))window.__darkEffects.push({id:effect.id,rank:this.dataset.rank,duration:effect.effect.getTiming().duration,delay:effect.effect.getTiming().delay,top:this.getBoundingClientRect().top});});
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
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Decorative background causes mobile horizontal overflow');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>!document.getAnimations().some(a=>a.id.startsWith('gm:')&&a.playState==='running'));
    const cancelledCount=await page.evaluate(()=>window.__darkEffects.length);
    await cards.nth(2).scrollIntoViewIfNeeded();
    assert(await cards.nth(2).isVisible(),'Reduced motion hid final content');
    assert(await page.evaluate(()=>window.__darkEffects.length)===cancelledCount,'Reduced motion did not clear deferred entrances');
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
    return {before,entered,dark,print,pageErrors:errors};
  }finally{await page.close();}
}
