async original => {
  const base=new URL(original.url()).origin,metrics=[];
  for(const [height,scale] of [[320,1],[320,2],[600,2]]) {
    const context=await original.context().browser().newContext({viewport:{width:390,height},reducedMotion:'reduce'});
    const page=await context.newPage();
    try {
      await page.goto(base);await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
      await page.locator('#scenario-save').evaluate(el=>el.click());
      await page.locator('#scenario-name').fill('Проверка перехода');
      await page.locator('#scenario-submit').click();
      await page.waitForFunction(()=>!document.getElementById('scenario-dialog').open);
      await page.evaluate(scale=>document.documentElement.style.fontSize=`${100*scale}%`,scale);
      await page.waitForFunction(()=>document.getElementById('site-header').dataset.navigationReady==='true');
      await page.locator('#nav-toggle').click();
      await page.locator('#nav-menu a[href="#workspace"]').click();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const geometry=await page.evaluate(()=>({target:document.getElementById('workspace').getBoundingClientRect().top,
        header:document.getElementById('site-header').getBoundingClientRect().bottom,
        focus:document.activeElement.id,open:document.getElementById('nav-toggle').getAttribute('aria-expanded')}));
      metrics.push({height,scale,...geometry});
      if(geometry.target<geometry.header-1||geometry.target>=height||geometry.focus!=='workspace'||geometry.open!=='false')
        throw Error(`Menu anchor is outside the usable viewport: ${JSON.stringify(metrics.at(-1))}`);
      // Exercise real anchor/default click handlers independently of hit target
      // scrolling; keyboard, touch and pointer activation are covered separately.
      for(const [selector,target,focus] of [
        ['.hero-links a[href="#workspace"]','workspace','workspace'],
        ['#trust-details-link','data-title','data-summary'],
        ['[data-testid="scenario-open"]','map-title','map-title']
      ]) {
        await page.locator(selector).evaluate(el=>el.click());
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const result=await page.evaluate(target=>({target:document.getElementById(target).getBoundingClientRect().top,
          header:document.getElementById('site-header').getBoundingClientRect().bottom,focus:document.activeElement.id}),target);
        metrics.push({height,scale,selector,...result});
        if(result.target<result.header-1||result.target>=height||result.focus!==focus)
          throw Error(`Direct destination is outside the usable viewport: ${JSON.stringify(metrics.at(-1))}`);
      }
    }finally{await context.close();}
  }
  return {ok:true,metrics};
}
