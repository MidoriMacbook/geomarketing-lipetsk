async original => {
  const base = new URL(original.url()).origin, metrics = [];
  for (const [width,scale] of [[360,1],[390,1],[430,1],[600,1],[768,1],[1024,1],[1440,1],[390,2],[768,2],[1024,2],[1440,2]]) {
    const context = await original.context().browser().newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    const page = await context.newPage();
    let release;
    const held = new Promise(resolve => {release=resolve;});
    try {
      await page.route('**/playfair-*.woff2',async route=>{await held;await route.continue().catch(()=>{});});
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.evaluate(async scale=>{
        document.documentElement.style.fontSize=`${100*scale}%`;
        await document.fonts.load('16px "Golos Text"','Текст');
        await document.fonts.load('16px "Golos Text"','Text');
      },scale);
      await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const measure=()=>page.evaluate(()=>({heading:document.getElementById('page-title').getBoundingClientRect().height,
        cta:document.querySelector('.hero-links').getBoundingClientRect().top,
        buttons:[...document.querySelectorAll('.hero-links>*')].map(el=>el.getBoundingClientRect().top),
        text:document.getElementById('page-title').textContent,
        overflow:document.documentElement.scrollWidth>innerWidth}));
      await page.evaluate(()=>{window.__fontCLS=0;new PerformanceObserver(list=>list.getEntries().forEach(entry=>{
        if(!entry.hadRecentInput)window.__fontCLS+=entry.value;
      })).observe({type:'layout-shift'});});
      const before=await measure(); release(); await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const after=await measure(),cls=await page.evaluate(()=>window.__fontCLS);
      const result={width,scale,before,after,cls};metrics.push(result);
      // Geometry isolates this font regression; whole-page CLS also includes
      // independent Material/data updates and is reported as a diagnostic.
      if(Math.abs(before.heading-after.heading)>1||Math.abs(before.cta-after.cta)>1||before.buttons.some((y,i)=>Math.abs(y-after.buttons[i])>1)||before.text!==after.text||before.overflow||after.overflow)
        throw Error(`Delayed display font shifts headline/CTA: ${JSON.stringify(result)}`);
    }finally{release();await context.close();}
  }
  return {ok:true,metrics};
}
