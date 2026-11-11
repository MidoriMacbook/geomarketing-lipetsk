import {test,expect} from '@playwright/test';

test('слои сохраняют состояние, выбранное место видно над плотной застройкой',async({page,baseURL})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-analysis-state','success');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const result=await page.evaluate(async()=>{
  const {state}=await import('/static/js/state.js');
  const {drawMap,selectMarker}=await import('/static/js/map.js');
  const houses=Array.from({length:1200},(_,i)=>({lat:state.current.center[0]+(i%40-20)*.00012,lng:state.current.center[1]+(Math.floor(i/40)-15)*.0002,residents:100+i%300}));
  const started=performance.now();drawMap({...state.current,houses});selectMarker(2,false);
  return {duration:performance.now()-started,view:document.getElementById('map').dataset.housesView};
 });
 expect(result.duration).toBeLessThan(1500);
 expect(['points','grid']).toContain(result.view);
 const houses=page.locator('[data-layer-key=houses]');
 await expect(houses).toHaveAttribute('aria-pressed','true');
 await houses.click();await expect(houses).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('#layer-houses')).not.toBeChecked();
 await houses.click();await expect(houses).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.recommendation-pin.is-selected')).toHaveText('2');
 await expect(page.locator('.leaflet-accessibility-pane path')).toHaveCount(1);
 await page.locator('.leaflet-control-zoom-out').click();
 await page.locator('.leaflet-control-zoom-out').click();
 await expect(page.locator('#map')).toHaveAttribute('data-houses-view','grid');
});
