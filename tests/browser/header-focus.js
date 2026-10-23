async original => {
  const base=new URL(original.url()).origin,metrics=[];
  for(const [width,height,scale] of [[390,320,2],[390,600,2],[1440,900,1]]) {
    const context=await original.context().browser().newContext({viewport:{width,height},reducedMotion:'reduce'});
    const page=await context.newPage();
    try {
      await page.goto(base);await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
      await page.evaluate(scale=>document.documentElement.style.fontSize=`${100*scale}%`,scale);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.locator('#print-report').focus();
      for(let index=0;index<9;index++) {
        await page.keyboard.press('Shift+Tab');
        const target=await page.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect();
          return {id:el.id,label:el.textContent.trim().slice(0,50),top:r.top,bottom:r.bottom,
            header:document.getElementById('site-header').getBoundingClientRect().bottom};});
        metrics.push({width,height,scale,...target});
        if(target.top<target.header-1||target.bottom>height+1)
          throw Error(`Keyboard focus is covered by sticky header: ${JSON.stringify(metrics.at(-1))}`);
      }
    }finally{await context.close();}
  }
  return {ok:true,checked:metrics.length,metrics};
}
