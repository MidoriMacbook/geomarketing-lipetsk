import {test,expect} from '@playwright/test';

test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
});

test('знак приблизительного числа сохраняется при повторе счётчика',async({page})=>{
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 const residents=page.locator('#kpi-residents');await residents.scrollIntoViewIfNeeded();
 await expect(residents).toHaveText('≈\u00a05\u00a0100');
 await page.locator('[data-kpi=residents] .kpi-replay').click();
 await expect(residents.locator('.counter-visual')).toHaveAttribute('data-display',/^≈\u00a0/);
 await expect(residents).not.toHaveClass(/is-counting/);
 await expect(residents.locator('.counter-visual')).toHaveAttribute('data-display','≈\u00a05\u00a0100');
 await expect(page.locator('[data-kpi=residents]>span').first()).toHaveText('Жителей в области');
});

test('аннотации читаются и не пересекаются, reduced motion отключает появление',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [375,768,1440,1920]){
  await page.setViewportSize({width,height:1000});await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  const labels=await page.locator('.hero-annotation:visible').evaluateAll(groups=>groups.map(g=>{
   const text=g.querySelector('text'),rect=g.querySelector('rect'),box=rect.getBoundingClientRect();
   return {size:parseFloat(getComputedStyle(text).fontSize)*text.getScreenCTM().a,fill:getComputedStyle(rect).fill,opacity:getComputedStyle(g).opacity,animation:getComputedStyle(g).animationName,box:{x:box.x,y:box.y,right:box.right,bottom:box.bottom}};
  }));
  expect(labels).toHaveLength(width===375?2:3);
  for(const label of labels){expect(label.size).toBeGreaterThanOrEqual(12);expect(label.fill).toBe('rgb(255, 247, 230)');expect(label.opacity).toBe('1');expect(label.animation).toBe('none');expect(label.box.x).toBeGreaterThanOrEqual(0);expect(label.box.right).toBeLessThanOrEqual(width);}
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i].box,b=labels[j].box;expect(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y).toBe(true);}
  const coordinates=await page.locator('.atlas-coordinates').boundingBox(),art=await page.locator('#hero-art').boundingBox();expect(coordinates.y).toBeGreaterThanOrEqual(art.y+art.height);
 }
});

test('заголовок копируется без разрыва названия и выделение не касается соседних строк',async({page})=>{
 for(const width of [375,768,1440,1920]){
  await page.setViewportSize({width,height:1000});await page.goto('/');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1100);
  const result=await page.locator('#page-title').evaluate(h=>{
   const range=document.createRange();range.setStartBefore(h.firstElementChild);range.setEndAfter(h.querySelector('em'));
   const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
   const rects=[...range.getClientRects()],top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom));
   return {text:selection.toString(),topGap:top-document.querySelector('.hero-copy>.eyebrow').getBoundingClientRect().bottom,bottomGap:h.querySelector('.hero-city').getBoundingClientRect().top-bottom,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  expect(result.text).toBe('ГеоМаркетинг');expect(result.topGap).toBeGreaterThan(5);expect(result.bottomGap).toBeGreaterThan(5);expect(result.overflow).toBe(false);
 }
});
