// Chromium: native touch through CDP. WebKit: trusted mouse pointer drag;
// Playwright exposes touch tap but no native touch drag for WebKit.
export async function gestureDriver(page){
 if(page.context().browser().browserType().name()==='chromium')return page.context().newCDPSession(page);
 return {async send(method,{type,touchPoints=[]}){
  if(method!=='Input.dispatchTouchEvent')throw new Error(`Unsupported gesture: ${method}`);
  const p=touchPoints[0];
  if(type==='touchStart'){await page.mouse.move(p.x,p.y);await page.mouse.down();}
  else if(type==='touchMove')await page.mouse.move(p.x,p.y);
  else await page.mouse.up();
 }};
}
export async function throttleCPU(page){
 if(page.context().browser().browserType().name()==='chromium'){
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 }
}
