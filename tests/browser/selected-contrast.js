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
    const contrast=await page.evaluate(()=>{
      const luminance=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      return ['.recommendation.selected .nearest','.saved-card:has(input:checked) p'].map(selector=>{
        const node=document.querySelector(selector),surface=node.closest('article');
        const values=[luminance(getComputedStyle(node).color),luminance(getComputedStyle(surface).backgroundColor)].sort((a,b)=>b-a);
        return {selector,ratio:(values[0]+.05)/(values[1]+.05)};
      });
    });
    if(contrast.some(value=>value.ratio<4.5))throw new Error('Selected text contrast: '+JSON.stringify(contrast));
    return contrast;
  }finally{await context.close();}
}
