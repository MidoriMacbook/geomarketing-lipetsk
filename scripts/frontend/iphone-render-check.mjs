import {chromium,devices,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome'}),rows=[],dir='docs/verification/iphone-layout/metrics';
try{for(const width of [375,390]){
 const p=await b.newPage({...devices['iPhone 13'],viewport:{width,height:width===375?667:844},reducedMotion:'reduce'});
 await p.goto('https://geomarketing-lipetsk-redesign.onrender.com/',{timeout:90000});await expect(p.locator('html')).toHaveAttribute('data-analysis-state','success',{timeout:90000});
 await p.locator('#hero-map-link').tap();await p.locator('#map').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-120,behavior:'instant'}));
 await p.locator('.recommendation-pin').first().tap();await expect(p.locator('.map-inspection')).toBeVisible();
 await p.locator('.map-inspection').getByRole('button',{name:'О месте',exact:true}).tap();
 const cards=p.getByTestId('recommendation-card');const count=await cards.count();
 for(const card of (await cards.all()).slice(0,2)){const disclosure=card.locator('.mobile-rec-toggle');if(await disclosure.getAttribute('aria-expanded')==='false')await disclosure.tap();await card.getByTestId('save-place').tap();}
 await p.locator('#comparison-guide-open').tap();await expect(p.locator('#comparison-title')).toBeFocused();
 await p.screenshot({path:`${dir}/render-${width}-comparison.png`,scale:'css'});
 await p.locator('#comparison-map-link').tap();await expect(p.locator('#map-title')).toBeFocused();
 await p.screenshot({path:`${dir}/render-${width}-return.png`,scale:'css'});
 rows.push({width,recommendations:count,comparison:true,returned:true,overflow:await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)});await p.close();
}}finally{await b.close();await writeFile(dir+'/render-journey.json',JSON.stringify(rows,null,2));}
