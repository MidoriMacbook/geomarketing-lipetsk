async original => {
  const context = await original.context().browser().newContext({ viewport:{width:1440,height:1000}, reducedMotion:'reduce' });
  const page = await context.newPage(), failures=[], measurements=[];
  const check=(ok,message)=>{if(!ok)failures.push(message);};
  try {
    await page.goto(new URL(original.url()).origin);
    await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success',null,{timeout:70000});
    const theme=await page.evaluate(()=>({page:getComputedStyle(document.body).backgroundColor,scheme:getComputedStyle(document.documentElement).colorScheme,font:getComputedStyle(document.querySelector('h1')).fontFamily,header:getComputedStyle(document.querySelector('.site-header')).position,reserve:getComputedStyle(document.querySelector('.header-reserve')||document.querySelector('.site-header')).position}));
    check(theme.page==='rgb(255, 247, 230)','Cream page background required: '+theme.page);
    check(theme.scheme==='light','Native controls must use light colour scheme');
    check(theme.font.includes('Playfair'),'Editorial heading must use Playfair Display');
    check([theme.header,theme.reserve].some(value=>['fixed','sticky'].includes(value)),'Navigation must stay available when scrolling');
    for(const width of [390,768,1024,1440])for(const scale of [1,2]) {
      await page.setViewportSize({width,height:1000});
      await page.evaluate(scale=>document.documentElement.style.fontSize=`${100*scale}%`,scale);
      const m=await page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,map:rect('#map-card'),results:rect('#recommendations'),hero:rect('.intro'),header:rect('.site-header'),title:rect('h1'),targets:[...document.querySelectorAll('.hero-links a,.hero-links button,.leaflet-control-zoom a,#nav-toggle')].filter(n=>getComputedStyle(n).display!=='none').map(n=>({id:n.id||n.textContent.trim(),height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width}))};
      });
      check(!m.overflow,`${width}/${scale}: horizontal overflow`);
      check(m.title.bottom<=m.hero.bottom+1,`${width}/${scale}: clipped heading`);
      check(m.hero.top>=m.header.bottom-1,`${width}/${scale}: header overlaps cover`);
      check(m.targets.every(n=>n.height>=43.5&&n.width>=43.5),`${width}/${scale}: target smaller than 44px`);
      if(width>=1024)check(Math.abs(m.map.top-m.results.top)<2&&Math.abs(m.map.bottom-m.results.bottom)<2,`${width}/${scale}: shared workspace height lost`);
      measurements.push({width,scale,...m});
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(()=>document.documentElement.style.fontSize='100%');
    await page.locator('.place-select').nth(1).click();
    await page.locator('[data-testid="save-place"]').nth(1).click();
    await page.locator('[data-testid="compare-place"]').last().check();
    const contrast=await page.evaluate(()=>{
      const lum=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
      return ['.recommendation.selected .nearest','.recommendation:first-child .nearest','.saved-card:has(input:checked) p','.settings .hint','.leaflet-control-zoom a','.leaflet-control-attribution'].map(selector=>{
        const n=document.querySelector(selector);let surface=n;
        while(surface.parentElement&&getComputedStyle(surface).backgroundColor==='rgba(0, 0, 0, 0)')surface=surface.parentElement;
        const a=lum(getComputedStyle(n).color),b=lum(getComputedStyle(surface).backgroundColor);
        return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      });
    });
    check(contrast.every(n=>n.ratio>=4.5),'Text contrast below AA: '+JSON.stringify(contrast));
    if(failures.length)throw new Error(failures.join('\n'));
    return {theme,contrast,measurements};
  } finally {await context.close();}
}
