async original => {
  const base=new URL(original.url()).origin,browser=original.context().browser(),results=[],errors=[];
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  for(const width of [390,768,1024,1440]) {
    const ctx=await browser.newContext({viewport:{width,height:1000},hasTouch:width===390,reducedMotion:'no-preference'});
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(base);await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>document.getElementById('hero-motion-root').dataset.heroReady==='true');
      await page.waitForFunction(()=>!document.querySelector('#page-title .hero-word'));
      const layout=await page.evaluate(()=>{
        const hero=document.getElementById('hero'),cta=document.getElementById('hero-model-button');
        return {width:innerWidth,height:hero.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth,
          mobile:getComputedStyle(document.querySelector('.city-mobile')).display,
          white:[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&[getComputedStyle(e).backgroundColor,getComputedStyle(e).color].includes('rgb(255, 255, 255)')).map(e=>e.id||e.tagName),
          cta:{height:cta.getBoundingClientRect().height,border:getComputedStyle(cta).borderTopWidth,bg:getComputedStyle(cta).backgroundColor}};
      });
      assert(!layout.overflow,`${width}: overflow`);assert(!layout.white.length,`${width}: white ${layout.white}`);
      assert(layout.cta.height>=44&&layout.cta.border==='0px'&&layout.cta.bg==='rgba(0, 0, 0, 0)','Secondary CTA must be a 44px text action');
      if(width===390)assert(layout.height<=560&&layout.mobile!=='none','Mobile schematic is missing or hero exceeds 560px');
      const route=page.locator(width===390?'.city-mobile .city-route':'.city-desktop .city-route');
      assert(await route.evaluate(e=>getComputedStyle(e).animationPlayState)==='running','SVG route is static');
      await page.locator('#hero-motion-toggle').click();
      assert(await route.evaluate(e=>getComputedStyle(e).animationPlayState)==='paused','SVG pause is ignored');
      await page.locator('#hero-motion-toggle').click();
      if(width===1440){
        const cta=page.locator('.hero-magnet a'),r=await cta.boundingBox();
        await page.mouse.move(r.x+r.width-8,r.y+r.height/2);
        await page.waitForFunction(()=>document.querySelector('.hero-magnet a').style.translate);
        const offset=await cta.evaluate(e=>Math.hypot(...getComputedStyle(e).translate.split(' ').map(parseFloat)));
        assert(offset>0&&offset<=6.02,'Magnet must move within 6px');
        await page.mouse.move(0,0);await page.waitForFunction(()=>!document.querySelector('.hero-magnet a').style.translate);
        await page.keyboard.press('Tab');await cta.focus();
        assert(await cta.evaluate(e=>e.matches(':focus-visible')),'Keyboard fixture has no visible focus');
        await page.mouse.move(r.x+r.width-8,r.y+r.height/2);
        assert(await cta.evaluate(e=>!e.style.translate),'Keyboard focus moved magnet');
      }
      // Sections are prepared only by JS; keyboard focus must reveal controls.
      const prepared=await page.locator('#saved-section').evaluate(e=>e.classList.contains('motion-prepared'));
      assert(prepared,'Below-fold saved section was not prepared');
      await page.locator('#saved-section').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.getElementById('saved-section').dataset.heroEntered==='true');
      await page.waitForFunction(()=>!document.getElementById('saved-section').style.transform);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForFunction(()=>document.getElementById('hero-motion-root').dataset.heroState==='reduced');
      assert(await page.locator('.motion-prepared').count()===0,'Reduce leaves hidden sections');
      assert(await route.evaluate(e=>getComputedStyle(e).animationName)==='none','Reduce leaves SVG loop');
      await page.emulateMedia({media:'print'});
      assert(await page.locator('#hero').evaluate(e=>getComputedStyle(e).display)==='none','Print contains hero');
      results.push(layout);
    } finally {await ctx.close();}
  }
  // A slow tile/image load must not defer the island until window.load.
  const early=await browser.newContext();const p=await early.newPage();let release;
  const gate=new Promise(resolve=>release=resolve);
  try {
    await p.route('**/slow-motion-proof.png',async route=>{await gate;await route.abort().catch(()=>{});});
    await p.route(base+'/',async route=>{
      const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('</body>','<img alt="" src="/slow-motion-proof.png" hidden></body>')});
    });
    await p.goto(base,{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>document.getElementById('hero-motion-root').dataset.heroReady==='true');
    assert(await p.evaluate(()=>document.readyState)!=='complete','Slow-load fixture must hold window.load');
  }finally{release();await early.close();}
  assert(!errors.length,errors.join(';'));return {results,pageErrors:errors,earlyIsland:true};
}
