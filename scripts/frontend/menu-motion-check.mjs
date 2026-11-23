import {chromium,webkit,devices} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const dir='docs/verification/iphone-layout';await mkdir(dir,{recursive:true});
for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{channel:'chrome'}:{}),page=await browser.newPage({...devices['iPhone 13'],viewport:{width:375,height:667}});
 try{
  await page.goto('http://127.0.0.1:5071');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  const samples={};
  for(const action of ['open','close']){
   samples[action]=await page.evaluate(async action=>{
    const panel=document.querySelector('#mobile-navigation'),rows=[],start=performance.now();
    document.querySelector(action==='open'?'#nav-toggle':'#nav-close').click();
    await new Promise(resolve=>{const frame=()=>{
     const s=getComputedStyle(panel),b=getComputedStyle(panel,'::backdrop');
     rows.push({ms:+(performance.now()-start).toFixed(2),opacity:+s.opacity,y:new DOMMatrixReadOnly(s.transform).m42,backdrop:+b.opacity,open:panel.open});
     if(performance.now()-start<400)requestAnimationFrame(frame);else resolve();
    };frame();});return rows;
   },action);
   if(action==='open')await page.screenshot({path:`${dir}/menu-${engine.name()}.png`,scale:'css'});
  }
  await writeFile(`${dir}/menu-${engine.name()}.json`,JSON.stringify(samples,null,2));
  const lines=['# Кадры меню · '+engine.name(),'','Время от программного click, запись requestAnimationFrame; обычная анимация.'];
  for(const [name,rows] of Object.entries(samples)){
   lines.push('',`## ${name}`,'','| мс | opacity панели | сдвиг Y | opacity подложки | dialog open |','|---:|---:|---:|---:|---|',...rows.map(r=>`| ${r.ms} | ${r.opacity} | ${r.y} | ${r.backdrop} | ${r.open} |`));
  }
  await writeFile(`${dir}/menu-${engine.name()}.md`,lines.join('\n'));
  const points=(rows,key,offset)=>rows.map(r=>`${40+r.ms*1.3},${offset+140*(1-r[key])}`).join(' ');
  await writeFile(`${dir}/menu-${engine.name()}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 440"><rect width="620" height="440" fill="#FFF7E6"/><g fill="#2D3A47" font-family="sans-serif" font-size="16"><text x="40" y="28">Открытие / закрытие · ${engine.name()}</text><text x="40" y="60">Rosewood: панель · синий: подложка</text><text x="40" y="242">Закрытие</text><text x="40" y="425">0 → 400 мс · opacity 0 → 1</text></g><g fill="none" stroke-width="2"><polyline stroke="#8F4A53" points="${points(samples.open,'opacity',80)}"/><polyline stroke="#2D3A47" stroke-dasharray="5 4" points="${points(samples.open,'backdrop',80)}"/><polyline stroke="#8F4A53" points="${points(samples.close,'opacity',260)}"/><polyline stroke="#2D3A47" stroke-dasharray="5 4" points="${points(samples.close,'backdrop',260)}"/></g></svg>`);
  console.log(engine.name(),Object.fromEntries(Object.entries(samples).map(([key,rows])=>[key,{intermediate:rows.filter(r=>r.opacity>0&&r.opacity<1).length,backdrop:rows.filter(r=>r.backdrop>0&&r.backdrop<1).length}])));
 }finally{await browser.close();}
}
