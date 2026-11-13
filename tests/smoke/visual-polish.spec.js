import {test,expect} from '@playwright/test';

test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===baseURL?r.continue():r.abort());
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
