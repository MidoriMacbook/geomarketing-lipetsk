async original => {
  const context=await original.context().browser().newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[];
  const base=new URL(original.url()).origin;
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  let phase='initial heading';
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.addInitScript(()=>{
      window.__introEffects=[];
      const animate=Element.prototype.animate;
      Element.prototype.animate=function(...args){
        const effect=animate.apply(this,args);
        queueMicrotask(()=>{if(effect.id==='gm:headline'){window.__introEffects.push(effect);effect.pause();}});
        return effect;
      };
    });
    await page.goto(base);
    const heading=page.locator('#page-title');
    assert(await heading.locator('.typed-char').count()>10,'Heading has no first-visit typing effect');
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>window.__introEffects.forEach(a=>{a.currentTime=600;}));
    const exact=await heading.textContent(),ax=await heading.ariaSnapshot(),height=await heading.evaluate(n=>n.offsetHeight);
    assert(ax.includes('У каждого бизнеса есть своё место.'),'Typing does not expose the full accessible heading');
    const intermediate=await heading.locator('.typed-char').evaluateAll(chars=>chars.filter(n=>getComputedStyle(n).opacity==='1').length);
    assert(intermediate>0&&intermediate<exact.length,'Headline is not progressively typed');
    await page.evaluate(()=>window.__introEffects.forEach(a=>a.play()));
    phase='typing finishes';
    await page.waitForFunction(()=>!document.querySelector('.typed-char'));
    assert(await heading.textContent()===exact,'Typing changed heading text');
    assert(Math.abs(await heading.evaluate(n=>n.offsetHeight)-height)<1,'Typing changes heading layout');
    const geometry=[];
    for(const [width,scale] of [[390,1],[768,1],[390,2]]){
      await page.setViewportSize({width,height:1000});
      await page.evaluate(()=>sessionStorage.removeItem('geomarketing.intro.v1'));
      await page.reload();
      await page.evaluate(scale=>{document.documentElement.style.fontSize=100*scale+'%';},scale);
      await page.evaluate(()=>document.fonts.ready);
      const before=await heading.evaluate(n=>n.offsetHeight);
      await page.evaluate(()=>window.__introEffects.forEach(a=>a.finish()));
      await page.waitForFunction(()=>!document.querySelector('.typed-char'));
      const after=await heading.evaluate(n=>n.offsetHeight);
      assert(before===after,'Typing changes mobile/zoom heading geometry');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Typing creates mobile/zoom overflow');
      assert(await page.locator('.kpis>div').evaluateAll(cards=>cards.every(n=>parseFloat(getComputedStyle(n).paddingLeft)>=16)),'KPI card text touches its border');
      geometry.push({width,scale,height:after});
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.reload();
    phase='real analysis';
    assert(await heading.locator('.typed-char').count()===0,'Typing replays on the same tab reload');
    await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
    const surfaces=await page.evaluate(()=>['settings','map-card','recommendations'].map(id=>getComputedStyle(document.getElementById(id)).backgroundColor));
    assert(new Set(surfaces).size===3,'Workspace surfaces are indistinguishable');
    assert(surfaces[0]==='rgb(240, 217, 228)','Settings are not on a contrasting powder panel');
    const map=await page.evaluate(async()=>{
      const {drawMap,drawZones}=await import('/static/js/map.js'),{state}=await import('/static/js/state.js');
      const circles=[],zones=[],circle=L.circleMarker,rectangle=L.rectangle;
      L.circleMarker=(point,options)=>{circles.push(options);return circle(point,options);};
      L.rectangle=(bounds,options)=>{zones.push(options);return rectangle(bounds,options);};
      try{drawMap(state.current);drawZones();}finally{L.circleMarker=circle;L.rectangle=rectangle;}
      const styles=getComputedStyle(document.documentElement);
      const colors=['house','competitor','centroid','zone-high'].map(role=>styles.getPropertyValue('--color-map-'+role).trim());
      return {colors,centroidRing:circles.some(o=>o.fill===false&&o.weight>=3),maxZoneOpacity:Math.max(...zones.map(o=>o.fillOpacity)),canvases:document.querySelectorAll('#map canvas').length};
    });
    const rgb=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    assert(map.colors.every((color,i)=>map.colors.slice(i+1).every(other=>Math.hypot(...rgb(color).map((v,j)=>v-rgb(other)[j]))>=60)),'Analytical map colors remain too similar');
    assert(map.centroidRing&&map.maxZoneOpacity<=.45&&map.canvases===2,'Map lacks distinct rings/translucent zones/shared canvas');
    assert(await page.locator('.sw.centroids').evaluate(n=>parseFloat(getComputedStyle(n).borderTopWidth)>=2),'Legend does not show the centroid ring');
    const states=[];
    for(const mode of ['reduce','print','hidden']){
      phase='cancel '+mode;
      await page.evaluate(()=>sessionStorage.removeItem('geomarketing.intro.v1'));
      await page.reload();
      assert(await heading.locator('.typed-char').count()>10,'New visit fixture has no animation');
      if(mode==='reduce')await page.emulateMedia({reducedMotion:'reduce'});
      if(mode==='print')await page.emulateMedia({media:'print'});
      if(mode==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
      await page.waitForFunction(()=>!document.querySelector('.typed-char'));
      assert(await heading.textContent()===exact,'Cancellation leaves a partial heading');
      states.push(mode);
      await page.emulateMedia({media:'screen',reducedMotion:'no-preference'});
      if(mode==='hidden')await page.evaluate(()=>{delete document.hidden;});
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    phase='initial reduced';
    await page.evaluate(()=>sessionStorage.removeItem('geomarketing.intro.v1'));
    await page.reload();
    assert(await heading.locator('.typed-char').count()===0,'Initial reduced motion still types');
    phase='blocked animation/storage';
    for(const nth of [1,3]){
      const fallback=await context.newPage();
      fallback.on('pageerror',error=>errors.push(error.message));
      try {
        await fallback.addInitScript(nth=>{
          Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked');}});
          const animate=Element.prototype.animate;let letters=0;
          Element.prototype.animate=function(...args){
            if(this.classList.contains('typed-char')&&++letters===nth)throw new Error('unsupported');
            return animate.apply(this,args);
          };
        },nth);
        await fallback.goto(base);
        await fallback.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
        assert(await fallback.locator('#page-title').textContent()===exact,'Storage/animation failure loses the heading');
        assert(await fallback.locator('.typed-char').count()===0,'Failed animation leaves hidden letters');
      }finally{await fallback.close();}
    }
    assert(!errors.length,errors.join(';'));
    return {intermediate,exact,ax,geometry,surfaces,map,states,pageErrors:errors};
  }catch(error){throw new Error(phase+': '+error.message);}
  finally{await context.close();}
}
