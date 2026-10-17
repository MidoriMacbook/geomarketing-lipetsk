async original => {
  const context=await original.context().browser().newContext();
  const page=await context.newPage();
  try {
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(new URL(original.url()).origin);
    await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
    await page.locator('.place-select').nth(1).click();
    await page.locator('[data-testid="save-place"]').nth(1).click();
    await page.locator('[data-testid="compare-place"]').last().check();
    await page.locator('#model-button').click();
    const contrast=await page.evaluate(()=>{
      const luminance=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const cards=['.recommendation.selected .nearest','.saved-card:has(input:checked) p'].map(selector=>{
        const node=document.querySelector(selector),surface=node.closest('article');
        const values=[luminance(getComputedStyle(node).color),luminance(getComputedStyle(surface).backgroundColor)].sort((a,b)=>b-a);
        return {selector,ratio:(values[0]+.05)/(values[1]+.05)};
      });
      const controls=['.recommendation:nth-child(2) .save.is-saved','#close-model'].map(selector=>{
        const style=getComputedStyle(document.querySelector(selector));
        const values=[luminance(style.color),luminance(style.backgroundColor)].sort((a,b)=>b-a);
        return {selector,ratio:(values[0]+.05)/(values[1]+.05)};
      });
      const selection=getComputedStyle(document.querySelector('#settings h2'),'::selection');
      const values=[luminance(selection.color),luminance(selection.backgroundColor)].sort((a,b)=>b-a);
      return [...cards,...controls,{selector:'#settings h2::selection',ratio:(values[0]+.05)/(values[1]+.05)}];
    });
    if(contrast.some(value=>value.ratio<4.5))throw new Error('Selected text contrast: '+JSON.stringify(contrast));
    return contrast;
  }finally{await context.close();}
}
